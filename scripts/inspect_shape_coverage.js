import fs from 'node:fs';
import readline from 'node:readline';

// Inspect which trips match which shapes and which stops match which shapes
async function inspectTripShapeCoverage() {
  const dir = 'imports/haute_savoie';

  const tripsFile = `${dir}/trips.txt`;
  const stopTimesFile = `${dir}/stop_times.txt`;

  // Map trip -> shapeId
  const tripShape = {};
  const tRl = readline.createInterface({ input: fs.createReadStream(tripsFile), crlfDelay: Infinity });
  let tFirst = true;
  for await (const line of tRl) {
    if (tFirst) { tFirst = false; continue; }
    const parts = line.split(',').map(s => s.replace(/"/g, '').trim());
    tripShape[parts[2]] = { routeId: parts[0], shapeId: parts[7], headsign: parts[3] };
  }

  // Map shapeId -> set of stopIds
  const shapeStops = {};
  const stRl = readline.createInterface({ input: fs.createReadStream(stopTimesFile), crlfDelay: Infinity });
  let stFirst = true;
  for await (const line of stRl) {
    if (stFirst) { stFirst = false; continue; }
    const parts = line.split(',').map(s => s.replace(/"/g, '').trim());
    const tripId = parts[0];
    const stopId = parts[3];
    const ts = tripShape[tripId];
    if (ts && ts.shapeId) {
      if (!shapeStops[ts.shapeId]) shapeStops[ts.shapeId] = new Set();
      shapeStops[ts.shapeId].add(stopId);
    }
  }

  // Print summary per route
  const routes = JSON.parse(fs.readFileSync('scripts/data/haute_savoie_parsed.json', 'utf8'));
  for (const r of routes) {
    console.log(`Route ${r.short_name}:`);
    const rTrips = Object.entries(tripShape).filter(([tId, info]) => info.routeId === r.route_id);
    const shapes = {};
    rTrips.forEach(([tId, info]) => {
      if (info.shapeId) {
        shapes[info.shapeId] = (shapes[info.shapeId] || 0) + 1;
      }
    });
    for (const [sId, count] of Object.entries(shapes)) {
      const stopCount = shapeStops[sId] ? shapeStops[sId].size : 0;
      console.log(`  shape ${sId} (${count} trips): ${stopCount} stops`);
    }
  }
}

inspectTripShapeCoverage();
