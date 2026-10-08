import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';

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

// ─── PARSE GTFS DIRECTORY HELPER ──────────────────────────────────────────────

async function parseGTFSDir(dirPath, options = {}) {
  const {
    idPrefix = 'route',
    defaultNetwork = 'Navettes Alpins',
    defaultOperator = 'Opérateur Local',
    defaultMode = 'bus',
    defaultColor = '#0284c7',
    snapDistMax = 500
  } = options;

  console.log(`Processing ${dirPath}...`);
  if (!fs.existsSync(dirPath)) return [];

  // Stops
  const stops = {};
  if (fs.existsSync(path.join(dirPath, 'stops.txt'))) {
    const sLines = fs.readFileSync(path.join(dirPath, 'stops.txt'), 'utf8').split('\n');
    const sHeaders = sLines[0].split(',').map(s => s.replace(/"/g, '').trim());
    const idIdx = sHeaders.indexOf('stop_id');
    const nameIdx = sHeaders.indexOf('stop_name');
    const latIdx = sHeaders.indexOf('stop_lat');
    const lonIdx = sHeaders.indexOf('stop_lon');

    for (let i = 1; i < sLines.length; i++) {
      const l = sLines[i].trim();
      if (!l) continue;
      const parts = l.split(',').map(s => s.replace(/"/g, '').trim());
      const id = parts[idIdx];
      const name = parts[nameIdx];
      const lat = parseFloat(parts[latIdx]);
      const lon = parseFloat(parts[lonIdx]);
      if (id && !isNaN(lat) && !isNaN(lon)) {
        stops[id] = { id, name: name || id, lat, lon };
      }
    }
  }

  // Shapes
  const shapes = {};
  if (fs.existsSync(path.join(dirPath, 'shapes.txt'))) {
    const shRl = readline.createInterface({ input: fs.createReadStream(path.join(dirPath, 'shapes.txt')), crlfDelay: Infinity });
    let shHeaders = null;
    let sIdIdx = 0, latIdx = 1, lonIdx = 2, seqIdx = 3;

    for await (const line of shRl) {
      if (!line.trim()) continue;
      const parts = line.split(',').map(s => s.replace(/"/g, '').trim());
      if (!shHeaders) {
        shHeaders = parts;
        sIdIdx = shHeaders.indexOf('shape_id');
        latIdx = shHeaders.indexOf('shape_pt_lat');
        lonIdx = shHeaders.indexOf('shape_pt_lon');
        seqIdx = shHeaders.indexOf('shape_pt_sequence');
        continue;
      }

      const sId = parts[sIdIdx];
      const lat = parseFloat(parts[latIdx]);
      const lon = parseFloat(parts[lonIdx]);
      const seq = parseInt(parts[seqIdx]) || 0;

      if (sId && !isNaN(lat) && !isNaN(lon)) {
        if (!shapes[sId]) shapes[sId] = [];
        shapes[sId].push({ lat, lon, seq });
      }
    }
    for (const sId of Object.keys(shapes)) {
      shapes[sId].sort((a, b) => a.seq - b.seq);
    }
  }

  // Routes
  const routes = {};
  if (fs.existsSync(path.join(dirPath, 'routes.txt'))) {
    const rLines = fs.readFileSync(path.join(dirPath, 'routes.txt'), 'utf8').split('\n');
    const rHeaders = rLines[0].split(',').map(s => s.replace(/"/g, '').trim());
    const rIdIdx = rHeaders.indexOf('route_id');
    const shortIdx = rHeaders.indexOf('route_short_name');
    const longIdx = rHeaders.indexOf('route_long_name');
    const colorIdx = rHeaders.indexOf('route_color');

    for (let i = 1; i < rLines.length; i++) {
      const l = rLines[i].trim();
      if (!l) continue;
      const parts = l.split(',').map(s => s.replace(/"/g, '').trim());
      const rId = parts[rIdIdx];
      const shortName = parts[shortIdx] || rId;
      const longName = parts[longIdx] || shortName;
      let color = (colorIdx !== -1 && parts[colorIdx]) ? '#' + parts[colorIdx].replace('#', '') : defaultColor;
      if (color.toLowerCase() === '#ffffff' || color.toLowerCase() === '#000000') {
        color = defaultColor;
      }
      routes[rId] = { id: rId, shortName, longName, color, trips: {} };
    }
  }

  // Trips
  if (fs.existsSync(path.join(dirPath, 'trips.txt'))) {
    const tRl = readline.createInterface({ input: fs.createReadStream(path.join(dirPath, 'trips.txt')), crlfDelay: Infinity });
    let tHeaders = null;
    let rIdIdx = 0, tIdIdx = 2, headIdx = 3, shIdIdx = -1;

    for await (const line of tRl) {
      if (!line.trim()) continue;
      const parts = line.split(',').map(s => s.replace(/"/g, '').trim());
      if (!tHeaders) {
        tHeaders = parts;
        rIdIdx = tHeaders.indexOf('route_id');
        tIdIdx = tHeaders.indexOf('trip_id');
        headIdx = tHeaders.indexOf('trip_headsign');
        shIdIdx = tHeaders.indexOf('shape_id');
        continue;
      }
      const rId = parts[rIdIdx];
      const tId = parts[tIdIdx];
      const headsign = headIdx !== -1 ? parts[headIdx] : '';
      const shapeId = shIdIdx !== -1 ? parts[shIdIdx] : null;

      if (routes[rId]) {
        routes[rId].trips[tId] = { tId, headsign, shapeId, stoptimes: [] };
      }
    }
  }

  // Stop times
  if (fs.existsSync(path.join(dirPath, 'stop_times.txt'))) {
    const stRl = readline.createInterface({ input: fs.createReadStream(path.join(dirPath, 'stop_times.txt')), crlfDelay: Infinity });
    let stHeaders = null;
    let tIdIdx = 0, depIdx = 2, sIdIdx = 3, seqIdx = 4;

    for await (const line of stRl) {
      if (!line.trim()) continue;
      const parts = line.split(',').map(s => s.replace(/"/g, '').trim());
      if (!stHeaders) {
        stHeaders = parts;
        tIdIdx = stHeaders.indexOf('trip_id');
        depIdx = stHeaders.indexOf('departure_time');
        sIdIdx = stHeaders.indexOf('stop_id');
        seqIdx = stHeaders.indexOf('stop_sequence');
        continue;
      }

      const tId = parts[tIdIdx];
      const dep = (depIdx !== -1 && parts[depIdx]) ? parts[depIdx].slice(0, 5) : '';
      const sId = parts[sIdIdx];
      const seq = seqIdx !== -1 ? parseInt(parts[seqIdx]) : 0;

      for (const r of Object.values(routes)) {
        if (r.trips[tId]) {
          r.trips[tId].stoptimes.push({ sId, dep, seq });
          break;
        }
      }
    }
  }

  // Build each route
  const output = [];
  for (const r of Object.values(routes)) {
    const tripList = Object.values(r.trips);
    if (tripList.length === 0) continue;

    tripList.sort((a, b) => b.stoptimes.length - a.stoptimes.length);

    // Find best shape
    let bestShape = null;
    let maxShapeLen = 0;
    for (const t of tripList) {
      if (t.shapeId && shapes[t.shapeId] && shapes[t.shapeId].length > maxShapeLen) {
        maxShapeLen = shapes[t.shapeId].length;
        bestShape = shapes[t.shapeId];
      }
    }

    let directCoordinates = null;
    if (bestShape && bestShape.length >= 2) {
      const rawCoords = bestShape.map(pt => [Number(pt.lon.toFixed(6)), Number(pt.lat.toFixed(6))]);
      directCoordinates = ramerDouglasPeucker(rawCoords, 5);
    } else {
      // Fallback: use ordered stop coordinates
      const longestTrip = tripList[0];
      const pts = longestTrip.stoptimes.map(st => stops[st.sId]).filter(Boolean).map(s => [Number(s.lon.toFixed(6)), Number(s.lat.toFixed(6))]);
      if (pts.length >= 2) {
        directCoordinates = pts;
      }
    }

    if (!directCoordinates || directCoordinates.length < 2) continue;

    // Collect stops and timetables
    const stopTimesMap = {};
    const tripStopsOrdered = [];
    const seenStops = new Set();

    for (const t of tripList) {
      for (const st of t.stoptimes) {
        if (!seenStops.has(st.sId) && stops[st.sId]) {
          seenStops.add(st.sId);
          tripStopsOrdered.push(st.sId);
        }
        if (st.dep && stops[st.sId]) {
          const sName = stops[st.sId].name;
          if (!stopTimesMap[sName]) stopTimesMap[sName] = new Set();
          stopTimesMap[sName].add(st.dep);
        }
      }
    }

    // Snap stops to polyline
    const stopPoints = [];
    for (const sId of tripStopsOrdered) {
      const s = stops[sId];
      const { proj, distMeters } = projectPointOnPolyline([s.lon, s.lat], directCoordinates);
      if (distMeters <= snapDistMax) {
        const times = stopTimesMap[s.name] ? [...stopTimesMap[s.name]].sort() : [];
        stopPoints.push({
          name: s.name,
          coord: proj,
          time: times.length > 0 ? times.slice(0, 6).join(' | ') : undefined
        });
      }
    }

    if (stopPoints.length === 0) continue;

    // Build timetable rows
    const timetableRows = [];
    for (const sp of stopPoints) {
      const times = stopTimesMap[sp.name] ? [...stopTimesMap[sp.name]].sort() : [];
      timetableRows.push({
        stop: sp.name,
        times: times.slice(0, 16)
      });
    }

    const cleanShort = r.shortName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const routeId = `${idPrefix}-${cleanShort}`;

    output.push({
      id: routeId,
      ref: r.shortName,
      name: `Ligne ${r.shortName} : ${r.longName.replace(/ > | < > /g, ' ↔ ')}`,
      mode: defaultMode,
      operator: defaultOperator,
      network: defaultNetwork,
      route: r.longName.replace(/ > | < > /g, ' ↔ '),
      frequency: options.defaultFrequency || 'Service régulier',
      period: options.defaultPeriod || 'Toute l\'année / Saisonnier',
      stops: stopPoints.map(sp => sp.name),
      stopPoints,
      color: r.color,
      directCoordinates,
      timetable: {
        title: `Horaires officiels - ${r.shortName} (${defaultNetwork})`,
        rows: timetableRows
      }
    });

    console.log(`  ✓ Route [${r.shortName}] ${r.longName}: ${directCoordinates.length} pts, ${stopPoints.length} stops snapped.`);
  }

  return output;
}

// ─── MAIN EXECUTION ────────────────────────────────────────────────────────────

async function main() {
  const allNewRoutes = [];

  // 1. SAVOIE (Cars Région Savoie: S01, S03, S04, S05, S07, S10, S11 Revard, S12 Margériaz)
  const savoieRoutes = await parseGTFSDir('imports/savoie', {
    idPrefix: 'bus-savoie',
    defaultNetwork: 'Cars Région Savoie',
    defaultOperator: 'Cars Région Savoie',
    defaultMode: 'bus',
    defaultColor: '#059669',
    defaultFrequency: 'Liaison régulière interurbaine',
    defaultPeriod: 'Toute l\'année'
  });
  allNewRoutes.push(...savoieRoutes);

  // 2. BOURG-SAINT-MAURICE / LES ARCS (Lignes 1, 2, A, B, C)
  const bsmRoutes = await parseGTFSDir('imports/bourg_saint_maurice', {
    idPrefix: 'navette-arcs',
    defaultNetwork: 'Navettes Les Arcs / Haute-Tarentaise',
    defaultOperator: 'Transdev Martin',
    defaultMode: 'navette',
    defaultColor: '#0284c7',
    defaultFrequency: 'Navettes gratuites régulières',
    defaultPeriod: 'Été & Hiver'
  });
  allNewRoutes.push(...bsmRoutes);

  // 3. FUNICULAIRE DES ARCS
  const funiRoutes = await parseGTFSDir('imports/funiculaire_arcs', {
    idPrefix: 'funiculaire',
    defaultNetwork: 'Les Arcs Paradiski',
    defaultOperator: 'ADS Domaine de Montagne Les Arcs',
    defaultMode: 'cable',
    defaultColor: '#002B56',
    defaultFrequency: 'Toutes les 20 min (Liaison quai de gare TGV Bourg-St-Maurice ↔ Arc 1600)',
    defaultPeriod: 'Toute l\'année'
  });
  allNewRoutes.push(...funiRoutes);

  // 4. MERIBUS (Les 3 Vallées / Méribel: Lignes A, C, D)
  const meribusRoutes = await parseGTFSDir('imports/meribus', {
    idPrefix: 'navette-meribus',
    defaultNetwork: 'Méribus (Les 3 Vallées)',
    defaultOperator: 'Méribus / Commune des Allues',
    defaultMode: 'navette',
    defaultColor: '#ea580c',
    defaultFrequency: 'Navette gratuite toutes les 15-20 min',
    defaultPeriod: 'Été & Hiver'
  });
  allNewRoutes.push(...meribusRoutes);

  // 5. COURCHEVEL (Skibus Courchevel / 3 Vallées: Lignes A, B, C, F, H, I)
  const courchevelRoutes = await parseGTFSDir('imports/courchevel', {
    idPrefix: 'navette-courchevel',
    defaultNetwork: 'Navettes Courchevel (Les 3 Vallées)',
    defaultOperator: 'Transdev Courchevel',
    defaultMode: 'navette',
    defaultColor: '#8b5cf6',
    defaultFrequency: 'Navette gratuite inter-niveaux et hameaux',
    defaultPeriod: 'Été & Hiver'
  });
  allNewRoutes.push(...courchevelRoutes);

  // 6. VALLEE DES BELLEVILLE (Menuires / Val Thorens / Saint-Martin: Lignes Mauve, Bleue, Verte)
  const bellevilleRoutes = await parseGTFSDir('imports/belleville', {
    idPrefix: 'navette-belleville',
    defaultNetwork: 'Navettes Vallée des Belleville',
    defaultOperator: 'Transdev Belleville',
    defaultMode: 'navette',
    defaultColor: '#10b981',
    defaultFrequency: 'Navettes gratuites de la vallée',
    defaultPeriod: 'Été & Hiver'
  });
  allNewRoutes.push(...bellevilleRoutes);

  // 7. LES DEUX ALPES (Ligne 2AAN Navette Annuelle)
  const deuxAlpesRoutes = await parseGTFSDir('imports/deux_alpes', {
    idPrefix: 'navette-2alpes',
    defaultNetwork: 'Navettes Les Deux Alpes',
    defaultOperator: 'Autocars RESALP',
    defaultMode: 'navette',
    defaultColor: '#f59e0b',
    defaultFrequency: 'Navette annuelle gratuite de station',
    defaultPeriod: 'Toute l\'année'
  });
  allNewRoutes.push(...deuxAlpesRoutes);

  // 8. LA ROSIERE (Navettes station Golf & Soirée)
  const laRosiereRoutes = await parseGTFSDir('imports/la_rosiere', {
    idPrefix: 'navette-rosiere',
    defaultNetwork: 'Navettes La Rosière - Espace San Bernardo',
    defaultOperator: 'Mairie de Montvalezan',
    defaultMode: 'navette',
    defaultColor: '#06b6d4',
    defaultFrequency: 'Navette estivale gratuite',
    defaultPeriod: 'Saison estivale'
  });
  allNewRoutes.push(...laRosiereRoutes);

  console.log(`\nTOTAL NEW ROUTES PARSED: ${allNewRoutes.length}`);
  fs.writeFileSync('scripts/data/resorts_savoie_final.json', JSON.stringify(allNewRoutes, null, 2));
  console.log(`Saved output to scripts/data/resorts_savoie_final.json (${(fs.statSync('scripts/data/resorts_savoie_final.json').size / 1024).toFixed(1)} KB)`);
}

main().catch(console.error);
