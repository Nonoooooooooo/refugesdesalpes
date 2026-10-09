const fs = require('fs');
const readline = require('readline');
const path = require('path');

// ============================================================================
// PARSER GTFS UNIFIÉ HAUTE FIDÉLITÉ
// ============================================================================

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

async function loadStops(filePath) {
  const stops = {};
  if (!fs.existsSync(filePath)) return stops;
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  let headers = null;
  let idIdx = -1, nameIdx = -1, latIdx = -1, lonIdx = -1;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const parts = parseCSVLine(line);
    if (!headers) {
      headers = parts.map(h => h.replace(/^\uFEFF/, '').trim());
      idIdx = headers.indexOf('stop_id');
      nameIdx = headers.indexOf('stop_name');
      latIdx = headers.indexOf('stop_lat');
      lonIdx = headers.indexOf('stop_lon');
      continue;
    }
    const id = parts[idIdx];
    const name = parts[nameIdx];
    const lat = parseFloat(parts[latIdx]);
    const lon = parseFloat(parts[lonIdx]);
    if (id && !isNaN(lat) && !isNaN(lon)) {
      stops[id] = {
        id,
        name: (name || id).replace(/"/g, '').trim(),
        lat: Number(lat.toFixed(6)),
        lng: Number(lon.toFixed(6))
      };
    }
  }
  return stops;
}

async function loadShapes(filePath, filterShapeIds = null) {
  const shapes = {};
  if (!fs.existsSync(filePath)) return shapes;
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  let headers = null;
  let idIdx = -1, latIdx = -1, lonIdx = -1, seqIdx = -1;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const parts = parseCSVLine(line);
    if (!headers) {
      headers = parts.map(h => h.replace(/^\uFEFF/, '').trim());
      idIdx = headers.indexOf('shape_id');
      latIdx = headers.indexOf('shape_pt_lat');
      lonIdx = headers.indexOf('shape_pt_lon');
      seqIdx = headers.indexOf('shape_pt_sequence');
      continue;
    }
    const id = parts[idIdx];
    if (filterShapeIds && !filterShapeIds.has(id)) continue;
    const lat = parseFloat(parts[latIdx]);
    const lon = parseFloat(parts[lonIdx]);
    const seq = parseInt(parts[seqIdx]) || 0;
    if (id && !isNaN(lat) && !isNaN(lon)) {
      if (!shapes[id]) shapes[id] = [];
      shapes[id].push({ lat, lon, seq });
    }
  }

  for (const sId of Object.keys(shapes)) {
    shapes[sId].sort((a, b) => a.seq - b.seq);
    shapes[sId] = shapes[sId].map(pt => [Number(pt.lon.toFixed(6)), Number(pt.lat.toFixed(6))]);
  }
  return shapes;
}

async function loadRoutes(filePath) {
  const routes = {};
  if (!fs.existsSync(filePath)) return routes;
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  let headers = null;
  let idIdx = -1, shortIdx = -1, longIdx = -1, colorIdx = -1;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const parts = parseCSVLine(line);
    if (!headers) {
      headers = parts.map(h => h.replace(/^\uFEFF/, '').trim());
      idIdx = headers.indexOf('route_id');
      shortIdx = headers.indexOf('route_short_name');
      longIdx = headers.indexOf('route_long_name');
      colorIdx = headers.indexOf('route_color');
      continue;
    }
    const id = parts[idIdx];
    const shortName = (parts[shortIdx] || id).replace(/"/g, '').trim();
    const longName = (parts[longIdx] || shortName).replace(/"/g, '').trim();
    let color = colorIdx !== -1 && parts[colorIdx] ? '#' + parts[colorIdx].replace('#', '') : null;
    if (color && (color.toLowerCase() === '#ffffff' || color.toLowerCase() === '#000000')) color = null;
    routes[id] = { id, shortName, longName, color, trips: {} };
  }
  return routes;
}

async function loadTrips(filePath, routes) {
  if (!fs.existsSync(filePath)) return;
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  let headers = null;
  let rIdIdx = -1, tIdIdx = -1, headIdx = -1, dirIdx = -1, shIdIdx = -1;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const parts = parseCSVLine(line);
    if (!headers) {
      headers = parts.map(h => h.replace(/^\uFEFF/, '').trim());
      rIdIdx = headers.indexOf('route_id');
      tIdIdx = headers.indexOf('trip_id');
      headIdx = headers.indexOf('trip_headsign');
      dirIdx = headers.indexOf('direction_id');
      shIdIdx = headers.indexOf('shape_id');
      continue;
    }
    const rId = parts[rIdIdx];
    const tId = parts[tIdIdx];
    if (!routes[rId]) continue;
    const headsign = headIdx !== -1 ? (parts[headIdx] || '').replace(/"/g, '').trim() : '';
    const dirId = dirIdx !== -1 ? parseInt(parts[dirIdx]) : 0;
    const shapeId = shIdIdx !== -1 ? parts[shIdIdx] : null;

    routes[rId].trips[tId] = {
      tId,
      headsign,
      dirId: isNaN(dirId) ? 0 : dirId,
      shapeId,
      stoptimes: []
    };
  }
}

async function loadStopTimes(filePath, routes) {
  if (!fs.existsSync(filePath)) return;
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  let headers = null;
  let tIdIdx = -1, depIdx = -1, sIdIdx = -1, seqIdx = -1;

  // Optimisation: index trip_id -> route
  const tripToRoute = new Map();
  for (const r of Object.values(routes)) {
    for (const tId of Object.keys(r.trips)) {
      tripToRoute.set(tId, r);
    }
  }

  for await (const line of rl) {
    if (!line.trim()) continue;
    const parts = parseCSVLine(line);
    if (!headers) {
      headers = parts.map(h => h.replace(/^\uFEFF/, '').trim());
      tIdIdx = headers.indexOf('trip_id');
      depIdx = headers.indexOf('departure_time');
      sIdIdx = headers.indexOf('stop_id');
      seqIdx = headers.indexOf('stop_sequence');
      continue;
    }
    const tId = parts[tIdIdx];
    const r = tripToRoute.get(tId);
    if (!r) continue;
    const trip = r.trips[tId];
    if (!trip) continue;

    const dep = depIdx !== -1 && parts[depIdx] ? parts[depIdx].slice(0, 5) : '';
    const sId = parts[sIdIdx];
    const seq = seqIdx !== -1 ? parseInt(parts[seqIdx]) || 0 : 0;
    trip.stoptimes.push({ sId, dep, seq });
  }

  // Trier les arrêts de chaque trip
  for (const r of Object.values(routes)) {
    for (const trip of Object.values(r.trips)) {
      trip.stoptimes.sort((a, b) => a.seq - b.seq);
    }
  }
}

// Nettoyage et simplification géométrique légère préservant tous les lacets
function simplifyPolyline(coords, toleranceMeters = 3) {
  if (!coords || coords.length <= 2) return coords;
  // Conserver les points essentiels pour garder 100% de la fidélité de la route
  const res = [coords[0]];
  for (let i = 1; i < coords.length - 1; i++) {
    const prev = res[res.length - 1];
    const cur = coords[i];
    const dLng = (cur[0] - prev[0]) * 78000;
    const dLat = (cur[1] - prev[1]) * 111000;
    if (Math.hypot(dLng, dLat) >= toleranceMeters) {
      res.push(cur);
    }
  }
  res.push(coords[coords.length - 1]);
  return res;
}

// Construction des directions et branches d'une ligne
function processRouteFeatures(r, stops, shapes, meta) {
  const tripList = Object.values(r.trips);
  if (tripList.length === 0) return null;

  // Séparer les trips par direction_id (0 = aller, 1 = retour)
  const dir0Trips = tripList.filter(t => t.dirId === 0);
  const dir1Trips = tripList.filter(t => t.dirId === 1);

  // Fonction pour construire une branche à partir d'une collection de trips
  function buildBranch(tripsForBranch, defaultDirName) {
    if (tripsForBranch.length === 0) return null;
    // Trier par nombre d'arrêts décroissant pour trouver le trip le plus complet
    tripsForBranch.sort((a, b) => b.stoptimes.length - a.stoptimes.length);
    const primaryTrip = tripsForBranch[0];
    if (!primaryTrip || primaryTrip.stoptimes.length < 2) return null;

    // Déterminer la géométrie (shape)
    let branchCoords = null;
    if (primaryTrip.shapeId && shapes[primaryTrip.shapeId]) {
      branchCoords = shapes[primaryTrip.shapeId];
    } else {
      // Chercher n'importe quel trip avec shape
      for (const t of tripsForBranch) {
        if (t.shapeId && shapes[t.shapeId] && shapes[t.shapeId].length >= 2) {
          branchCoords = shapes[t.shapeId];
          break;
        }
      }
    }

    // Arrêts ordonnés du trip principal
    const orderedStops = [];
    const orderedStopPoints = [];
    const stopTimesMap = {};

    // Collecter les horaires de tous les trips de cette branche
    for (const t of tripsForBranch) {
      for (const st of t.stoptimes) {
        const s = stops[st.sId];
        if (!s) continue;
        if (st.dep) {
          if (!stopTimesMap[s.name]) stopTimesMap[s.name] = new Set();
          stopTimesMap[s.name].add(st.dep);
        }
      }
    }

    const seenInBranch = new Set();
    for (const st of primaryTrip.stoptimes) {
      const s = stops[st.sId];
      if (!s || seenInBranch.has(s.name)) continue;
      seenInBranch.add(s.name);
      orderedStops.push(s.name);
      const times = stopTimesMap[s.name] ? [...stopTimesMap[s.name]].sort() : [];
      orderedStopPoints.push({
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        time: times.length > 0 ? times.slice(0, 8).join(' | ') : undefined
      });
    }

    if (orderedStopPoints.length < 2) return null;

    // Si pas de shape_id, utiliser les tracés routiers précis fournis dans meta.customShapes ou fallback
    if (!branchCoords || branchCoords.length < 2) {
      if (meta.customShapes && (meta.customShapes[r.id] || meta.customShapes[r.shortName])) {
        branchCoords = meta.customShapes[r.id] || meta.customShapes[r.shortName];
      } else {
        branchCoords = orderedStopPoints.map(sp => [sp.lng, sp.lat]);
      }
    }

    branchCoords = simplifyPolyline(branchCoords, 2.5);

    const origin = orderedStops[0];
    const destination = orderedStops[orderedStops.length - 1];
    const branchName = primaryTrip.headsign ? `Vers ${primaryTrip.headsign}` : `Vers ${destination}`;

    const timetableRows = orderedStopPoints.map(sp => {
      const times = stopTimesMap[sp.name] ? [...stopTimesMap[sp.name]].sort() : [];
      return {
        stop: sp.name,
        times: times.slice(0, 14)
      };
    });

    return {
      branchName,
      headsign: primaryTrip.headsign || destination,
      origin,
      destination,
      stops: orderedStops,
      stopPoints: orderedStopPoints,
      coordinates: branchCoords,
      timetable: {
        title: `Horaires - ${branchName}`,
        rows: timetableRows
      }
    };
  }

  // Grouper en branches selon le headsign ou destination
  function extractBranches(trips, dirName) {
    const groups = {};
    for (const t of trips) {
      const key = (t.headsign || 'Standard').trim().toUpperCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    const branches = [];
    for (const [key, tGroup] of Object.entries(groups)) {
      const b = buildBranch(tGroup, dirName);
      if (b) branches.push(b);
    }
    return branches;
  }

  const branchesDir0 = extractBranches(dir0Trips.length > 0 ? dir0Trips : tripList, 'Aller');
  const branchesDir1 = extractBranches(dir1Trips, 'Retour');

  if (branchesDir0.length === 0 && branchesDir1.length === 0) return null;

  // Direction principale Aller
  const mainAller = branchesDir0[0] || branchesDir1[0];
  // Direction principale Retour
  let mainRetour = branchesDir1[0];
  if (!mainRetour && mainAller) {
    // Si la ligne GTFS ne définit pas direction_id 1 (ligne circulaire ou aller simple), inverser proprement
    const revStops = [...mainAller.stops].reverse();
    const revStopPoints = [...mainAller.stopPoints].reverse();
    const revCoords = [...mainAller.coordinates].reverse();
    mainRetour = {
      branchName: `Vers ${mainAller.origin}`,
      headsign: mainAller.origin,
      origin: mainAller.destination,
      destination: mainAller.origin,
      stops: revStops,
      stopPoints: revStopPoints,
      coordinates: revCoords,
      timetable: null
    };
  }

  const directions = [
    {
      id: 'aller',
      name: mainAller.branchName,
      origin: mainAller.origin,
      destination: mainAller.destination,
      stops: mainAller.stops,
      stopPoints: mainAller.stopPoints,
      coordinates: mainAller.coordinates,
      timetable: mainAller.timetable
    },
    {
      id: 'retour',
      name: mainRetour.branchName,
      origin: mainRetour.origin,
      destination: mainRetour.destination,
      stops: mainRetour.stops,
      stopPoints: mainRetour.stopPoints,
      coordinates: mainRetour.coordinates,
      timetable: mainRetour.timetable
    }
  ];

  // Regrouper toutes les branches distinctes pour le sélecteur d'interface
  const allBranches = [];
  branchesDir0.forEach((b, idx) => {
    allBranches.push({
      id: `aller-branche-${idx + 1}`,
      name: b.branchName,
      direction: 'aller',
      origin: b.origin,
      destination: b.destination,
      stops: b.stops,
      stopPoints: b.stopPoints,
      coordinates: b.coordinates,
      timetable: b.timetable
    });
  });
  branchesDir1.forEach((b, idx) => {
    allBranches.push({
      id: `retour-branche-${idx + 1}`,
      name: b.branchName,
      direction: 'retour',
      origin: b.origin,
      destination: b.destination,
      stops: b.stops,
      stopPoints: b.stopPoints,
      coordinates: b.coordinates,
      timetable: b.timetable
    });
  });

  // Géométrie principale du Feature GeoJSON : tracé principal aller
  const primaryCoordinates = mainAller.coordinates;
  const canonicalStopPoints = mainAller.stopPoints;
  const canonicalStops = mainAller.stops;

  const cleanShort = r.shortName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const featId = `${meta.idPrefix}-${cleanShort}`;
  const displayName = r.longName
    ? `Ligne ${r.shortName} : ${r.longName.replace(/ > | < > | -> /g, ' ↔ ')}`
    : `Ligne ${r.shortName}`;

  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: primaryCoordinates
    },
    properties: {
      id: featId,
      ref: r.shortName,
      name: displayName,
      mode: meta.mode || 'bus',
      operator: meta.operator || 'Cars Région',
      network: meta.network || 'Réseau Alpin',
      route: `${mainAller.origin} ↔ ${mainAller.destination}`,
      frequency: meta.frequency || 'Liaisons régulières toute la journée',
      period: meta.period || 'Toute l\'année / Saisonnier',
      color: r.color || meta.color || '#10b981',
      url: meta.url || 'https://transport.data.gouv.fr',
      offset: meta.offset || 0,
      stops: canonicalStops,
      stopPoints: canonicalStopPoints,
      timetable: mainAller.timetable,
      directions: directions,
      branches: allBranches.length > 2 ? allBranches : undefined
    }
  };
}

async function parseGenericGTFS(dirPath, meta) {
  console.log(`Processing GTFS in ${dirPath}...`);
  if (!fs.existsSync(dirPath)) {
    console.warn(`  Directory not found: ${dirPath}`);
    return [];
  }

  const stops = await loadStops(path.join(dirPath, 'stops.txt'));
  const routes = await loadRoutes(path.join(dirPath, 'routes.txt'));
  await loadTrips(path.join(dirPath, 'trips.txt'), routes);
  await loadStopTimes(path.join(dirPath, 'stop_times.txt'), routes);

  // Collecter les shapeIds nécessaires pour charger shapes.txt de façon ultra-rapide
  const neededShapes = new Set();
  for (const r of Object.values(routes)) {
    for (const t of Object.values(r.trips)) {
      if (t.shapeId) neededShapes.add(t.shapeId);
    }
  }

  const shapes = await loadShapes(path.join(dirPath, 'shapes.txt'), neededShapes.size > 0 ? neededShapes : null);

  const features = [];
  for (const r of Object.values(routes)) {
    if (meta.filterRoute && !meta.filterRoute(r)) continue;
    const feat = processRouteFeatures(r, stops, shapes, meta);
    if (feat) {
      features.push(feat);
    }
  }

  console.log(`  ✓ Built ${features.length} high-fidelity features from ${dirPath}`);
  return features;
}

module.exports = {
  parseGenericGTFS,
  loadStops,
  loadShapes,
  simplifyPolyline
};
