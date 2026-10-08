import fs from 'node:fs';
import readline from 'node:readline';

// ─── GEOMETRY UTILITIES ────────────────────────────────────────────────────────

function projectPointOnSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return a;
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return [a[0] + t * dx, a[1] + t * dy];
}

function projectPointOnPolyline(point, polylineCoords) {
  let bestPoint = polylineCoords[0];
  let bestDistSq = Infinity;
  for (let i = 0; i < polylineCoords.length - 1; i++) {
    const proj = projectPointOnSegment(point, polylineCoords[i], polylineCoords[i + 1]);
    const dx = point[0] - proj[0];
    const dy = point[1] - proj[1];
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestPoint = proj;
    }
  }
  return {
    proj: [Number(bestPoint[0].toFixed(6)), Number(bestPoint[1].toFixed(6))],
    distMeters: Math.sqrt(bestDistSq) * 111320
  };
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const [x, y] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag === 0) return Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);
  const u = ((x - x1) * dx + (y - y1) * dy) / (mag * mag);
  const ix = x1 + u * dx;
  const iy = y1 + u * dy;
  const latFactor = 111320;
  const lonFactor = 111320 * Math.cos((y * Math.PI) / 180);
  return Math.sqrt(((x - ix) * lonFactor) ** 2 + ((y - iy) * latFactor) ** 2);
}

function ramerDouglasPeucker(points, toleranceMeters) {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > toleranceMeters) {
    const left = ramerDouglasPeucker(points.slice(0, index + 1), toleranceMeters);
    const right = ramerDouglasPeucker(points.slice(index), toleranceMeters);
    return left.slice(0, -1).concat(right);
  } else {
    return [start, end];
  }
}

// ─── MAIN BUILDER ─────────────────────────────────────────────────────────────

async function main() {
  console.log('=== BUILD HAUTE-SAVOIE GTFS DATASET ===');
  const dir = 'imports/haute_savoie';
  const inseeCommunes = JSON.parse(fs.readFileSync('scripts/insee_communes.json', 'utf8'));

  // 1. STOPS
  console.log('1. Loading stops...');
  const stops = {};
  const sLines = fs.readFileSync(`${dir}/stops.txt`, 'utf8').split('\n');
  for (let i = 1; i < sLines.length; i++) {
    const line = sLines[i].trim();
    if (!line) continue;
    const parts = [];
    let cur = '', inQ = false;
    for (let c of line) {
      if (c === '"') inQ = !inQ;
      else if (c === ',' && !inQ) { parts.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    parts.push(cur.trim());

    const stopId = parts[0];
    let stopName = parts[2];
    const lat = parseFloat(parts[4]);
    const lon = parseFloat(parts[5]);

    let commune = '';
    const m = stopId.match(/FR:(\d{5}):/);
    if (m && inseeCommunes[m[1]]) {
      commune = inseeCommunes[m[1]];
    }

    // Disambiguate generic names
    const generic = ['chef-lieu', 'gare', 'centre', 'mairie', 'ecole', 'église', 'le village', 'gare routiere'];
    const lowerName = stopName.toLowerCase();
    if (commune && (generic.some(g => lowerName === g || lowerName.startsWith(g + ' ')) || !lowerName.includes(commune.toLowerCase()))) {
      if (!lowerName.includes(commune.toLowerCase())) {
        stopName = `${commune} - ${stopName}`;
      }
    }

    if (!isNaN(lat) && !isNaN(lon)) {
      stops[stopId] = { id: stopId, name: stopName, lat, lon, commune };
    }
  }

  // 2. SHAPES
  console.log('2. Streaming shapes...');
  const shapes = {};
  const shRl = readline.createInterface({ input: fs.createReadStream(`${dir}/shapes.txt`), crlfDelay: Infinity });
  let shFirst = true;
  for await (const line of shRl) {
    if (shFirst) { shFirst = false; continue; }
    if (!line.trim()) continue;
    const comma1 = line.indexOf(',');
    const comma2 = line.indexOf(',', comma1 + 1);
    const comma3 = line.indexOf(',', comma2 + 1);
    const comma4 = line.indexOf(',', comma3 + 1);

    const sId = line.slice(0, comma1).replace(/"/g, '');
    const lat = parseFloat(line.slice(comma1 + 1, comma2));
    const lon = parseFloat(line.slice(comma2 + 1, comma3));
    const seq = parseInt(line.slice(comma3 + 1, comma4 !== -1 ? comma4 : undefined));

    if (!shapes[sId]) shapes[sId] = [];
    shapes[sId].push({ lat, lon, seq });
  }
  for (const sId of Object.keys(shapes)) {
    shapes[sId].sort((a, b) => a.seq - b.seq);
  }
  console.log(`Loaded ${Object.keys(shapes).length} shapes.`);

  // 3. ROUTES
  console.log('3. Loading routes...');
  const routes = {};
  const rLines = fs.readFileSync(`${dir}/routes.txt`, 'utf8').split('\n');
  for (let i = 1; i < rLines.length; i++) {
    const line = rLines[i].trim();
    if (!line) continue;
    const parts = [];
    let cur = '', inQ = false;
    for (let c of line) {
      if (c === '"') inQ = !inQ;
      else if (c === ',' && !inQ) { parts.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    parts.push(cur.trim());
    routes[parts[0]] = {
      id: parts[0],
      shortName: parts[2],
      longName: parts[3],
      color: parts[7] ? '#' + parts[7].replace('#', '') : '#059669',
      trips: {}
    };
  }

  // 4. TRIPS
  console.log('4. Loading trips...');
  const tripsRl = readline.createInterface({ input: fs.createReadStream(`${dir}/trips.txt`), crlfDelay: Infinity });
  let tFirst = true;
  for await (const line of tripsRl) {
    if (tFirst) { tFirst = false; continue; }
    if (!line.trim()) continue;
    const parts = line.split(',').map(s => s.replace(/"/g, '').trim());
    const routeId = parts[0];
    const tripId = parts[2];
    const headsign = parts[3];
    const directionId = parts[5];
    const shapeId = parts[7];

    if (routes[routeId]) {
      routes[routeId].trips[tripId] = {
        tripId,
        headsign,
        directionId,
        shapeId,
        stoptimes: []
      };
    }
  }

  // 5. STOP TIMES
  console.log('5. Loading stop_times...');
  const stRl = readline.createInterface({ input: fs.createReadStream(`${dir}/stop_times.txt`), crlfDelay: Infinity });
  let stFirst = true;
  for await (const line of stRl) {
    if (stFirst) { stFirst = false; continue; }
    if (!line.trim()) continue;
    const parts = line.split(',').map(s => s.replace(/"/g, '').trim());
    const tripId = parts[0];
    const arrivalTime = parts[1];
    const departureTime = parts[2];
    const stopId = parts[3];
    const seq = parseInt(parts[4]);

    for (const r of Object.values(routes)) {
      if (r.trips[tripId]) {
        r.trips[tripId].stoptimes.push({
          stopId,
          departureTime: departureTime ? departureTime.slice(0, 5) : '',
          seq
        });
        break;
      }
    }
  }

  // 6. BUILD INTERURBAN ROUTES & MOUNTAIN NAVETTES
  console.log('6. Processing routes & snapping stops...');

  // Preferred shape selection per route to get the best complete route corridor
  const PREFERRED_SHAPES = {
    'Y02': '3072$1078338$19', // Annemasse -> Cirque du Fer à Cheval (60 km, 4316 pts)
    'Y03': '3072$1078347$23', // Habère-Poche -> Thonon-les-Bains
    'Y04': '3072$1078359$171', // Annemasse -> Bellevaux
    'Y13': '3072$1102436$181', // Frangy -> St-Julien
    'Y21': '3072$1078371$39',  // Annecy -> Seyssel
    'Y22': '3072$1098101$43',  // Annecy -> Valserhône
    'Y51': '3072$1101975$49',  // Annecy -> Albertville
    'Y62': '3072$1103212$61',  // Annecy -> Le Grand-Bornand
    'Y63': '3072$1103226$73',  // Annecy -> Dingy -> Thônes / Grand-Bornand
    'Y81': '3072$1077935$78',  // Chamonix -> Cluses
    'Y82': '3072$1077943$81',  // Chamonix -> Praz-sur-Arly
    'Y83': '3072$1100592$223', // Sallanches -> Flumet
    'Y84': '3072$1100624$90',  // Sallanches -> Les Contamines-Montjoie
    'Y85': '3072$1078480$91',  // Sallanches -> Passy Plaine Joux
    'Y86': '3072$1103637$102', // Sallanches -> Cordon Mairie
    'Y91': '3072$1102530$104', // Thonon-les-Bains -> Morzine -> Les Gets
    'Y92': '3072$1078515$111', // Cluses -> Morzine
    'Y93': '3072$1078011$114', // Cluses -> Taninges -> Praz de Lys
    'Y94': '3072$1078521$115', // Cluses -> Taninges -> Samoëns -> Sixt
    '272': '3072$1078253$121', // Annecy -> Genève
    '274': '3072$1098147$123', // Sallanches -> Genève-Aéroport
    'N-BAB': '3072$1077790$8', // Balad'Aulps Bus : Les Gets -> La Vernaz / Jotty
    'N-ECO': '3072$1078320$155' // EcoNavette : Taninges -> Sommand Station
  };

  const finalRoutes = [];

  for (const r of Object.values(routes)) {
    // If it's ARAVISBUS, we handle it separately below for the individual lines
    if (r.shortName === 'N-ARAVISBUS') continue;

    const chosenShapeId = PREFERRED_SHAPES[r.shortName];
    let rawCoords = chosenShapeId && shapes[chosenShapeId]
      ? shapes[chosenShapeId].map(pt => [Number(pt.lon.toFixed(6)), Number(pt.lat.toFixed(6))])
      : null;

    if (!rawCoords) {
      // Fallback: pick the longest shape for this route
      const tripList = Object.values(r.trips);
      let bestLen = 0;
      for (const t of tripList) {
        if (t.shapeId && shapes[t.shapeId] && shapes[t.shapeId].length > bestLen) {
          bestLen = shapes[t.shapeId].length;
          rawCoords = shapes[t.shapeId].map(pt => [Number(pt.lon.toFixed(6)), Number(pt.lat.toFixed(6))]);
        }
      }
    }

    if (!rawCoords || rawCoords.length < 2) {
      console.warn(`Skipping route ${r.shortName}: no shape available`);
      continue;
    }

    // Simplify polyline with Ramer-Douglas-Peucker (5m tolerance)
    const simplifiedCoords = ramerDouglasPeucker(rawCoords, 5);

    // Identify which trips use this corridor
    const tripList = Object.values(r.trips);

    // Collect all stops and their departure times across trips
    const stopTimesMap = {};
    const tripStopsOrdered = [];
    const seenStops = new Set();

    // Prefer ordering from the trip that matches the primary shape
    const primaryTrip = tripList.find(t => t.shapeId === chosenShapeId) || tripList[0];
    for (const st of primaryTrip.stoptimes) {
      if (!seenStops.has(st.stopId) && stops[st.stopId]) {
        seenStops.add(st.stopId);
        tripStopsOrdered.push(st.stopId);
      }
    }
    // Add other stops from remaining trips
    for (const t of tripList) {
      for (const st of t.stoptimes) {
        if (!seenStops.has(st.stopId) && stops[st.stopId]) {
          seenStops.add(st.stopId);
          tripStopsOrdered.push(st.stopId);
        }
        if (st.departureTime) {
          const sName = stops[st.stopId]?.name;
          if (sName) {
            if (!stopTimesMap[sName]) stopTimesMap[sName] = new Set();
            stopTimesMap[sName].add(st.departureTime);
          }
        }
      }
    }

    // Build snapped stop points (filter out any stop > 300m away to eliminate far branches/school detours)
    const stopPoints = [];
    for (const sId of tripStopsOrdered) {
      const s = stops[sId];
      if (!s) continue;
      const { proj, distMeters } = projectPointOnPolyline([s.lon, s.lat], simplifiedCoords);
      if (distMeters <= 350) {
        // Snap directly onto the polyline line!
        const times = stopTimesMap[s.name] ? [...stopTimesMap[s.name]].sort() : [];
        stopPoints.push({
          name: s.name,
          coord: proj,
          time: times.length > 0 ? times.slice(0, 6).join(' | ') : undefined
        });
      }
    }

    // Build timetable
    const timetableRows = [];
    for (const sp of stopPoints) {
      const times = stopTimesMap[sp.name] ? [...stopTimesMap[sp.name]].sort() : [];
      timetableRows.push({
        stop: sp.name,
        times: times.slice(0, 16)
      });
    }

    let mode = 'bus';
    let operator = 'Cars Région Haute-Savoie';
    let network = 'Cars Région Haute-Savoie';
    let period = 'Toute l\'année';
    let frequency = 'Régulier tous les jours';
    let color = r.color;

    if (r.shortName === 'N-BAB') {
      mode = 'navette';
      operator = 'CC Haut-Chablais / Balad\'Aulps Bus';
      network = 'Balad\'Aulps Bus';
      period = 'Saison estivale & hivernale';
      frequency = 'Navette régulière de la Vallée d\'Aulps';
      color = '#0284c7';
    } else if (r.shortName === 'N-ECO') {
      mode = 'navette';
      operator = 'Communauté de Communes des Montagnes du Giffre';
      network = 'EcoNavette du Giffre';
      period = 'Saison estivale & hivernale';
      frequency = 'Navette intercommunale Mieussy ↔ Taninges ↔ Sommand';
      color = '#10b981';
    } else if (r.shortName === '272' || r.shortName === '274') {
      operator = 'Cars Région Express / Transalis';
      network = 'Cars Région Transalis';
      frequency = 'Liaison transfrontalière France ↔ Genève';
    }

    const routeId = `bus-hs-${r.shortName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    finalRoutes.push({
      id: routeId,
      ref: r.shortName,
      name: `Ligne ${r.shortName} : ${r.longName.replace(/ > /g, ' ↔ ')}`,
      mode,
      operator,
      network,
      route: r.longName.replace(/ > /g, ' ↔ '),
      frequency,
      period,
      stops: stopPoints.map(sp => sp.name),
      stopPoints,
      color,
      directCoordinates: simplifiedCoords,
      timetable: {
        title: `Horaires officiels Cars Région Haute-Savoie - Ligne ${r.shortName}`,
        rows: timetableRows
      }
    });

    console.log(`Processed [${r.shortName}] ${r.longName}: ${simplifiedCoords.length} pts, ${stopPoints.length} stops snapped.`);
  }

  // 7. ARAVIS BUS INDIVIDUAL SHUTTLE SHAPES EXTRACTION
  console.log('\n7. Extracting Aravis Bus shapes...');
  const aravisShapesMapping = {
    'navette-aravis-1': { shapeId: '3072$1098552$127', name: 'Ligne 1 : La Clusaz ↔ Confins' },
    'navette-aravis-7': { shapeId: '3072$1098580$128', name: 'Ligne 7 : La Clusaz ↔ Col des Aravis' },
    'navette-aravis-8': { shapeId: '3072$1098595$129', name: 'Ligne 8 : La Clusaz ↔ Col de la Croix-Fry' },
    'navette-aravis-a': { shapeId: '3072$1098662$132', name: 'Ligne A : Le Grand-Bornand ↔ Le Chinaillon' },
    'navette-aravis-g': { shapeId: '3072$1098719$133', name: 'Ligne G : Le Grand-Bornand ↔ Auberge Nordique' },
    'navette-aravis-m': { shapeId: '3072$1098896$135', name: 'Ligne M : Thônes ↔ Merdassier' },
    'navette-aravis-v': { shapeId: '3072$1098622$131', name: 'Ligne V : Thônes ↔ Serraval' },
    'navette-aravis-is': { shapeId: '3072$1098706$269', name: 'Ligne IS : La Clusaz ↔ Le Grand-Bornand' }
  };

  const aravisExtracted = {};
  for (const [lineId, info] of Object.entries(aravisShapesMapping)) {
    if (shapes[info.shapeId]) {
      const raw = shapes[info.shapeId].map(pt => [Number(pt.lon.toFixed(6)), Number(pt.lat.toFixed(6))]);
      aravisExtracted[lineId] = ramerDouglasPeucker(raw, 5);
      console.log(`Aravis ${info.name}: ${raw.length} pts -> ${aravisExtracted[lineId].length} pts (RDP 5m)`);
    }
  }

  // 8. SAVE OUTPUT
  const outputData = {
    routes: finalRoutes,
    aravisShapes: aravisExtracted
  };

  fs.writeFileSync('scripts/data/haute_savoie_final.json', JSON.stringify(outputData, null, 2));
  console.log(`\nDONE! Output saved to scripts/data/haute_savoie_final.json (${(fs.statSync('scripts/data/haute_savoie_final.json').size / 1024).toFixed(1)} KB)`);
}

main().catch(console.error);
