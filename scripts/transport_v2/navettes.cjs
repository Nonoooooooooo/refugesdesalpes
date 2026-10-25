/**
 * Navettes hors open data : lecture, contrôle et conversion au format de la carte.
 *
 * Les navettes sont décrites à la main dans navettes_hors_open_data.json, chacune avec
 * sa source (document officiel consulté), sa saison, ses arrêts et, quand la source les
 * publie, ses grilles horaires. Le format est documenté dans docs/transport/navettes_hors_open_data.md.
 * Les tracés routiers sont calculés à part par navettes_tracer.cjs (navettes_traces.json).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILES = {
  navettes: path.join(__dirname, 'navettes_hors_open_data.json'),
  traces: path.join(__dirname, 'navettes_traces.json'),
};

const MODES = ['navette', 'bus', 'cable_car', 'funicular', 'mountain_train', 'train'];
const STATUTS = {
  verifie: 'Horaires relevés sur la source officielle de la saison',
  partiel: 'Dates connues, horaires non publiés par la source',
  a_verifier: 'Information ancienne ou indirecte, à vérifier',
};
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Une ligne de grille peut préciser « (arrivée) » ou « (départ) » pour un arrêt où le car stationne
const baseArret = (nom) => String(nom).replace(/\s*\((arrivée|départ)\)$/i, '');

function loadNavettes() {
  if (!fs.existsSync(FILES.navettes)) return [];
  return JSON.parse(fs.readFileSync(FILES.navettes, 'utf8')).navettes || [];
}

function loadTraces() {
  return fs.existsSync(FILES.traces) ? JSON.parse(fs.readFileSync(FILES.traces, 'utf8')) : {};
}

// Empreinte des arrêts d'un sens : un tracé est à recalculer quand elle change
function stopsHash(arrets) {
  return crypto
    .createHash('sha1')
    .update(arrets.map((a) => `${a.lat.toFixed(5)},${a.lng.toFixed(5)}`).join(';'))
    .digest('hex')
    .slice(0, 12);
}

function validateNavette(n) {
  const errs = [];
  const need = (cond, msg) => {
    if (!cond) errs.push(msg);
  };
  need(typeof n.id === 'string' && /^[a-z0-9-]+$/.test(n.id), 'id manquant ou invalide (minuscules, chiffres, tirets)');
  need(n.nom, 'nom manquant');
  need(n.reseau, 'reseau manquant');
  need(MODES.includes(n.mode), `mode invalide (${MODES.join(', ')})`);
  need(STATUTS[n.statut], `statut invalide (${Object.keys(STATUTS).join(', ')})`);
  need(n.source?.titre && /^https?:\/\//.test(n.source?.url || '') && DATE.test(n.source?.consulteLe || ''), 'source incomplète (titre, url, consulteLe AAAA-MM-JJ)');
  need(DATE.test(n.saison?.debut || '') && DATE.test(n.saison?.fin || '') && n.saison.debut <= n.saison.fin, 'saison invalide (debut et fin AAAA-MM-JJ)');
  need(Array.isArray(n.sens) && n.sens.length > 0, 'aucun sens de circulation');
  (n.sens || []).forEach((s, i) => {
    const where = `sens ${i + 1}`;
    need(s.nom, `${where} : nom manquant`);
    need(Array.isArray(s.arrets) && s.arrets.length >= 2, `${where} : au moins deux arrêts`);
    const noms = new Set();
    for (const a of s.arrets || []) {
      need(a.nom && Number.isFinite(a.lat) && Number.isFinite(a.lng) && a.lat > 43 && a.lat < 47.5 && a.lng > 4.5 && a.lng < 8, `${where} : arrêt « ${a.nom} » sans coordonnées valides`);
      noms.add(a.nom);
    }
    for (const g of s.grilles || []) {
      need(g.label, `${where} : grille sans label`);
      const largeur = g.lignes?.[0]?.heures?.length;
      for (const l of g.lignes || []) {
        need(noms.has(baseArret(l.arret)), `${where}, grille « ${g.label} » : arrêt « ${l.arret} » absent de la liste des arrêts`);
        need(l.heures?.length === largeur, `${where}, grille « ${g.label} » : la ligne « ${l.arret} » n'a pas le même nombre de colonnes`);
        for (const h of l.heures || []) need(h === '' || HEURE.test(h), `${where}, grille « ${g.label} » : heure invalide « ${h} »`);
      }
    }
    if (n.statut === 'verifie') need((s.grilles || []).length > 0, `${where} : statut « verifie » sans grille horaire`);
  });
  return errs;
}

const fmtDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const dateFr = (iso) => fmtDate.format(new Date(`${iso}T00:00:00Z`));

function periodText(saison, todayIso) {
  const jours = saison.jours ? ` (${saison.jours.charAt(0).toLowerCase()}${saison.jours.slice(1)})` : '';
  if (saison.fin < todayIso) return `Hors saison · dernière saison du ${dateFr(saison.debut)} au ${dateFr(saison.fin)}${jours}`;
  if (saison.debut > todayIso) return `Du ${dateFr(saison.debut)} au ${dateFr(saison.fin)}${jours} (saison pas encore commencée)`;
  return `Du ${dateFr(saison.debut)} au ${dateFr(saison.fin)}${jours}`;
}

/**
 * Convertit une navette en ligne au format de transports_v2.json (mêmes champs que les lignes officielles).
 */
function navetteToFeature(n, traces, todayIso) {
  const horsSaison = n.saison.fin < todayIso;
  let traceCalculee = true;

  const directions = n.sens.map((s, i) => {
    const timetables = (s.grilles || []).map((g) => {
      const departs = g.lignes[0].heures.map((_, col) => g.lignes.some((l) => l.heures[col])).filter(Boolean).length;
      const notes = [g.note, `Horaires relevés sur « ${n.source.titre} ».`, horsSaison ? 'Saison terminée : ce sont les horaires de la dernière saison.' : null];
      return {
        label: g.label,
        departs,
        title: `Horaires · ${g.label}`,
        rows: g.lignes.map((l) => ({ stop: l.arret, times: l.heures })),
        note: notes.filter(Boolean).join(' '),
      };
    });
    const first = timetables[0];
    const stopPoints = s.arrets.map((a) => {
      const rows = first?.rows.filter((r) => baseArret(r.stop) === a.nom) || [];
      const times = (rows.find((r) => /\(départ\)$/i.test(r.stop)) || rows[0])?.times.filter(Boolean) || [];
      return {
        name: a.nom,
        lat: a.lat,
        lng: a.lng,
        time: times.length ? times.slice(0, 6).join(' | ') + (times.length > 6 ? ' | …' : '') : undefined,
      };
    });
    const trace = traces[`${n.id}#${i}`];
    const traceOk = trace && trace.empreinte === stopsHash(s.arrets) && trace.coordinates?.length >= 2;
    if (!traceOk) traceCalculee = false;
    return {
      id: i === 0 ? 'aller' : i === 1 ? 'retour' : `sens-${i + 1}`,
      name: s.nom,
      origin: s.arrets[0].nom,
      destination: s.arrets[s.arrets.length - 1].nom,
      stops: s.arrets.map((a) => a.nom),
      stopPoints,
      coordinates: traceOk ? trace.coordinates : stopPoints.map((p) => [p.lng, p.lat]),
      timetables,
    };
  });

  const aller = directions[0];
  const freq = (n.sens[0].grilles || []).map((g, gi) => `${g.label} : ${aller.timetables[gi].departs} départ${aller.timetables[gi].departs > 1 ? 's' : ''}`);
  const xs = aller.coordinates.map((c) => c[0]);
  const ys = aller.coordinates.map((c) => c[1]);

  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: aller.coordinates },
    properties: {
      id: `manuel-${n.id}`,
      ref: n.ref || n.nom,
      name: n.nom,
      mode: n.mode,
      operator: n.exploitant || '',
      network: n.reseau,
      route: `${aller.origin} ↔ ${aller.destination}`,
      frequency: freq.length ? `${freq.join(' · ')} (sens ${aller.destination})` : n.frequence || 'Horaires non publiés : voir la source',
      period: periodText(n.saison, todayIso),
      color: n.couleur || '#f59e0b',
      url: n.source.url,
      offset: 0,
      stops: aller.stops,
      stopPoints: aller.stopPoints,
      directions,
      horsSaison,
      validite: { debut: n.saison.debut, fin: n.saison.fin },
      traceOfficiel: false,
      traceCalculee,
      manuel: true,
      statut: n.statut,
      note: [n.note, n.tarif ? `Tarif : ${n.tarif}` : null, n.reservation ? `Réservation : ${n.reservation}` : null]
        .filter(Boolean)
        .map((s) => (/[.!?]$/.test(s) ? s : `${s}.`))
        .join(' '),
      source: {
        type: 'hors_open_data',
        jeu: n.source.titre,
        editeur: n.source.editeur || '',
        page: n.source.url,
        miseAJour: n.source.consulteLe,
      },
      _centre: [(Math.min(...ys) + Math.max(...ys)) / 2, (Math.min(...xs) + Math.max(...xs)) / 2],
    },
  };
}

/**
 * Lit, contrôle et convertit toutes les navettes. Les navettes invalides sont écartées et signalées.
 */
function buildNavettes(todayIso) {
  const traces = loadTraces();
  const features = [];
  const rapport = [];
  for (const n of loadNavettes()) {
    const erreurs = validateNavette(n);
    if (erreurs.length) {
      rapport.push({ n, erreurs });
      continue;
    }
    const f = navetteToFeature(n, traces, todayIso);
    features.push(f);
    rapport.push({ n, erreurs: [], traceCalculee: f.properties.traceCalculee });
  }
  return { features, rapport };
}

module.exports = { FILES, STATUTS, loadNavettes, loadTraces, stopsHash, validateNavette, navetteToFeature, buildNavettes };
