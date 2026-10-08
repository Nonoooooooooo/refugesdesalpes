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

// Target alpine lines in Drôme
const TARGET_DROME_REFS = new Set([
  'D05', // Valence - Romans - Vercors
  'D24', // Valence - Crest
  'D25', // Valence - Crest - Plan de Baix
  'D27', // Bourdeaux - Crest (Saou)
  'D28', // Crest - Die
  'D29', // Beaurières - Luc-en-Diois - Die
  'D35', // Montélimar - Dieulefit - Valréas
  'D36', // Montélimar - Grignan - Nyons
  'D37', // Vaison - Nyons - La Motte-Chalancon
  'D38', // Nyons - Bellecombe-Tarendol
  'D52', // Valence TGV - Crest - Saou - Bourdeaux
  'D53'  // Valence TGV - Crest - Saillans
]);

async function buildDromeAlpine() {
  const dirPath = 'imports/drome';
  console.log('Building Drôme Alpine lines...');

  // Routes
  const routes = {};
  const rLines = fs.readFileSync(path.join(dirPath, 'routes.txt'), 'utf8').split('\n');
  for (let i = 1; i < rLines.length; i++) {
    const l = rLines[i].trim();
    if (!l) continue;
    const parts = l.split(',').map(s => s.replace(/"/g, '').trim());
    const rId = parts[0];
    const short = parts[2];
    const long = parts[3];
    const color = parts[7] ? '#' + parts[7].replace('#', '') : '#10b981';
    if (TARGET_DROME_REFS.has(short)) {
      routes[rId] = { id: rId, short, long, color, trips: {} };
    }
  }
  console.log(`Target routes matched: ${Object.keys(routes).length}`);

  // Stops
  const stops = {};
  const inseeCommunes = JSON.parse(fs.readFileSync('scripts/insee_communes.json', 'utf8'));
  const sLines = fs.readFileSync(path.join(dirPath, 'stops.txt'), 'utf8').split('\n');
  for (let i = 1; i < sLines.length; i++) {
    const l = sLines[i].trim();
    if (!l) continue;
    const parts = l.split(',').map(s => s.replace(/"/g, '').trim());
    const id = parts[0];
    let name = parts[2];
    const lat = parseFloat(parts[4]);
    const lon = parseFloat(parts[5]);

    let commune = '';
    const m = id.match(/FR:(\d{5}):/);
    if (m && inseeCommunes[m[1]]) {
      commune = inseeCommunes[m[1]];
    }
    const generic = ['chef-lieu', 'gare', 'centre', 'mairie', 'ecole', 'église', 'le village', 'gare routiere'];
    const lowerName = name.toLowerCase();
    if (commune && (generic.some(g => lowerName === g || lowerName.startsWith(g + ' ')) || !lowerName.includes(commune.toLowerCase()))) {
      if (!lowerName.includes(commune.toLowerCase())) {
        name = `${commune} - ${name}`;
      }
    }
    if (id && !isNaN(lat) && !isNaN(lon)) {
      stops[id] = { id, name, lat, lon };
    }
  }

  // Trips
  const neededTripIds = new Set();
  const tRl = readline.createInterface({ input: fs.createReadStream(path.join(dirPath, 'trips.txt')), crlfDelay: Infinity });
  let tFirst = true;
  for await (const line of tRl) {
    if (tFirst) { tFirst = false; continue; }
    if (!line.trim()) continue;
    const parts = line.split(',').map(s => s.replace(/"/g, '').trim());
    const rId = parts[0];
    const tId = parts[2];
    const headsign = parts[3];
    const shapeId = parts[7];
    if (routes[rId]) {
      routes[rId].trips[tId] = { tId, headsign, shapeId, stoptimes: [] };
      neededTripIds.add(tId);
    }
  }

  // Stop times
  const stRl = readline.createInterface({ input: fs.createReadStream(path.join(dirPath, 'stop_times.txt')), crlfDelay: Infinity });
  let stFirst = true;
  for await (const line of stRl) {
    if (stFirst) { stFirst = false; continue; }
    if (!line.trim()) continue;
    const parts = line.split(',').map(s => s.replace(/"/g, '').trim());
    const tId = parts[0];
    if (neededTripIds.has(tId)) {
      const dep = parts[2] ? parts[2].slice(0, 5) : '';
      const sId = parts[3];
      const seq = parseInt(parts[4]);
      for (const r of Object.values(routes)) {
        if (r.trips[tId]) {
          r.trips[tId].stoptimes.push({ sId, dep, seq });
          break;
        }
      }
    }
  }

  // Shapes - only stream shapes needed by target routes
  const neededShapes = new Set();
  for (const r of Object.values(routes)) {
    for (const t of Object.values(r.trips)) {
      if (t.shapeId) neededShapes.add(t.shapeId);
    }
  }
  console.log(`Streaming shapes for ${neededShapes.size} target shapes...`);

  const shapes = {};
  const shRl = readline.createInterface({ input: fs.createReadStream(path.join(dirPath, 'shapes.txt')), crlfDelay: Infinity });
  let shFirst = true;
  for await (const line of shRl) {
    if (shFirst) { shFirst = false; continue; }
    if (!line.trim()) continue;
    const comma1 = line.indexOf(',');
    const sId = line.slice(0, comma1).replace(/"/g, '');
    if (neededShapes.has(sId)) {
      const parts = line.split(',').map(s => s.replace(/"/g, '').trim());
      const lat = parseFloat(parts[1]);
      const lon = parseFloat(parts[2]);
      const seq = parseInt(parts[3]) || 0;
      if (!shapes[sId]) shapes[sId] = [];
      shapes[sId].push({ lat, lon, seq });
    }
  }
  for (const sId of Object.keys(shapes)) {
    shapes[sId].sort((a, b) => a.seq - b.seq);
  }

  // Build route objects
  const output = [];
  for (const r of Object.values(routes)) {
    const tripList = Object.values(r.trips);
    if (tripList.length === 0) continue;
    tripList.sort((a, b) => b.stoptimes.length - a.stoptimes.length);

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
    }

    if (!directCoordinates || directCoordinates.length < 2) continue;

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

    const stopPoints = [];
    for (const sId of tripStopsOrdered) {
      const s = stops[sId];
      const { proj, distMeters } = projectPointOnPolyline([s.lon, s.lat], directCoordinates);
      if (distMeters <= 400) {
        const times = stopTimesMap[s.name] ? [...stopTimesMap[s.name]].sort() : [];
        stopPoints.push({
          name: s.name,
          coord: proj,
          time: times.length > 0 ? times.slice(0, 6).join(' | ') : undefined
        });
      }
    }

    if (stopPoints.length === 0) continue;

    const timetableRows = [];
    for (const sp of stopPoints) {
      const times = stopTimesMap[sp.name] ? [...stopTimesMap[sp.name]].sort() : [];
      timetableRows.push({
        stop: sp.name,
        times: times.slice(0, 16)
      });
    }

    output.push({
      id: `bus-drome-${r.short.toLowerCase()}`,
      ref: r.short,
      name: `Ligne ${r.short} : ${r.long.replace(/ - | - /g, ' ↔ ')}`,
      mode: 'bus',
      operator: 'Cars Région Drôme',
      network: 'Cars Région Drôme',
      route: r.long.replace(/ - | - /g, ' ↔ '),
      frequency: 'Liaison régulière toute l\'année',
      period: 'Toute l\'année',
      stops: stopPoints.map(sp => sp.name),
      stopPoints,
      color: r.color,
      directCoordinates,
      timetable: {
        title: `Horaires officiels Cars Région Drôme - Ligne ${r.short}`,
        rows: timetableRows
      }
    });

    console.log(`  ✓ Route [${r.short}] ${r.long}: ${directCoordinates.length} pts, ${stopPoints.length} stops snapped.`);
  }

  console.log(`\nProcessed ${output.length} alpine lines for Drôme.`);
  fs.writeFileSync('scripts/data/drome_alpine_final.json', JSON.stringify(output, null, 2));
  console.log(`Saved output to scripts/data/drome_alpine_final.json (${(fs.statSync('scripts/data/drome_alpine_final.json').size / 1024).toFixed(1)} KB)`);
}

buildDromeAlpine().catch(console.error);
