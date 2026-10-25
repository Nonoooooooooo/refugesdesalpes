/**
 * Étape 1b — Inventaire des sources et rapport de couverture des refuges (hors ligne).
 *
 * Croise les arrêts officiels collectés par 1_collecter_sources.cjs avec les arrêts
 * actuellement affichés sur la carte (public/transports_v2.json, ou --carte) et produit :
 *  - docs/transport/rapport_couverture.md   rapport lisible
 *  - docs/transport/inventaire_sources.csv  une ligne par jeu de données officiel
 *  - docs/transport/couverture_refuges.csv  une ligne par refuge, cabane ou gîte
 *
 * Les distances sont à vol d'oiseau entre le refuge et l'arrêt le plus proche :
 * c'est un indicateur de desserte, pas un temps de marche.
 *
 * Utilisation :
 *   node scripts/transport_v2/2_analyser_couverture.cjs
 *   node scripts/transport_v2/2_analyser_couverture.cjs --carte public/transports_v2.json --suffixe v2
 */

const fs = require('fs');
const path = require('path');
const { ROOT, PATHS, DOCS_DIR, readJson, loadHebergements, GridIndex, toCsv } = require('./lib.cjs');

const argValue = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null);
if (argValue('--carte')) PATHS.carte = path.resolve(ROOT, argValue('--carte'));
const SUFFIXE = argValue('--suffixe') ? `_${argValue('--suffixe')}` : '';
const CARTE_REL = path.relative(ROOT, PATHS.carte).replace(/\\/g, '/');

const SEUIL_KM = 5; // arrêt considéré comme « proche » du refuge
const LOIN_KM = 10;
const REPRISE_M = 200; // un arrêt officiel est « repris » si un arrêt de la carte est à moins de 200 m
const AUJOURDHUI = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------

function classifyDataset(title) {
  if (/covoiturage/i.test(title)) return 'covoiturage';
  if (/agr[ée]gat/i.test(title)) return 'agregat';
  if (/^r[ée]seau scolaire|transport scolaire|scolaire interurbain/i.test(title)) return 'scolaire';
  if (/maritime|ferries/i.test(title)) return 'maritime';
  if (/flixbus|blablacar|eurostar/i.test(title)) return 'longue_distance';
  return 'transport';
}

// Catégories qui comptent pour la desserte d'un refuge
const DESSERTE = ['transport', 'longue_distance'];

function loadDatasets() {
  const datasets = readJson(PATHS.datasets);
  // Sources suivies : celles qu'importe la chaîne de mise à jour (sources.cjs, hors sources désactivées)
  const suivi = new Set(require(PATHS.sources).filter((s) => s.actif !== false).map((s) => s.id));

  const byResource = new Map();
  const byTitle = new Map();
  for (const ds of datasets) {
    const gtfs = (ds.resources || []).filter((r) => r.format === 'GTFS');
    const latest = gtfs.slice().sort((a, b) => String(b.updated).localeCompare(String(a.updated)))[0];
    const meta = latest?.metadata || {};
    const info = {
      id: ds.id,
      titre: ds.title,
      categorie: classifyDataset(ds.title),
      editeur: ds.publisher?.name || '',
      page: ds.page_url,
      majSource: (latest?.updated || ds.updated || '').slice(0, 10),
      debut: meta.start_date || '',
      fin: meta.end_date || '',
      lignes: meta.stats?.routes_count ?? '',
      courses: meta.stats?.trips_count ?? '',
      modes: (meta.modes || []).join(', '),
      reseaux: (meta.networks || []).join(', '),
      suivi: suivi.has(ds.id),
    };
    for (const r of gtfs) byResource.set(r.id, info);
    byTitle.set(ds.title, info);
  }
  return { byResource, byTitle, suivi };
}

function loadOfficialStops(datasets) {
  const raw = readJson(PATHS.arrets);
  return raw.map((s) => {
    const ds = datasets.byResource.get(s.r) || datasets.byTitle.get(s.d);
    return {
      lat: s.lat,
      lng: s.lng,
      nom: s.n,
      ds: ds || { id: `inconnu-${s.r}`, titre: s.d, categorie: classifyDataset(s.d), suivi: false },
    };
  });
}

function hasTimetable(p) {
  // Réseau v2 : indicateur dans la carte légère (les grilles sont dans les fiches par ligne)
  if (typeof p.horaires === 'boolean') return p.horaires;
  if ((p.directions || []).some((d) => (d.timetables || []).some((t) => t.rows?.length))) return true;
  const tt = p.timetable;
  if (!tt) return false;
  if (Array.isArray(tt)) return tt.length > 0;
  if (Array.isArray(tt.rows)) return tt.rows.some((row) => (row.times || []).length > 0);
  return Object.keys(tt).length > 0;
}

function loadCarteStops() {
  const carte = readJson(PATHS.carte);
  const stops = [];
  for (const f of carte.features) {
    const p = f.properties || {};
    const ligne = {
      reseau: p.network || '(sans réseau)',
      ligne: [p.ref, p.name].filter(Boolean).join(' — '),
      mode: p.mode,
      horaires: hasTimetable(p),
    };
    for (const sp of p.stopPoints || []) {
      if (Number.isFinite(sp.lat) && Number.isFinite(sp.lng)) stops.push({ lat: sp.lat, lng: sp.lng, nom: sp.name, ...ligne });
    }
    if (f.geometry?.type === 'Point') {
      const [lng, lat] = f.geometry.coordinates;
      stops.push({ lat, lng, nom: p.name, ...ligne });
    }
  }
  return { stops, lignes: carte.features.length };
}

// ---------------------------------------------------------------------------
// Analyse
// ---------------------------------------------------------------------------

const round = (km) => (km === null || km === undefined ? null : Math.round(km * 10) / 10);

function analyseRefuges(refuges, communes, idx) {
  return refuges.map((r) => {
    const geo = communes[r.id] || { commune: '', dep: '?', depNom: '' };
    const carte = idx.carte.nearest(r.lat, r.lng);
    const carteH = idx.carteHoraires.nearest(r.lat, r.lng);
    const off = idx.officiel.nearest(r.lat, r.lng);
    const agg = idx.agregat.nearest(r.lat, r.lng);

    const dCarte = carte ? carte.km : Infinity;
    const dCarteH = carteH ? carteH.km : Infinity;
    const dOff = off ? off.km : Infinity;
    const dAgg = agg ? agg.km : Infinity;

    let statut;
    if (dCarteH <= SEUIL_KM) statut = 'desservi';
    else if (dCarte <= SEUIL_KM) statut = 'desservi_sans_horaires';
    else if (dOff <= SEUIL_KM) statut = 'a_recuperer';
    else if (dAgg <= SEUIL_KM) statut = 'a_recuperer_agregat';
    else if (Math.min(dOff, dAgg) <= LOIN_KM) statut = 'eloigne';
    else statut = 'trou';

    // Jeux officiels (agrégats compris) ayant un arrêt à moins de SEUIL_KM du refuge
    const dsProches = new Set(
      [...idx.officiel.within(r.lat, r.lng, SEUIL_KM), ...idx.agregat.within(r.lat, r.lng, SEUIL_KM)].map((s) => s.ds.titre)
    );

    return {
      id: r.id,
      nom: r.nom,
      type: r.type,
      alt: r.alt,
      lat: r.lat,
      lng: r.lng,
      commune: geo.commune,
      dep: geo.dep,
      depNom: geo.depNom,
      statut,
      dCarte: round(carte?.km),
      arretCarte: carte ? carte.point.nom : '',
      reseauCarte: carte ? carte.point.reseau : '',
      carteSansHoraires: carte ? !carte.point.horaires : '',
      dCarteHoraires: round(carteH?.km),
      dOfficiel: round(off?.km),
      arretOfficiel: off ? off.point.nom : '',
      reseauOfficiel: off ? off.point.ds.titre : '',
      dAgregat: round(agg?.km),
      dsProches,
    };
  });
}

function analyseDatasets(officialAll, refugesRes, idx) {
  const map = new Map();
  for (const s of officialAll) {
    const key = s.ds.id;
    if (!map.has(key)) map.set(key, { ...s.ds, arrets: 0, repris: 0, dansAgregat: 0, refugesProches: 0, refugesGagnes: 0 });
    const d = map.get(key);
    d.arrets++;
    if (idx.carte.nearest(s.lat, s.lng, REPRISE_M / 1000)) d.repris++;
    if (s.ds.categorie !== 'agregat' && idx.agregat.nearest(s.lat, s.lng, REPRISE_M / 1000)) d.dansAgregat++;
  }
  const byTitle = new Map([...map.values()].map((d) => [d.titre, d]));
  for (const r of refugesRes) {
    const pasDesserviAvecHoraires = !(r.dCarteHoraires !== null && r.dCarteHoraires <= SEUIL_KM);
    for (const titre of r.dsProches) {
      const d = byTitle.get(titre);
      if (!d) continue;
      d.refugesProches++;
      if (pasDesserviAvecHoraires) d.refugesGagnes++;
    }
  }
  for (const d of map.values()) {
    d.tauxReprise = d.arrets ? Math.round((100 * d.repris) / d.arrets) : 0;
    d.tauxAgregat = d.categorie === 'agregat' ? '' : d.arrets ? Math.round((100 * d.dansAgregat) / d.arrets) : 0;
    d.validite = !d.fin ? 'inconnue' : d.fin < AUJOURDHUI ? 'périmé' : d.debut > AUJOURDHUI ? 'à venir' : 'valide';
    d.action = recommend(d);
  }
  return [...map.values()].sort(
    (a, b) => b.refugesGagnes - a.refugesGagnes || b.refugesProches - a.refugesProches || b.arrets - a.arrets
  );
}

function recommend(d) {
  if (d.categorie === 'scolaire') return 'Ignorer (circuits scolaires)';
  if (d.categorie === 'covoiturage') return 'Ignorer (lignes de covoiturage)';
  if (d.categorie === 'maritime') return 'Ignorer (liaisons maritimes)';
  if (d.categorie === 'agregat') return 'Source principale candidate (regroupe les réseaux de la région)';
  if (d.refugesProches === 0) return 'Hors zone utile (aucun refuge à moins de 5 km)';
  if (d.suivi) return d.validite === 'périmé' ? 'Suivi par la mise à jour, mais flux périmé' : 'Déjà suivi par la mise à jour';
  if (d.categorie === 'longue_distance') return 'Optionnel (cars et trains longue distance vers les vallées)';
  if (d.tauxReprise >= 50) return 'Déjà sur la carte, jamais mis à jour → ajouter au suivi';
  if (d.refugesGagnes > 0) return 'À intégrer (apporte des refuges non desservis)';
  return 'À intégrer (améliore des refuges déjà desservis)';
}

// ---------------------------------------------------------------------------
// Rapport
// ---------------------------------------------------------------------------

const STATUTS = {
  desservi: 'Desservi (arrêt avec horaires à ≤ 5 km)',
  desservi_sans_horaires: 'Desservi seulement par une ligne sans horaires',
  a_recuperer: 'Récupérable : arrêt officiel à ≤ 5 km, absent de la carte',
  a_recuperer_agregat: "Récupérable via l'agrégat régional uniquement",
  eloigne: 'Éloigné : arrêt officiel entre 5 et 10 km',
  trou: 'Aucun arrêt officiel à moins de 10 km',
};

const pct = (n, total) => (total ? `${Math.round((100 * n) / total)} %` : '–');
const km = (v) => (v === null || v === undefined ? '–' : `${String(v).replace('.', ',')} km`);
const md = (s) => String(s ?? '').replace(/\|/g, '/');

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `|${headers.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${r.map(md).join(' | ')} |`),
  ].join('\n');
}

function countBy(items, keyFn) {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

function buildReport({ collecte, refugesRes, datasetsRes, carte, nbOfficiels }) {
  // Les statistiques portent sur la France : transport.data.gouv.fr ne couvre pas la Suisse ni l'Italie
  const fr = refugesRes.filter((r) => r.dep !== 'HORS_FR');
  const horsFr = refugesRes.filter((r) => r.dep === 'HORS_FR');
  const total = fr.length;
  const parStatut = countBy(fr, (r) => r.statut);
  const gardes = fr.filter((r) => r.type === 'refuge gardé');
  const utiles = datasetsRes.filter((d) => d.categorie === 'transport' && d.refugesProches > 0);
  const aIntegrer = utiles.filter((d) => !d.suivi && d.tauxReprise < 50);
  const jamaisMaj = utiles.filter((d) => !d.suivi && d.tauxReprise >= 50);
  const longueDistance = datasetsRes.filter((d) => d.categorie === 'longue_distance' && d.refugesProches > 0);
  const agregats = datasetsRes.filter((d) => d.categorie === 'agregat' && d.arrets >= 100);
  const L = [];

  L.push('# Transport : inventaire des sources et couverture des refuges');
  L.push('');
  L.push(`*Étape 1 du chantier « Transport v2 » — généré le ${AUJOURDHUI} par \`scripts/transport_v2/\`. Données officielles collectées le ${collecte.date.slice(0, 10)}.*`);
  L.push('');
  L.push('## En bref');
  L.push('');
  const desservis = (parStatut.get('desservi') || 0);
  const recup = (parStatut.get('a_recuperer') || 0) + (parStatut.get('a_recuperer_agregat') || 0);
  L.push(`- **${refugesRes.length} hébergements analysés** (refuges gardés, cabanes non gardées, gîtes d'étape) : ${total} en France, dont ${gardes.length} refuges gardés, et ${horsFr.length} en Suisse ou en Italie. Les chiffres qui suivent portent sur la France.`);
  L.push(`- **${desservis} (${pct(desservis, total)})** ont aujourd'hui un arrêt avec horaires à moins de ${SEUIL_KM} km sur la carte.`);
  L.push(`- **${parStatut.get('desservi_sans_horaires') || 0}** ne sont desservis que par des lignes dessinées à la main, sans horaires.`);
  L.push(`- **${recup}** pourraient être desservis simplement en important des données officielles qui existent déjà.`);
  L.push(`- **${(parStatut.get('eloigne') || 0) + (parStatut.get('trou') || 0)}** n'ont aucun arrêt officiel à moins de ${SEUIL_KM} km : c'est là qu'il faut chercher des navettes hors open data (PDF de communes, offices de tourisme, Parcs nationaux) — ou accepter qu'il n'y en a pas.`);
  L.push(`- **${utiles.length} jeux de données officiels** ont des arrêts à moins de ${SEUIL_KM} km d'un refuge. La chaîne de mise à jour (sources.cjs) en suit ${utiles.filter((d) => d.suivi).length}. ${aIntegrer.length} ne sont pas (ou presque pas) sur la carte, et ${jamaisMaj.length} y sont mais ne sont jamais mis à jour.`);
  const horsFrDesservis = horsFr.filter((r) => r.statut === 'desservi').length;
  L.push(`- **Hors de France**, seuls ${horsFrDesservis} des ${horsFr.length} hébergements ont un arrêt avec horaires à moins de ${SEUIL_KM} km. Les couvrir demanderait les données ouvertes suisses (opentransportdata.swiss) et italiennes, que transport.data.gouv.fr ne contient pas.`);
  L.push('');

  L.push('## Méthode et limites');
  L.push('');
  L.push(`- **Sources officielles** : tous les arrêts GTFS publiés sur transport.data.gouv.fr autour des refuges (${nbOfficiels} arrêts, ${collecte.tuiles} tuiles de 0,5°), via l'API \`/api/gtfs-stops\`, et le catalogue \`/api/datasets\` pour les dates de validité.`);
  L.push(`- **Carte analysée** : les ${carte.stops.length} arrêts des ${carte.lignes} lignes de \`${CARTE_REL}\`.`);
  L.push(`- **Distance à vol d'oiseau** entre le refuge et l'arrêt le plus proche. Ce n'est pas un temps de marche : un arrêt à 4 km peut être à 3 h de montée, et un arrêt de l'autre côté d'une crête ne sert à rien.`);
  L.push(`- Un arrêt officiel est compté comme **repris sur la carte** si un arrêt de la carte se trouve à moins de ${REPRISE_M} m.`);
  L.push("- Les **circuits scolaires** et les **lignes de covoiturage** sont exclus de la desserte. Les **agrégats régionaux** sont comptés à part, car ils regroupent des réseaux déjà publiés séparément.");
  L.push("- Un arrêt présent dans un flux ne garantit pas un service utile : une navette peut ne rouler qu'en hiver, ou quelques jours par an. La colonne validité du fichier CSV donne la période couverte par chaque flux.");
  L.push('- Les refuges hors de France (Suisse, Italie) ne peuvent pas être couverts par transport.data.gouv.fr.');
  L.push('');

  L.push('## Couverture des refuges en France');
  L.push('');
  const types = ['refuge gardé', 'cabane non gardée', "gîte d'étape"];
  L.push(
    table(
      ['Situation', 'Total', ...types],
      Object.entries(STATUTS).map(([k, label]) => {
        const sel = fr.filter((r) => r.statut === k);
        return [label, `${sel.length} (${pct(sel.length, total)})`, ...types.map((t) => sel.filter((r) => r.type === t).length)];
      })
    )
  );
  L.push('');
  L.push('### Par département');
  L.push('');
  const deps = [...countBy(refugesRes, (r) => `${r.dep}|${r.depNom}`).keys()].sort();
  L.push(
    table(
      ['Département', 'Hébergements', 'Desservis', 'Sans horaires', 'Récupérables', 'Sans arrêt officiel à ≤ 5 km'],
      deps.map((key) => {
        const [code, nom] = key.split('|');
        const sel = refugesRes.filter((r) => r.dep === code);
        const n = (s) => sel.filter((r) => s.includes(r.statut)).length;
        return [
          code === 'HORS_FR' ? 'Hors France' : `${code} ${nom}`,
          sel.length,
          `${n(['desservi'])} (${pct(n(['desservi']), sel.length)})`,
          n(['desservi_sans_horaires']),
          n(['a_recuperer', 'a_recuperer_agregat']),
          n(['eloigne', 'trou']),
        ];
      })
    )
  );
  L.push('');

  L.push('## Sources officielles à intégrer');
  L.push('');
  L.push(`Jeux de données qui ont des arrêts près des refuges mais qui sont absents de la carte (moins de 50 % de leurs arrêts repris). « Refuges gagnés » = hébergements sans arrêt avec horaires à ≤ ${SEUIL_KM} km aujourd'hui, qui en auraient un avec ce réseau.`);
  L.push('');
  L.push(
    table(
      ['Jeu de données', 'Refuges gagnés', 'Refuges à ≤ 5 km', 'Arrêts repris', 'Validité', 'Dernière mise à jour'],
      aIntegrer.map((d) => [
        `[${d.titre}](${d.page || '#'})`,
        d.refugesGagnes,
        d.refugesProches,
        `${d.tauxReprise} %`,
        d.debut ? `${d.validite} (${d.debut} → ${d.fin})` : d.validite,
        d.majSource,
      ])
    )
  );
  L.push('');
  if (longueDistance.length) {
    L.push(`Réseaux longue distance également présents près des refuges, à intégrer en option pour l'accès aux vallées : ${longueDistance.map((d) => d.titre).join(', ')}.`);
    L.push('');
  }
  L.push('## Sources déjà sur la carte mais jamais mises à jour');
  L.push('');
  L.push("Ces réseaux ont été importés une fois mais ne font pas partie des sources suivies par la mise à jour : leurs horaires vieillissent sans qu'on le voie.");
  L.push('');
  L.push(
    table(
      ['Jeu de données', 'Arrêts repris', 'Refuges à ≤ 5 km', 'Validité du flux officiel', 'Dernière mise à jour officielle'],
      jamaisMaj.map((d) => [`[${d.titre}](${d.page || '#'})`, `${d.tauxReprise} %`, d.refugesProches, d.debut ? `${d.validite} (${d.debut} → ${d.fin})` : d.validite, d.majSource])
    )
  );
  L.push('');
  L.push('## Sources suivies par la mise à jour');
  L.push('');
  L.push(
    table(
      ['Jeu de données', 'Arrêts repris', 'Refuges à ≤ 5 km', 'Validité', 'Dernière mise à jour officielle'],
      datasetsRes
        .filter((d) => d.suivi)
        .map((d) => [`[${d.titre}](${d.page || '#'})`, `${d.tauxReprise} %`, d.refugesProches, d.debut ? `${d.validite} (${d.debut} → ${d.fin})` : d.validite, d.majSource])
    )
  );
  L.push('');
  if (agregats.length) {
    L.push('## Agrégats régionaux');
    L.push('');
    L.push(
      table(
        ['Jeu de données', 'Arrêts dans la zone', 'Refuges à ≤ 5 km', 'Validité', 'Dernière mise à jour'],
        agregats.map((d) => [`[${d.titre}](${d.page || '#'})`, d.arrets, d.refugesProches, d.debut ? `${d.validite} (${d.debut} → ${d.fin})` : d.validite, d.majSource])
      )
    );
    L.push('');
    L.push(`${parStatut.get('a_recuperer_agregat') || 0} hébergements ne sont proches que d'arrêts présents dans un agrégat (et dans aucun flux séparé).`);
    L.push('');
    L.push("**L'agrégat ne remplace pas les flux séparés.** Part des arrêts de chaque réseau (à moins de 5 km d'au moins 5 refuges) que l'on retrouve dans un agrégat. Les réseaux de la région Sud (ZOU !, Altigo, Queyras…) n'ont pas d'agrégat : 0 % est normal pour eux.");
    L.push('');
    L.push(
      table(
        ['Réseau', 'Refuges à ≤ 5 km', 'Arrêts présents dans un agrégat'],
        datasetsRes
          .filter((d) => d.categorie === 'transport' && d.refugesProches >= 5)
          .sort((a, b) => a.tauxAgregat - b.tauxAgregat || b.refugesProches - a.refugesProches)
          .map((d) => [d.titre, d.refugesProches, `${d.tauxAgregat} %`])
      )
    );
    L.push('');
  }

  L.push('## Où chercher les navettes manquantes');
  L.push('');
  L.push(`Communes qui comptent le plus de **refuges gardés** sans aucun arrêt officiel à moins de ${SEUIL_KM} km (et sans arrêt avec horaires sur la carte). Ce sont les meilleures pistes pour trouver des navettes estivales publiées seulement en PDF.`);
  L.push('');
  const trous = fr.filter((r) => ['eloigne', 'trou'].includes(r.statut));
  const trousGardes = trous.filter((r) => r.type === 'refuge gardé');
  const parCommune = new Map();
  for (const r of trousGardes) {
    const k = `${r.commune} (${r.dep})`;
    if (!parCommune.has(k)) parCommune.set(k, []);
    parCommune.get(k).push(r);
  }
  L.push(
    table(
      ['Commune', 'Refuges gardés', 'Arrêt officiel le plus proche', 'Refuges'],
      [...parCommune.entries()]
        .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
        .slice(0, 40)
        .map(([k, list]) => {
          const best = list.reduce((a, b) => ((a.dOfficiel ?? 99) <= (b.dOfficiel ?? 99) ? a : b));
          return [k, list.length, best.dOfficiel !== null ? `${km(best.dOfficiel)} (${best.arretOfficiel}, ${best.reseauOfficiel})` : '> 40 km', list.map((r) => r.nom).join(', ')];
        })
    )
  );
  L.push('');
  L.push(`Liste complète (${trous.length} hébergements en France, toutes catégories) : filtrer la colonne « Situation » de \`couverture_refuges.csv\`.`);
  L.push('');

  L.push('## Refuges gardés desservis seulement par des lignes sans horaires');
  L.push('');
  L.push("Ces refuges dépendent de lignes ajoutées à la main. Si un arrêt officiel est proche, on peut remplacer la ligne manuelle par la vraie ; sinon il faut vérifier qu'elle existe encore.");
  L.push('');
  const sansH = refugesRes.filter((r) => r.statut === 'desservi_sans_horaires' && r.type === 'refuge gardé');
  L.push(
    table(
      ['Refuge', 'Ligne de la carte', 'Arrêt officiel le plus proche'],
      sansH
        .sort((a, b) => a.reseauCarte.localeCompare(b.reseauCarte))
        .map((r) => [r.nom, `${r.reseauCarte} (${km(r.dCarte)})`, r.dOfficiel !== null && r.dOfficiel <= SEUIL_KM ? `${km(r.dOfficiel)} — ${r.reseauOfficiel}` : 'aucun à ≤ 5 km'])
    )
  );
  L.push('');

  L.push('## Relancer l’analyse');
  L.push('');
  L.push('```bash');
  L.push('node scripts/transport_v2/1_collecter_sources.cjs');
  L.push('node scripts/transport_v2/2_analyser_couverture.cjs');
  L.push('```');
  L.push('');
  L.push('Le premier script interroge transport.data.gouv.fr et geo.api.gouv.fr (environ une minute) et met les réponses en cache dans `imports/transport_v2/`. Le second travaille hors ligne et régénère ce rapport et les deux fichiers CSV.');
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------------------

function main() {
  for (const f of [PATHS.datasets, PATHS.arrets, PATHS.communes, PATHS.collecte]) {
    if (!fs.existsSync(f)) {
      console.error(`❌ ${path.relative(process.cwd(), f)} manquant : lancer d'abord scripts/transport_v2/1_collecter_sources.cjs`);
      process.exit(1);
    }
  }
  const collecte = readJson(PATHS.collecte);
  const refuges = loadHebergements();
  const communes = readJson(PATHS.communes);
  const datasets = loadDatasets();
  const officialAll = loadOfficialStops(datasets);
  const carte = loadCarteStops();

  const idx = {
    carte: new GridIndex(carte.stops),
    carteHoraires: new GridIndex(carte.stops.filter((s) => s.horaires)),
    officiel: new GridIndex(officialAll.filter((s) => DESSERTE.includes(s.ds.categorie))),
    agregat: new GridIndex(officialAll.filter((s) => s.ds.categorie === 'agregat')),
  };

  const refugesRes = analyseRefuges(refuges, communes, idx);
  const datasetsRes = analyseDatasets(officialAll, refugesRes, idx);

  fs.mkdirSync(DOCS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(DOCS_DIR, `rapport_couverture${SUFFIXE}.md`),
    buildReport({ collecte, refugesRes, datasetsRes, carte, nbOfficiels: officialAll.length }),
    'utf8'
  );
  fs.writeFileSync(
    path.join(DOCS_DIR, `inventaire_sources${SUFFIXE}.csv`),
    toCsv(datasetsRes, [
      { key: 'titre', label: 'Jeu de données' },
      { key: 'categorie', label: 'Catégorie' },
      { key: 'action', label: 'Action recommandée' },
      { key: 'refugesGagnes', label: 'Refuges gagnés' },
      { key: 'refugesProches', label: 'Refuges à ≤ 5 km' },
      { key: 'arrets', label: 'Arrêts dans la zone' },
      { key: 'tauxReprise', label: 'Arrêts repris sur la carte (%)' },
      { key: 'tauxAgregat', label: 'Arrêts présents dans un agrégat (%)' },
      { key: 'suivi', label: 'Suivi par la mise à jour' },
      { key: 'validite', label: 'Validité' },
      { key: 'debut', label: 'Début' },
      { key: 'fin', label: 'Fin' },
      { key: 'majSource', label: 'Dernière mise à jour' },
      { key: 'lignes', label: 'Lignes' },
      { key: 'courses', label: 'Courses' },
      { key: 'modes', label: 'Modes' },
      { key: 'reseaux', label: 'Réseaux' },
      { key: 'editeur', label: 'Éditeur' },
      { key: 'page', label: 'Page' },
      { key: 'id', label: 'Identifiant' },
    ]),
    'utf8'
  );
  fs.writeFileSync(
    path.join(DOCS_DIR, `couverture_refuges${SUFFIXE}.csv`),
    toCsv(
      refugesRes.map((r) => ({ ...r, statut: STATUTS[r.statut] })),
      [
        { key: 'nom', label: 'Hébergement' },
        { key: 'type', label: 'Type' },
        { key: 'alt', label: 'Altitude' },
        { key: 'commune', label: 'Commune' },
        { key: 'dep', label: 'Département' },
        { key: 'statut', label: 'Situation' },
        { key: 'dCarteHoraires', label: 'Arrêt avec horaires sur la carte (km)' },
        { key: 'dCarte', label: 'Arrêt le plus proche sur la carte (km)' },
        { key: 'arretCarte', label: 'Arrêt carte' },
        { key: 'reseauCarte', label: 'Réseau carte' },
        { key: 'dOfficiel', label: 'Arrêt officiel le plus proche (km)' },
        { key: 'arretOfficiel', label: 'Arrêt officiel' },
        { key: 'reseauOfficiel', label: 'Jeu de données officiel' },
        { key: 'dAgregat', label: 'Arrêt agrégat régional (km)' },
        { key: 'lat', label: 'Latitude' },
        { key: 'lng', label: 'Longitude' },
        { key: 'id', label: 'Identifiant refuges.info' },
      ]
    ),
    'utf8'
  );

  const parStatut = countBy(refugesRes, (r) => r.statut);
  console.log(`✅ ${refugesRes.length} hébergements, ${datasetsRes.length} jeux de données officiels dans la zone`);
  for (const [k, label] of Object.entries(STATUTS)) console.log(`   ${String(parStatut.get(k) || 0).padStart(5)}  ${label}`);
  console.log(`📄 Rapport : ${path.relative(process.cwd(), path.join(DOCS_DIR, `rapport_couverture${SUFFIXE}.md`))}`);
}

main();
