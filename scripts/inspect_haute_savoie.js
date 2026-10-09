import fs from 'node:fs';
import readline from 'node:readline';

async function inspect() {
  const routesFile = 'imports/haute_savoie/routes.txt';
  const tripsFile = 'imports/haute_savoie/trips.txt';
  const stopsFile = 'imports/haute_savoie/stops.txt';
  const shapesFile = 'imports/haute_savoie/shapes.txt';
  const stopTimesFile = 'imports/haute_savoie/stop_times.txt';

  console.log('Inspecting Haute Savoie GTFS...');

  // Routes
  const routes = {};
  const rLines = fs.readFileSync(routesFile, 'utf8').split('\n');
  const rHeaders = rLines[0].split(',').map(s => s.trim().replace(/"/g, ''));
  for (let i = 1; i < rLines.length; i++) {
    const l = rLines[i].trim();
    if (!l) continue;
    // parse CSV
    const parts = l.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || l.split(',');
    // better simple CSV parser
    const row = [];
    let cur = '', inQ = false;
    for (let c of l) {
      if (c === '"') inQ = !inQ;
      else if (c === ',' && !inQ) { row.push(cur.trim().replace(/^"|"$/g, '')); cur = ''; }
      else cur += c;
    }
    row.push(cur.trim().replace(/^"|"$/g, ''));
    const routeId = row[0];
    routes[routeId] = {
      route_id: routeId,
      short_name: row[2],
      long_name: row[3],
      color: row[7] ? '#' + row[7].replace('#', '') : '#059669',
      tripsCount: 0,
      shapes: new Set(),
      tripIds: []
    };
  }

  // Trips
  const tripToRoute = {};
  const tripToShape = {};
  const tStream = readline.createInterface({ input: fs.createReadStream(tripsFile) });
  let tFirst = true;
  for await (const line of tStream) {
    if (tFirst) { tFirst = false; continue; }
    if (!line.trim()) continue;
    const parts = line.split(',');
    const routeId = parts[0].replace(/"/g, '');
    const tripId = parts[2].replace(/"/g, '');
    const shapeId = parts[7] ? parts[7].replace(/"/g, '') : null;
    tripToRoute[tripId] = routeId;
    if (shapeId) tripToShape[tripId] = shapeId;
    if (routes[routeId]) {
      routes[routeId].tripsCount++;
      routes[routeId].tripIds.push(tripId);
      if (shapeId) routes[routeId].shapes.add(shapeId);
    }
  }

  console.log('\n--- ROUTES SUMMARY ---');
  for (const [rId, r] of Object.entries(routes)) {
    console.log(`[${r.short_name}] ${r.long_name} | Color: ${r.color} | Trips: ${r.tripsCount} | Distinct shapes: ${r.shapes.size}`);
  }

  // Stops
  const stops = {};
  const sLines = fs.readFileSync(stopsFile, 'utf8').split('\n');
  let sFirst = true;
  for (const line of sLines) {
    if (sFirst) { sFirst = false; continue; }
    if (!line.trim()) continue;
    const row = [];
    let cur = '', inQ = false;
    for (let c of line) {
      if (c === '"') inQ = !inQ;
      else if (c === ',' && !inQ) { row.push(cur.trim().replace(/^"|"$/g, '')); cur = ''; }
      else cur += c;
    }
    row.push(cur.trim().replace(/^"|"$/g, ''));
    if (row.length >= 6) {
      stops[row[0]] = {
        name: row[2],
        lat: parseFloat(row[4]),
        lon: parseFloat(row[5])
      };
    }
  }
  console.log(`\nTotal stops parsed: ${Object.keys(stops).length}`);
}

inspect();
