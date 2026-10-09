import fs from 'node:fs';
import readline from 'node:readline';

// Ramer-Douglas-Peucker simplification
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

async function main() {
  console.log('--- Parsing Haute-Savoie GTFS ---');
  const dir = 'imports/haute_savoie';

  const inseeCommunes = JSON.parse(fs.readFileSync('scripts/insee_communes.json', 'utf8'));

  // 1. Read Stops
  console.log('Reading stops.txt...');
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

    // Extract INSEE code from stopId if present (format FR:74xxx:ZE:...)
    let commune = '';
    const m = stopId.match(/FR:(\d{5}):/);
    if (m && inseeCommunes[m[1]]) {
      commune = inseeCommunes[m[1]];
    }

    // Disambiguate if needed
    const generic = ['chef-lieu', 'gare', 'centre', 'mairie', 'ecole', 'église', 'le village', 'gare routiere'];
    const lowerName = stopName.toLowerCase();
    if (commune && (generic.some(g => lowerName === g || lowerName.startsWith(g + ' ')) || !lowerName.includes(commune.toLowerCase()))) {
      // If the stop name doesn't already contain the commune name, prepend or format it
      if (!lowerName.includes(commune.toLowerCase())) {
        stopName = `${commune} - ${stopName}`;
      }
    }

    if (!isNaN(lat) && !isNaN(lon)) {
      stops[stopId] = { id: stopId, name: stopName, lat, lon, commune };
    }
  }
  console.log(`Parsed ${Object.keys(stops).length} stops.`);

  // 2. Read Routes
  console.log('Reading routes.txt...');
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
    const routeId = parts[0];
    const shortName = parts[2];
    const longName = parts[3];
    const color = parts[7] ? '#' + parts[7] : '#008BD2';

    routes[routeId] = {
      id: routeId,
      shortName,
      longName,
      color,
      trips: {}
    };
  }

  // 3. Read Trips
  console.log('Reading trips.txt...');
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

  // 4. Read Stop Times
  console.log('Reading stop_times.txt...');
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

  // 5. Read Shapes
  console.log('Reading shapes.txt...');
  const shapes = {};
  const shRl = readline.createInterface({ input: fs.createReadStream(`${dir}/shapes.txt`), crlfDelay: Infinity });
  let shFirst = true;
  for await (const line of shRl) {
    if (shFirst) { shFirst = false; continue; }
    if (!line.trim()) continue;
    const parts = line.split(',').map(s => s.replace(/"/g, '').trim());
    const shapeId = parts[0];
    const lat = parseFloat(parts[1]);
    const lon = parseFloat(parts[2]);
    const seq = parseInt(parts[3]);

    if (!shapes[shapeId]) shapes[shapeId] = [];
    shapes[shapeId].push({ lat, lon, seq });
  }

  for (const sId of Object.keys(shapes)) {
    shapes[sId].sort((a, b) => a.seq - b.seq);
  }
  console.log(`Parsed ${Object.keys(shapes).length} shapes.`);

  // 6. Build route definitions
  console.log('Building route definitions...');
  const outputRoutes = [];

  for (const r of Object.values(routes)) {
    const tripList = Object.values(r.trips);
    if (tripList.length === 0) continue;

    // Separate trips by direction or find the longest trip in each direction
    const tripsDir0 = tripList.filter(t => t.directionId === '0' || t.directionId === 0);
    const tripsDir1 = tripList.filter(t => t.directionId === '1' || t.directionId === 1);

    tripsDir0.sort((a, b) => b.stoptimes.length - a.stoptimes.length);
    tripsDir1.sort((a, b) => b.stoptimes.length - a.stoptimes.length);

    // Pick best shapes
    const shapeId0 = tripsDir0[0]?.shapeId;
    const shapeId1 = tripsDir1[0]?.shapeId;

    // Get coordinates for shapes
    const coords0 = shapeId0 && shapes[shapeId0] ? shapes[shapeId0].map(pt => [Number(pt.lon.toFixed(6)), Number(pt.lat.toFixed(6))]) : null;
    const coords1 = shapeId1 && shapes[shapeId1] ? shapes[shapeId1].map(pt => [Number(pt.lon.toFixed(6)), Number(pt.lat.toFixed(6))]) : null;

    // If both directions exist, can we use coords0 as primary, or merge?
    // In bus lines, coords0 is the forward trip. Let's simplify with RDP.
    let bestCoords = coords0 || coords1;
    if (!bestCoords) {
      // Find any shape from tripList
      for (const t of tripList) {
        if (t.shapeId && shapes[t.shapeId]) {
          bestCoords = shapes[t.shapeId].map(pt => [Number(pt.lon.toFixed(6)), Number(pt.lat.toFixed(6))]);
          break;
        }
      }
    }

    if (!bestCoords || bestCoords.length < 2) {
      console.warn(`No valid shape found for route ${r.shortName}`);
      continue;
    }

    const simplifiedCoords = ramerDouglasPeucker(bestCoords, 5); // 5m tolerance
    console.log(`Route ${r.shortName} (${r.longName}): ${bestCoords.length} pts -> ${simplifiedCoords.length} pts (RDP 5m)`);

    // Compile ordered stops from the most complete trips
    const bestTrip = tripsDir0[0] || tripList[0];
    const bestTripReturn = tripsDir1[0];

    const orderedStopIds = [];
    const seenStops = new Set();
    // First from bestTrip (aller)
    for (const st of bestTrip.stoptimes) {
      if (!seenStops.has(st.stopId) && stops[st.stopId]) {
        seenStops.add(st.stopId);
        orderedStopIds.push(st.stopId);
      }
    }
    // Then any missing stops from bestTripReturn or other trips
    for (const t of tripList) {
      for (const st of t.stoptimes) {
        if (!seenStops.has(st.stopId) && stops[st.stopId]) {
          seenStops.add(st.stopId);
          orderedStopIds.push(st.stopId);
        }
      }
    }

    // Build stopPoints
    const stopPoints = orderedStopIds.map(sId => {
      const s = stops[sId];
      return {
        name: s.name,
        coord: [Number(s.lon.toFixed(6)), Number(s.lat.toFixed(6))]
      };
    });

    const stopNames = stopPoints.map(sp => sp.name);

    // Build Timetable
    // Collect departures for each stop across all trips of this route
    const stopTimesMap = {};
    for (const t of tripList) {
      for (const st of t.stoptimes) {
        if (!st.departureTime) continue;
        const sName = stops[st.stopId]?.name;
        if (!sName) continue;
        if (!stopTimesMap[sName]) stopTimesMap[sName] = new Set();
        stopTimesMap[sName].add(st.departureTime);
      }
    }

    const timetableRows = [];
    for (const sp of stopPoints) {
      const timesSet = stopTimesMap[sp.name] || new Set();
      const sortedTimes = [...timesSet].sort();
      timetableRows.push({
        stop: sp.name,
        times: sortedTimes.slice(0, 16) // Top 16 departure times across the day
      });
      // also attach sample time to sp.time
      if (sortedTimes.length > 0) {
        sp.time = sortedTimes.slice(0, 6).join(' | ');
      }
    }

    outputRoutes.push({
      route_id: r.id,
      short_name: r.shortName,
      long_name: r.longName,
      color: r.color,
      directCoordinates: simplifiedCoords,
      stops: stopNames,
      stopPoints: stopPoints,
      timetable: {
        title: `Horaires officiels Cars Région Haute-Savoie - Ligne ${r.shortName}`,
        rows: timetableRows
      }
    });
  }

  console.log(`\nSuccessfully processed ${outputRoutes.length} routes.`);
  fs.writeFileSync('scripts/data/haute_savoie_parsed.json', JSON.stringify(outputRoutes, null, 2));
  console.log(`Saved output to scripts/data/haute_savoie_parsed.json (${(fs.statSync('scripts/data/haute_savoie_parsed.json').size / 1024).toFixed(1)} KB)`);
}

main().catch(console.error);
