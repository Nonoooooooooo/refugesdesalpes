/**
 * Étape 2 — Construction du réseau de transport à partir des seules sources officielles.
 *
 * Pour chaque source de sources.cjs :
 *  1. choisit les ressources GTFS utiles du jeu de données (en cours, à venir, ou dernière saison)
 *  2. télécharge les flux (cache dans imports/transport_v2/gtfs/, mis à jour quand l'éditeur publie)
 *  3. garde les lignes qui offrent l'un des meilleurs accès à un refuge : un arrêt à moins de
 *     RAYON_KM, pas plus loin que MARGE_KM au-delà de l'arrêt officiel le plus proche de ce refuge
 *     (sinon chaque ligne urbaine proche d'une cabane de bord de ville serait gardée)
 *  4. construit pour chaque ligne les sens de circulation, les arrêts dans l'ordre, le tracé
 *     officiel et des grilles horaires par jour type (semaine, samedi, dimanche) où chaque
 *     colonne correspond à un même départ
 *
 * Résultats :
 *   public/transports_v2.json               carte légère : tracés, arrêts et infos de chaque ligne (GeoJSON)
 *   public/transports_v2/lignes/<id>.json   fiche de chaque ligne (sens, arrêts, horaires), chargée au clic
 *   public/transports_v2_search_index.json  index de recherche
 *   public/transports_v2_metadata.json      sources, dates et compteurs
 *   docs/transport/construction_reseau.md   compte rendu de construction
 *
 * Utilisation :
 *   node scripts/transport_v2/3_construire_reseau.cjs
 *   node scripts/transport_v2/3_construire_reseau.cjs --source 6569e1dd21f63c926518143b   # une seule source
 */

const fs = require('fs');
const path = require('path');
const { ROOT, DOCS_DIR, PATHS, readJson, writeJson, loadHebergements, fetchJson, mapLimit, distanceKm, GridIndex } = require('./lib.cjs');
const { ensureResource, eachRow, toMinutes, formatMinutes, loadServiceDates, ymd, parseYmd } = require('./gtfs.cjs');
const SOURCES = require('./sources.cjs');
const { buildNavettes, STATUTS: STATUTS_NAVETTES } = require('./navettes.cjs');
const { isEmptyFeed, pickArchived, extractArchived, archiveZip } = require('./archives.cjs');

// Flux archivés automatiquement : navettes de station, ou sources marquées archiver: true
const shouldArchive = (source) => source.archiver === true || (source.navette && source.archiver !== false);

const RAYON_KM = 5; // une ligne est gardée si l'un de ses arrêts est à moins de 5 km d'un hébergement…
const MARGE_KM = 1.5; // …et à moins de 1,5 km de plus que le meilleur arrêt officiel de cet hébergement
const MAX_DEPARTS = 30; // colonnes maximum par grille horaire
const FENETRE_JOURS = 400; // calendriers lus de J-400 à J+400
const JOURS_ECHANTILLON = 35; // période observée pour choisir les jours types
const ECART_SAISON_JOURS = 14; // au-delà de 14 jours sans service, on considère qu'une saison se termine
const MEME_ARRET_KM = 0.3; // arrêts homonymes à moins de 300 m fusionnés (quais d'une même gare)

const OUT = {
  reseau: path.join(ROOT, 'public/transports_v2.json'),
  lignes: path.join(ROOT, 'public/transports_v2/lignes'),
  index: path.join(ROOT, 'public/transports_v2_search_index.json'),
  meta: path.join(ROOT, 'public/transports_v2_metadata.json'),
  rapport: path.join(DOCS_DIR, 'construction_reseau.md'),
};

const NOW = new Date();
const TODAY = ymd(NOW);
const addDays = (s, n) => {
  const d = parseYmd(s);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
};
const FROM = addDays(TODAY, -FENETRE_JOURS);
const TO = addDays(TODAY, FENETRE_JOURS);
const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);

const fmtDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const dateFr = (s) => fmtDate.format(parseYmd(s));
const jourFr = (s) => fmtJour.format(parseYmd(s));
const isoDate = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const normName = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function modeFor(routeType, source) {
  const t = Number(routeType);
  if (t === 1 || t === 2 || (t >= 100 && t < 200) || (t >= 400 && t < 500)) return 'train';
  if (t === 7 || (t >= 1400 && t < 1500)) return 'funicular';
  if (t === 5 || t === 6 || (t >= 1300 && t < 1400)) return 'cable_car';
  return source.navette ? 'navette' : 'bus';
}

const DEFAULT_COLORS = { train: '#6366f1', navette: '#f59e0b', bus: '#10b981', cable_car: '#ec4899', funicular: '#ec4899' };

function routeColor(route, source, mode) {
  const c = (route.route_color || '').replace('#', '');
  if (/^[0-9a-f]{6}$/i.test(c) && !/^(ffffff|000000)$/i.test(c)) return `#${c.toUpperCase()}`;
  return source.couleur || DEFAULT_COLORS[mode];
}

function isScolaire(route) {
  return Number(route.route_type) === 712 || /scolaire|\bsco\b/i.test(`${route.route_short_name} ${route.route_long_name} ${route.route_desc}`);
}

// Circuit scolaire non déclaré comme tel : uniquement en semaine, 1 ou 2 départs par sens,
// et terminus dans un établissement scolaire (une vraie ligne qui dessert un lycée en a davantage)
const MOTS_SCOLAIRES = /\b(coll[eè]ge|lyc[ée]e|[ée]cole|primaire|maternelle|internes?|mfr|cit[ée] scolaire|groupe scolaire)\b/i;

function looksLikeSchoolRun(structure, canonByKey) {
  if (structure.dayTypes.some((dt) => dt.label !== 'Semaine')) return false;
  const maxDeparts = Math.max(...structure.directions.map((d) => d.trips.filter((x) => structure.dayTypes.some((dt) => dt.trips.has(x.i))).length));
  if (maxDeparts > 2) return false;
  const terminus = structure.directions.flatMap((d) => [d.order[0], d.order[d.order.length - 1]].map((k) => canonByKey.get(k)?.name || ''));
  const headsigns = structure.list.map((t) => t.headsign || '');
  return [...terminus, ...headsigns].some((s) => MOTS_SCOLAIRES.test(s));
}

const slug = (s) =>
  normName(s)
    .replace(/\s+/g, '-')
    .slice(0, 40);

// Simplification Douglas-Peucker (tolérance en mètres) et arrondi au mètre
function simplify(coords, tolM = 12) {
  const round = (v) => Math.round(v * 1e5) / 1e5;
  if (coords.length <= 2) return coords.map(([x, y]) => [round(x), round(y)]);
  const kx = 111320 * Math.cos((coords[0][1] * Math.PI) / 180);
  const ky = 110540;
  const pts = coords.map(([x, y]) => [x * kx, y * ky]);
  const keep = new Uint8Array(coords.length);
  keep[0] = 1;
  keep[coords.length - 1] = 1;
  const stack = [[0, coords.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maxD = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tolM) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return coords.filter((_, i) => keep[i]).map(([x, y]) => [round(x), round(y)]);
}

// ---------------------------------------------------------------------------
// Choix des ressources d'un jeu de données
// ---------------------------------------------------------------------------

function pickResources(dataset) {
  const gtfs = (dataset.resources || []).filter((r) => r.format === 'GTFS' && r.is_available !== false && r.url);
  const limite = isoDate(FROM);
  const utiles = gtfs.filter((r) => !r.metadata?.end_date || r.metadata.end_date >= limite);
  if (utiles.length) return utiles;
  return gtfs.sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, 1);
}

// ---------------------------------------------------------------------------
// Lecture d'un flux et construction de ses lignes
// ---------------------------------------------------------------------------

async function buildResource(root, ctx) {
  const { source, dataset, resource, hutIndex } = ctx;
  const stats = { lignesFlux: 0, lignesProches: 0, lignesScolaires: 0, lignesFiltrees: 0, sansCirculation: 0 };

  const agencies = new Map();
  await eachRow(root, 'agency.txt', (get) => {
    agencies.set(get('agency_id') || '_', { name: get('agency_name'), url: get('agency_url') });
  });
  const defaultAgency = agencies.size === 1 ? [...agencies.values()][0] : null;

  const routes = new Map();
  await eachRow(root, 'routes.txt', (get) => {
    routes.set(get('route_id'), {
      route_id: get('route_id'),
      agency_id: get('agency_id'),
      route_short_name: get('route_short_name'),
      route_long_name: get('route_long_name'),
      route_desc: get('route_desc'),
      route_type: get('route_type'),
      route_color: get('route_color'),
      route_url: get('route_url'),
    });
  });
  stats.lignesFlux = routes.size;

  const stops = new Map();
  await eachRow(root, 'stops.txt', (get) => {
    const lat = Number(get('stop_lat'));
    const lng = Number(get('stop_lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return;
    stops.set(get('stop_id'), { name: get('stop_name') || get('stop_id'), lat, lng });
  });

  const trips = new Map();
  await eachRow(root, 'trips.txt', (get) => {
    trips.set(get('trip_id'), {
      route: get('route_id'),
      service: get('service_id'),
      dir: get('direction_id'),
      headsign: get('trip_headsign'),
      shape: get('shape_id'),
    });
  });

  // 1er passage : lignes qui offrent l'un des meilleurs accès à un refuge
  const nearCache = new Map();
  const isNear = (stopId) => {
    if (!nearCache.has(stopId)) {
      const s = stops.get(stopId);
      nearCache.set(
        stopId,
        Boolean(s) &&
          hutIndex.within(s.lat, s.lng, RAYON_KM).some((h) => distanceKm(h.lat, h.lng, s.lat, s.lng) <= (h.meilleurArretKm ?? RAYON_KM) + MARGE_KM)
      );
    }
    return nearCache.get(stopId);
  };
  const nearRoutes = new Set();
  await eachRow(root, 'stop_times.txt', (get) => {
    const trip = trips.get(get('trip_id'));
    if (trip && !nearRoutes.has(trip.route) && isNear(get('stop_id'))) nearRoutes.add(trip.route);
  });
  stats.lignesProches = nearRoutes.size;

  const keptRoutes = new Set();
  for (const id of nearRoutes) {
    const route = routes.get(id);
    if (!route) continue;
    const agency = agencies.get(route.agency_id) || defaultAgency;
    if (isScolaire(route)) stats.lignesScolaires++;
    else if (source.garderLigne && !source.garderLigne(route, agency)) stats.lignesFiltrees++;
    else keptRoutes.add(id);
  }

  // 2e passage : horaires complets des courses des lignes gardées
  const tripStops = new Map();
  await eachRow(root, 'stop_times.txt', (get) => {
    const tripId = get('trip_id');
    const trip = trips.get(tripId);
    if (!trip || !keptRoutes.has(trip.route)) return;
    if (!tripStops.has(tripId)) tripStops.set(tripId, []);
    tripStops.get(tripId).push({
      seq: Number(get('stop_sequence')),
      stop: get('stop_id'),
      t: toMinutes(get('departure_time') || get('arrival_time')),
    });
  });

  const serviceIds = new Set();
  for (const tripId of tripStops.keys()) serviceIds.add(trips.get(tripId).service);
  const serviceDates = await loadServiceDates(root, serviceIds, FROM, TO);

  // Arrêts homonymes proches fusionnés (quais, poteaux de part et d'autre de la route)
  const canon = new Map();
  const byName = new Map();
  const keyOf = (stopId) => {
    if (canon.has(stopId)) return canon.get(stopId);
    const s = stops.get(stopId);
    if (!s) return null;
    const n = normName(s.name);
    const list = byName.get(n) || [];
    let c = list.find((x) => distanceKm(x.lat, x.lng, s.lat, s.lng) <= MEME_ARRET_KM);
    if (!c) {
      c = { key: stopId, name: s.name, lat: s.lat, lng: s.lng };
      list.push(c);
      byName.set(n, list);
    }
    canon.set(stopId, c);
    return c;
  };

  // Regroupement des courses par ligne
  const routeTrips = new Map();
  for (const [tripId, sts] of tripStops) {
    sts.sort((a, b) => a.seq - b.seq);
    const keys = [];
    const timeAt = new Map();
    let first = null;
    for (const st of sts) {
      const c = keyOf(st.stop);
      if (!c) continue;
      if (keys[keys.length - 1] !== c.key) keys.push(c.key);
      if (st.t !== null && !timeAt.has(c.key)) timeAt.set(c.key, st.t);
      if (first === null && st.t !== null) first = st.t;
    }
    if (keys.length < 2 || first === null) continue;
    const trip = trips.get(tripId);
    const dates = serviceDates.get(trip.service);
    if (!dates || dates.size === 0) continue;
    if (!routeTrips.has(trip.route)) routeTrips.set(trip.route, []);
    routeTrips.get(trip.route).push({ id: tripId, ...trip, keys, timeAt, first, dates });
  }
  const canonByKey = new Map();
  for (const c of canon.values()) canonByKey.set(c.key, c);

  // Structure de chaque ligne (sens, ordre des arrêts, jours types)
  const built = [];
  const neededShapes = new Set();
  for (const routeId of keptRoutes) {
    const list = routeTrips.get(routeId);
    if (!list || !list.length) {
      stats.sansCirculation++;
      continue;
    }
    const structure = structureRoute(list);
    if (!structure) {
      stats.sansCirculation++;
      continue;
    }
    if (looksLikeSchoolRun(structure, canonByKey)) {
      stats.lignesScolaires++;
      continue;
    }
    for (const d of structure.directions) if (d.rep.shape) neededShapes.add(d.rep.shape);
    built.push({ route: routes.get(routeId), structure });
  }

  const shapes = new Map();
  if (neededShapes.size) {
    const raw = new Map();
    await eachRow(root, 'shapes.txt', (get) => {
      const id = get('shape_id');
      if (!neededShapes.has(id)) return;
      if (!raw.has(id)) raw.set(id, []);
      raw.get(id).push([Number(get('shape_pt_sequence')), Number(get('shape_pt_lon')), Number(get('shape_pt_lat'))]);
    });
    for (const [id, pts] of raw) {
      pts.sort((a, b) => a[0] - b[0]);
      shapes.set(id, pts.filter((p) => Number.isFinite(p[1]) && Number.isFinite(p[2])).map((p) => [p[1], p[2]]));
    }
  }

  const features = [];
  for (const { route, structure } of built) {
    const agency = agencies.get(route.agency_id) || defaultAgency;
    const f = toFeature({ route, agency, structure, shapes, canonByKey, source, dataset, resource });
    if (f) features.push(f);
  }
  return { features, stats };
}

// Ordre des arrêts couvrant toutes les variantes d'un même sens
function mergedOrder(patterns) {
  const order = [];
  for (const keys of patterns) {
    let last = -1;
    for (const k of keys) {
      const idx = order.indexOf(k);
      if (idx === -1) {
        order.splice(last + 1, 0, k);
        last += 1;
      } else last = idx;
    }
  }
  return order;
}

function structureRoute(list) {
  // Sens : direction_id du flux, sinon comparaison avec la course la plus longue
  const hasDir = list.some((t) => t.dir === '0' || t.dir === '1');
  const longest = list.reduce((a, b) => (b.keys.length > a.keys.length ? b : a));
  const refPos = new Map(longest.keys.map((k, i) => [k, i]));
  for (const t of list) {
    if (hasDir) t.sens = t.dir === '1' ? 1 : 0;
    else {
      let inc = 0;
      let dec = 0;
      let prev = null;
      for (const k of t.keys) {
        const p = refPos.get(k);
        if (p === undefined) continue;
        if (prev !== null) {
          if (p > prev) inc++;
          else dec++;
        }
        prev = p;
      }
      t.sens = inc >= dec ? 0 : 1;
    }
  }

  // Jours de circulation et saison observée
  const byDate = new Map();
  list.forEach((t, i) => {
    for (const d of t.dates) {
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d).push(i);
    }
  });
  const allDates = [...byDate.keys()].sort();
  if (!allDates.length) return null;
  const future = allDates.filter((d) => d >= TODAY);
  const horsSaison = future.length === 0;
  const anchor = horsSaison ? allDates[allDates.length - 1] : future[0];

  // Saison = suite de jours de service sans interruption de plus de ECART_SAISON_JOURS
  let iA = allDates.indexOf(anchor);
  let iStart = iA;
  while (iStart > 0 && daysBetween(allDates[iStart - 1], allDates[iStart]) <= ECART_SAISON_JOURS) iStart--;
  let iEnd = iA;
  while (iEnd < allDates.length - 1 && daysBetween(allDates[iEnd], allDates[iEnd + 1]) <= ECART_SAISON_JOURS) iEnd++;
  const saison = { debut: allDates[iStart], fin: allDates[iEnd] };

  // Jours types : jeu de courses le plus fréquent sur JOURS_ECHANTILLON jours de la saison
  const winFrom = horsSaison ? addDays(anchor, -JOURS_ECHANTILLON) : anchor;
  const winTo = horsSaison ? anchor : addDays(anchor, JOURS_ECHANTILLON);
  const sample = allDates.filter((d) => d >= winFrom && d <= winTo);
  const CATS = [
    { id: 'semaine', label: 'Semaine', days: [1, 2, 3, 4, 5] },
    { id: 'samedi', label: 'Samedi', days: [6] },
    { id: 'dimanche', label: 'Dimanche', days: [0] },
  ];
  const picked = [];
  const absents = [];
  for (const cat of CATS) {
    const counts = new Map();
    for (const d of sample) {
      if (!cat.days.includes(parseYmd(d).getUTCDay())) continue;
      const sig = byDate.get(d).join(',');
      const cur = counts.get(sig) || { n: 0, date: d, trips: byDate.get(d) };
      cur.n++;
      counts.set(sig, cur);
    }
    if (!counts.size) {
      absents.push(cat.label.toLowerCase());
      continue;
    }
    const [sig, best] = [...counts.entries()].sort((a, b) => b[1].n - a[1].n || b[1].trips.length - a[1].trips.length || a[1].date.localeCompare(b[1].date))[0];
    const same = picked.find((p) => p.sig === sig);
    if (same) same.cats.push(cat.id);
    else picked.push({ sig, cats: [cat.id], date: best.date, trips: new Set(best.trips) });
  }
  const LABELS = {
    'semaine,samedi,dimanche': 'Tous les jours',
    'semaine,samedi': 'Du lundi au samedi',
    'samedi,dimanche': 'Samedi et dimanche',
    'semaine,dimanche': 'Semaine et dimanche',
  };
  const dayTypes = picked.map((p) => ({
    label: LABELS[p.cats.join(',')] || CATS.find((c) => c.id === p.cats[0]).label,
    date: p.date,
    trips: p.trips,
  }));

  // Sens : ordre fusionné des arrêts et course représentative (pour le tracé)
  const directions = [];
  for (const sens of [0, 1]) {
    const dirTrips = list.map((t, i) => ({ t, i })).filter((x) => x.t.sens === sens);
    if (!dirTrips.length) continue;
    const patterns = [...new Map(dirTrips.map((x) => [x.t.keys.join('|'), x.t.keys])).values()].sort((a, b) => b.length - a.length);
    const order = mergedOrder(patterns);
    const rep = dirTrips
      .map((x) => x.t)
      .sort((a, b) => b.keys.length - a.keys.length || Number(Boolean(b.shape)) - Number(Boolean(a.shape)))[0];
    directions.push({ sens, trips: dirTrips, order, rep });
  }
  if (!directions.length) return null;
  return { list, directions, dayTypes, absents, horsSaison, saison };
}

function periodText({ horsSaison, saison }) {
  const { debut, fin } = saison;
  if (horsSaison) return `Hors saison · dernière saison du ${dateFr(debut)} au ${dateFr(fin)}`;
  if (daysBetween(debut, fin) >= 330) return `Toute l'année · horaires publiés jusqu'au ${dateFr(fin)}`;
  if (debut > TODAY) return `Du ${dateFr(debut)} au ${dateFr(fin)} (saison pas encore commencée)`;
  return `Du ${dateFr(debut)} au ${dateFr(fin)}`;
}

function toFeature({ route, agency, structure, shapes, canonByKey, source, dataset, resource }) {
  const mode = modeFor(route.route_type, source);
  const ref = route.route_short_name || route.route_long_name || route.route_id;
  const longName = (route.route_long_name || '').replace(/\s*(<>|->|>)\s*/g, ' ↔ ');
  const name = route.route_short_name && longName ? `Ligne ${route.route_short_name} : ${longName}` : `Ligne ${ref}`;

  const directions = structure.directions.map((d) => {
    const stopsInfo = d.order.map((k) => canonByKey.get(k));
    const origin = stopsInfo[0].name;
    const destination = stopsInfo[stopsInfo.length - 1].name;

    const timetables = structure.dayTypes
      .map((dt) => {
        const active = d.trips
          .filter((x) => dt.trips.has(x.i))
          .map((x) => x.t)
          .sort((a, b) => a.first - b.first);
        if (!active.length) return null;
        const cols = active.slice(0, MAX_DEPARTS);
        const rows = d.order
          .map((k) => ({
            stop: canonByKey.get(k).name,
            times: cols.map((t) => (t.timeAt.has(k) ? formatMinutes(t.timeAt.get(k)) : '')),
          }))
          .filter((r) => r.times.some(Boolean));
        const notes = [`Horaires du ${jourFr(dt.date)}, jour type « ${dt.label.toLowerCase()} »${structure.horsSaison ? ' de la dernière saison' : ''}.`];
        if (active.length > MAX_DEPARTS) notes.push(`${active.length} départs ce jour-là : seuls les ${MAX_DEPARTS} premiers sont affichés.`);
        notes.push('Les horaires peuvent changer pendant les vacances scolaires et les jours fériés.');
        return { label: dt.label, date: isoDate(dt.date), departs: active.length, title: `Horaires · ${dt.label}`, rows, note: notes.join(' ') };
      })
      .filter(Boolean);

    const firstTable = timetables[0];
    const stopPoints = d.order.map((k) => {
      const c = canonByKey.get(k);
      const row = firstTable?.rows.find((r) => r.stop === c.name);
      const times = row ? row.times.filter(Boolean) : [];
      return {
        name: c.name,
        lat: Math.round(c.lat * 1e6) / 1e6,
        lng: Math.round(c.lng * 1e6) / 1e6,
        time: times.length ? times.slice(0, 6).join(' | ') + (times.length > 6 ? ' | …' : '') : undefined,
      };
    });

    const shape = d.rep.shape && shapes.get(d.rep.shape);
    const officialShape = Boolean(shape && shape.length >= 2);
    const coordinates = simplify(officialShape ? shape : stopPoints.map((s) => [s.lng, s.lat]));

    return {
      id: d.sens === 1 ? 'retour' : 'aller',
      name: `Vers ${destination}`,
      origin,
      destination,
      stops: stopPoints.map((s) => s.name),
      stopPoints,
      coordinates,
      timetables, // le panneau de la carte affiche ces grilles par jour type
      officialShape,
    };
  });

  const aller = directions[0];
  if (!aller || aller.stopPoints.length < 2) return null;

  const freq = structure.dayTypes
    .map((dt) => {
      const n = structure.directions[0].trips.filter((x) => dt.trips.has(x.i)).length;
      return n ? `${dt.label} : ${n} départ${n > 1 ? 's' : ''}` : null;
    })
    .filter(Boolean);
  for (const a of structure.absents) freq.push(`${a.charAt(0).toUpperCase()}${a.slice(1)} : pas de service`);

  const xs = aller.coordinates.map((c) => c[0]);
  const ys = aller.coordinates.map((c) => c[1]);

  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: aller.coordinates },
    properties: {
      id: `v2-${dataset.id.slice(-6)}-${slug(route.route_id) || 'ligne'}`,
      ref,
      name,
      mode,
      operator: agency?.name || '',
      network: source.reseau,
      route: `${aller.origin} ↔ ${aller.destination}`,
      frequency: `${freq.join(' · ')} (sens ${aller.destination})`,
      period: periodText(structure),
      color: routeColor(route, source, mode),
      url: route.route_url || agency?.url || dataset.page_url,
      offset: 0,
      stops: aller.stops,
      stopPoints: aller.stopPoints,
      directions: directions.map(({ officialShape: _officialShape, ...d }) => d),
      horsSaison: structure.horsSaison,
      validite: { debut: isoDate(structure.saison.debut), fin: isoDate(structure.saison.fin) },
      traceOfficiel: directions.every((d) => d.officialShape),
      source: {
        jeu: dataset.title,
        page: dataset.page_url,
        ressource: resource.id,
        miseAJour: String(resource.updated || '').slice(0, 10),
      },
      _centre: [(Math.min(...ys) + Math.max(...ys)) / 2, (Math.min(...xs) + Math.max(...xs)) / 2],
      _cle: `${agency?.name || ''}|${ref}|${longName}`,
      _courses: structure.list.length,
    },
  };
}

// Plusieurs ressources d'un même jeu peuvent décrire la même ligne (saisons, mises à jour)
function dedupe(features) {
  const best = new Map();
  for (const f of features) {
    const p = f.properties;
    const cur = best.get(p._cle);
    const score = (x) => [x.properties.horsSaison ? 0 : 1, x.properties.validite.fin, x.properties._courses];
    if (!cur) best.set(p._cle, f);
    else {
      const [a, b] = [score(f), score(cur)];
      if (a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])))) best.set(p._cle, f);
    }
  }
  // Identifiants uniques
  const seen = new Map();
  return [...best.values()].map((f) => {
    const id = f.properties.id;
    const n = seen.get(id) || 0;
    seen.set(id, n + 1);
    if (n) f.properties.id = `${id}-${n + 1}`;
    return f;
  });
}

// Un même train peut être publié par la région et dans le flux national SNCF :
// à arrêts quasi identiques (Jaccard ≥ 0,75), on garde la source listée en premier dans sources.cjs
function findDuplicateTrains(features, sources) {
  const rank = new Map(sources.map((s, i) => [s.reseau, i]));
  const trains = features
    .filter((f) => f.properties.mode === 'train')
    .map((f) => ({ f, set: new Set(f.properties.directions.flatMap((d) => d.stops).map(normName)), rank: rank.get(f.properties.network) ?? 99 }))
    .sort((a, b) => a.rank - b.rank || b.set.size - a.set.size);
  const drop = new Set();
  for (let i = 0; i < trains.length; i++) {
    if (drop.has(trains[i].f)) continue;
    for (let j = i + 1; j < trains.length; j++) {
      if (drop.has(trains[j].f)) continue;
      const a = trains[i].set;
      const b = trains[j].set;
      let inter = 0;
      for (const s of b) if (a.has(s)) inter++;
      const jaccard = inter / (a.size + b.size - inter);
      if (Math.min(a.size, b.size) >= 3 && jaccard >= 0.75) drop.add(trains[j].f);
    }
  }
  return drop;
}

// ---------------------------------------------------------------------------
// Programme principal
// ---------------------------------------------------------------------------

async function main() {
  const only = process.argv.includes('--source') ? process.argv[process.argv.indexOf('--source') + 1] : null;
  const sources = SOURCES.filter((s) => s.actif !== false && (!only || s.id === only));
  const huts = loadHebergements();

  // Meilleur arrêt officiel de chaque hébergement, d'après la collecte de l'étape 1
  if (!fs.existsSync(PATHS.arrets)) throw new Error("Lancer d'abord scripts/transport_v2/1_collecter_sources.cjs");
  const officialStops = readJson(PATHS.arrets).filter((s) => !/covoiturage|maritime|ferries|scolaire|agr[ée]gat/i.test(s.d));
  const officialIndex = new GridIndex(officialStops);
  for (const h of huts) h.meilleurArretKm = officialIndex.nearest(h.lat, h.lng, RAYON_KM)?.km ?? null;
  const hutIndex = new GridIndex(huts);

  console.log('📚 Catalogue transport.data.gouv.fr…');
  const catalogue = await fetchJson('https://transport.data.gouv.fr/api/datasets');
  writeJson(PATHS.datasets, catalogue);
  const byId = new Map(catalogue.map((d) => [d.id, d]));

  const jobs = [];
  const report = [];
  for (const source of sources) {
    const dataset = byId.get(source.id);
    if (!dataset) {
      report.push({ source, erreur: 'Jeu de données introuvable dans le catalogue', ressources: [] });
      continue;
    }
    const resources = pickResources(dataset);
    const entry = { source, dataset, ressources: resources.map((r) => ({ r })), features: [] };
    report.push(entry);
    for (const r of entry.ressources) jobs.push({ entry, item: r });
  }

  console.log(`⬇️  ${jobs.length} flux GTFS à vérifier pour ${sources.length} sources…`);
  let nouveaux = 0;
  await mapLimit(jobs, 4, async ({ item }) => {
    try {
      const res = await ensureResource(item.r);
      item.root = res.root;
      item.zipPath = res.zipPath;
      if (res.downloaded) nouveaux++;
    } catch (err) {
      item.erreur = err.message;
    }
  });
  console.log(`   ✓ ${nouveaux} téléchargés, ${jobs.length - nouveaux} déjà à jour en cache`);

  const all = [];
  for (const entry of report) {
    if (!entry.dataset) continue;
    for (const item of entry.ressources) {
      if (!item.root) continue;
      const t0 = Date.now();
      try {
        let root = item.root;
        if (isEmptyFeed(root)) {
          // Flux vide entre deux saisons : on repart de la dernière version remplie archivée
          const version = pickArchived(item.r.id);
          if (version) {
            root = extractArchived(item.r.id, version);
            item.archive = version;
          }
        } else if (shouldArchive(entry.source)) {
          const r = await archiveZip({
            resourceId: item.r.id,
            datasetId: entry.dataset.id,
            titre: entry.dataset.title,
            versionDate: item.r.updated || NOW.toISOString(),
            url: item.r.url,
            origine: 'téléchargement',
            zipPath: item.zipPath,
          });
          if (r.ajoutee) console.log(`🗄️  ${entry.source.reseau} : nouvelle version archivée (${r.mesures.debut} → ${r.mesures.fin})`);
        }
        const { features, stats } = await buildResource(root, { source: entry.source, dataset: entry.dataset, resource: item.r, hutIndex });
        if (item.archive) {
          for (const f of features) {
            f.properties.source.miseAJour = item.archive.versionDate.slice(0, 10);
            f.properties.source.archive = { date: item.archive.versionDate.slice(0, 10), origine: item.archive.origine, url: item.archive.url };
          }
        }
        item.stats = stats;
        entry.features.push(...features);
        console.log(`🚌 ${entry.source.reseau.padEnd(42)} ressource ${String(item.r.id).padEnd(6)} ${String(features.length).padStart(4)} lignes (${Date.now() - t0} ms)`);
      } catch (err) {
        item.erreur = err.message;
        console.log(`❌ ${entry.source.reseau} ressource ${item.r.id} : ${err.message}`);
      }
    }
    entry.features = dedupe(entry.features);
    all.push(...entry.features);
  }

  const doublons = findDuplicateTrains(all, sources);
  for (const entry of report) if (entry.features) entry.features = entry.features.filter((f) => !doublons.has(f));
  all.splice(0, all.length, ...all.filter((f) => !doublons.has(f)));
  report.doublonsTrains = doublons.size;

  // Navettes hors open data, relevées à la main sur leurs documents officiels
  const navettes = buildNavettes(isoDate(TODAY));
  all.push(...navettes.features);
  report.navettes = navettes.rapport;
  for (const r of navettes.rapport) {
    if (r.erreurs.length) console.log(`❌ Navette ${r.n.id || '(sans id)'} écartée : ${r.erreurs.join(' ; ')}`);
  }
  console.log(`🚐 ${navettes.features.length} navettes hors open data ajoutées`);

  // Écriture des fichiers publics
  const index = all.map((f) => {
    const p = f.properties;
    return {
      id: p.id,
      name: p.name,
      ref: p.ref,
      mode: p.mode,
      network: p.network,
      route: p.route,
      color: p.color,
      stops: p.stops,
      centerLat: Math.round(p._centre[0] * 1e6) / 1e6,
      centerLng: Math.round(p._centre[1] * 1e6) / 1e6,
      isTransport: true,
    };
  });
  for (const f of all) {
    delete f.properties._centre;
    delete f.properties._cle;
    delete f.properties._courses;
  }
  // Carte légère (tracé, arrêts, infos de base) + une fiche par ligne (sens, arrêts, horaires) chargée au clic
  fs.rmSync(OUT.lignes, { recursive: true, force: true }); // dossier entièrement généré par ce script
  fs.mkdirSync(OUT.lignes, { recursive: true });
  for (const f of all) {
    const p = f.properties;
    fs.writeFileSync(path.join(OUT.lignes, `${p.id}.json`), JSON.stringify({ id: p.id, directions: p.directions }), 'utf8');
    p.horaires = p.directions.some((d) => (d.timetables || []).some((t) => t.rows.length));
    p.detail = `/transports_v2/lignes/${p.id}.json`;
    delete p.directions;
  }
  const geojson = { type: 'FeatureCollection', name: 'transports_v2', generatedAt: NOW.toISOString(), features: all };
  fs.writeFileSync(OUT.reseau, JSON.stringify(geojson), 'utf8');
  fs.writeFileSync(OUT.index, JSON.stringify(index), 'utf8');

  const metadata = {
    title: 'Réseau de transport alpin (sources officielles)',
    generatedAt: NOW.toISOString(),
    rayonKm: RAYON_KM,
    lignes: all.length,
    lignesHorsSaison: all.filter((f) => f.properties.horsSaison).length,
    lignesSansTraceOfficiel: all.filter((f) => !f.properties.traceOfficiel).length,
    navettesHorsOpenData: all.filter((f) => f.properties.manuel).length,
    sources: report.map((e) => ({
      id: e.source.id,
      reseau: e.source.reseau,
      jeu: e.dataset?.title || null,
      page: e.dataset?.page_url || null,
      lignes: e.features?.length || 0,
      ressources: e.ressources.map((it) => ({
        id: it.r.id,
        debut: it.r.metadata?.start_date || null,
        fin: it.r.metadata?.end_date || null,
        miseAJour: String(it.r.updated || '').slice(0, 10),
        archive: it.archive ? { version: it.archive.versionDate.slice(0, 10), debut: it.archive.debut, fin: it.archive.fin } : null,
        erreur: it.erreur || null,
      })),
      erreur: e.erreur || null,
    })),
  };
  fs.writeFileSync(OUT.meta, JSON.stringify(metadata, null, 2), 'utf8');
  fs.mkdirSync(DOCS_DIR, { recursive: true });
  fs.writeFileSync(OUT.rapport, buildReport(report, all), 'utf8');

  const mo = (f) => Math.round((fs.statSync(f).size / 1e6) * 10) / 10;
  console.log(`\n✅ ${all.length} lignes · ${metadata.lignesHorsSaison} hors saison · ${metadata.lignesSansTraceOfficiel} sans tracé officiel`);
  console.log(`📦 ${path.relative(ROOT, OUT.reseau)} : ${mo(OUT.reseau)} Mo · index ${mo(OUT.index)} Mo`);
  console.log(`📄 ${path.relative(ROOT, OUT.rapport)}`);
}

function buildReport(report, all) {
  const L = [];
  const md = (s) => String(s ?? '').replace(/\|/g, '/');
  L.push('# Transport : construction du réseau à partir des sources officielles');
  L.push('');
  L.push(`*Étape 2 du chantier « Transport v2 » — généré le ${isoDate(TODAY)} par \`scripts/transport_v2/3_construire_reseau.cjs\`.*`);
  L.push('');
  L.push('## En bref');
  L.push('');
  L.push(`- **${all.length} lignes** construites depuis ${report.filter((e) => e.features?.length).length} sources officielles. Une ligne est gardée si elle offre l'un des meilleurs accès à un refuge, une cabane ou un gîte : un arrêt à moins de ${RAYON_KM} km, au plus ${String(MARGE_KM).replace('.', ',')} km plus loin que l'arrêt officiel le plus proche de cet hébergement.`);
  L.push(`- **${all.filter((f) => f.properties.horsSaison).length} lignes hors saison** : leur flux ne contient plus de date à venir. Elles sont affichées avec les horaires de leur dernière saison et la mention « Hors saison ».`);
  L.push(`- **${all.filter((f) => !f.properties.traceOfficiel).length} lignes sans tracé officiel** : le flux ne fournit pas le dessin de la ligne, elle est tracée d'arrêt en arrêt.`);
  if (report.doublonsTrains) L.push(`- **${report.doublonsTrains} trains en double écartés** : publiés à la fois par la région et dans le flux national SNCF.`);
  L.push('- Les circuits scolaires sont écartés, y compris ceux qui ne sont pas déclarés comme tels (service en semaine uniquement, 1 ou 2 départs, terminus dans un collège, un lycée ou une école).');
  if (report.navettes?.length) {
    const ok = report.navettes.filter((r) => !r.erreurs.length).length;
    L.push(`- **${ok} navettes hors open data** ajoutées à la main avec leur source officielle (voir plus bas)${ok < report.navettes.length ? `, ${report.navettes.length - ok} écartées car incomplètes` : ''}.`);
  }
  const archivees = report.filter((e) => e.ressources.some((it) => it.archive));
  if (archivees.length) {
    L.push(`- **${archivees.length} sources publient un flux vide** en ce moment (${archivees.map((e) => e.source.reseau).join(', ')}) : l'éditeur retire ses lignes entre deux saisons. Leur dernière version remplie, gardée dans \`scripts/transport_v2/archives/\`, est affichée en « Hors saison ».`);
  }
  const vides = report.filter((e) => e.ressources.length && e.ressources.every((it) => it.stats && it.stats.lignesFlux === 0));
  if (vides.length) {
    L.push(`- **${vides.length} sources publient un flux vide sans version archivée** (${vides.map((e) => e.source.reseau).join(', ')}) : lancer \`node scripts/transport_v2/archiver_historique.cjs\` pour récupérer leur historique.`);
  }
  L.push('- Chaque grille horaire correspond à un **jour type réel** (semaine, samedi, dimanche) et chaque colonne à **un même départ**.');
  L.push('');
  L.push('## Sources');
  L.push('');
  L.push('| Réseau | Lignes | Hors saison | Sans tracé | Ressources utilisées | Remarques |');
  L.push('|---|---|---|---|---|---|');
  for (const e of report) {
    const feats = e.features || [];
    const res = e.ressources
      .map((it) => {
        const m = it.r.metadata || {};
        return `${it.r.id}${m.start_date ? ` (${m.start_date} → ${m.end_date})` : ''}`;
      })
      .join(', ');
    const remarks = [];
    if (e.erreur) remarks.push(e.erreur);
    for (const it of e.ressources) {
      if (it.erreur) remarks.push(`ressource ${it.r.id} : ${it.erreur}`);
      if (it.archive) remarks.push(`${it.r.id} : flux vide en ce moment, version archivée du ${it.archive.versionDate.slice(0, 10)} utilisée (${it.archive.debut} → ${it.archive.fin})`);
      if (it.stats && it.stats.lignesFlux === 0) {
        remarks.push(`${it.r.id} : flux vide, l'éditeur ne publie aucune ligne en ce moment (entre deux saisons)`);
      } else if (it.stats) {
        const s = it.stats;
        const parts = [`${s.lignesProches}/${s.lignesFlux} lignes près des refuges`];
        if (s.lignesScolaires) parts.push(`${s.lignesScolaires} scolaires écartées`);
        if (s.lignesFiltrees) parts.push(`${s.lignesFiltrees} écartées par le filtre`);
        if (s.sansCirculation) parts.push(`${s.sansCirculation} sans circulation`);
        remarks.push(`${it.r.id} : ${parts.join(', ')}`);
      }
    }
    L.push(
      `| ${e.dataset ? `[${md(e.source.reseau)}](${e.dataset.page_url})` : md(e.source.reseau)} | ${feats.length} | ${feats.filter((f) => f.properties.horsSaison).length} | ${feats.filter((f) => !f.properties.traceOfficiel).length} | ${md(res)} | ${md(remarks.join(' ; '))} |`
    );
  }
  L.push('');
  if (report.navettes?.length) {
    L.push('## Navettes hors open data');
    L.push('');
    L.push("Navettes absentes de transport.data.gouv.fr, relevées à la main sur leur document officiel (`scripts/transport_v2/navettes_hors_open_data.json`, format décrit dans `docs/transport/navettes_hors_open_data.md`). Sur la carte, elles portent la mention « Hors open data » et le nom de leur source.");
    L.push('');
    L.push('| Navette | Saison | Statut | Source | Tracé | Remarques |');
    L.push('|---|---|---|---|---|---|');
    for (const r of report.navettes) {
      const n = r.n;
      L.push(
        `| ${md(n.nom || n.id)} | ${md(n.saison ? `${n.saison.debut} → ${n.saison.fin}` : '–')} | ${md(STATUTS_NAVETTES[n.statut] || n.statut)} | ${n.source?.url ? `[${md(n.source.titre)}](${n.source.url}), consultée le ${n.source.consulteLe}` : '–'} | ${r.erreurs.length ? '–' : r.traceCalculee ? 'réseau routier' : "d'arrêt en arrêt"} | ${md(r.erreurs.length ? `Écartée : ${r.erreurs.join(' ; ')}` : '')} |`
      );
    }
    L.push('');
  }
  L.push('## Relancer la construction');
  L.push('');
  L.push('```bash');
  L.push('node scripts/transport_v2/navettes_tracer.cjs');
  L.push('node scripts/transport_v2/3_construire_reseau.cjs');
  L.push('```');
  L.push('');
  L.push("Les flux sont gardés en cache dans `imports/transport_v2/gtfs/` et ne sont retéléchargés que lorsque l'éditeur publie une nouvelle version. Pour ajouter, retirer ou régler une source : `scripts/transport_v2/sources.cjs`. Le premier script ne recalcule que les tracés des navettes dont les arrêts ont changé.");
  L.push('');
  return L.join('\n');
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
