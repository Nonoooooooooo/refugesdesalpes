import fs from 'node:fs';
import readline from 'node:readline';

async function analyzeShapesAndTrips() {
  const routesFile = 'imports/haute_savoie/routes.txt';
  const tripsFile = 'imports/haute_savoie/trips.txt';
  const stopTimesFile = 'imports/haute_savoie/stop_times.txt';

  // Read routes
  const routes = {};
  const rLines = fs.readFileSync(routesFile, 'utf8').split('\n');
  for (let i = 1; i < rLines.length; i++) {
    const l = rLines[i].trim();
    if (!l) continue;
    const parts = [];
    let cur = '', inQ = false;
    for (let c of l) {
      if (c === '"') inQ = !inQ;
      else if (c === ',' && !inQ) { parts.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    parts.push(cur.trim());
    routes[parts[0]] = {
      id: parts[0],
      short_name: parts[2],
      long_name: parts[3],
      color: parts[7] ? '#' + parts[7] : '#008BD2',
      trips: []
    };
  }

  // Read trips
  const tStream = readline.createInterface({ input: fs.createReadStream(tripsFile) });
  let tFirst = true;
  for await (const line of tStream) {
    if (tFirst) { tFirst = false; continue; }
    if (!line.trim()) continue;
    const parts = line.split(',').map(s => s.replace(/"/g, '').trim());
    const routeId = parts[0];
    const tripId = parts[2];
    const tripHeadsign = parts[3];
    const directionId = parts[5];
    const shapeId = parts[7];
    if (routes[routeId]) {
      routes[routeId].trips.push({ tripId, tripHeadsign, directionId, shapeId });
    }
  }

  console.log('Routes and trip statistics:');
  for (const [rId, r] of Object.entries(routes)) {
    const shapeCounts = {};
    for (const t of r.trips) {
      if (t.shapeId) shapeCounts[t.shapeId] = (shapeCounts[t.shapeId] || 0) + 1;
    }
    const topShapes = Object.entries(shapeCounts).sort((a, b) => b[1] - a[1]);
    console.log(`Route ${r.short_name} (${r.long_name}) : ${r.trips.length} trips, shapes: ${topShapes.map(s => `${s[0]} (${s[1]}x)`).join(', ')}`);
  }
}

analyzeShapesAndTrips();
