import fs from 'node:fs';
import readline from 'node:readline';

async function checkRouteShapes() {
  const routesFile = 'imports/haute_savoie/routes.txt';
  const tripsFile = 'imports/haute_savoie/trips.txt';
  const stopTimesFile = 'imports/haute_savoie/stop_times.txt';
  const stopsFile = 'imports/haute_savoie/stops.txt';
  const shapesFile = 'imports/haute_savoie/shapes.txt';

  // Read stops
  const stops = {};
  const sLines = fs.readFileSync(stopsFile, 'utf8').split('\n');
  for (let i = 1; i < sLines.length; i++) {
    const l = sLines[i].trim();
    if (!l) continue;
    const parts = l.split(',').map(s => s.replace(/"/g, '').trim());
    if (parts.length >= 6) {
      stops[parts[0]] = { id: parts[0], name: parts[2], lat: parseFloat(parts[4]), lon: parseFloat(parts[5]) };
    }
  }

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
      trips: {}
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
    const headsign = parts[3];
    const directionId = parts[5];
    const shapeId = parts[7];
    if (routes[routeId]) {
      routes[routeId].trips[tripId] = { tripId, headsign, directionId, shapeId, stops: [] };
    }
  }

  // Read stop_times
  const stStream = readline.createInterface({ input: fs.createReadStream(stopTimesFile) });
  let stFirst = true;
  for await (const line of stStream) {
    if (stFirst) { stFirst = false; continue; }
    if (!line.trim()) continue;
    const parts = line.split(',').map(s => s.replace(/"/g, '').trim());
    const tripId = parts[0];
    const time = parts[2];
    const stopId = parts[3];
    const seq = parseInt(parts[4]);

    for (const r of Object.values(routes)) {
      if (r.trips[tripId]) {
        r.trips[tripId].stops.push({ stopId, time, seq });
        break;
      }
    }
  }

  console.log('Finished mapping trips and stop_times.');
  for (const [rId, r] of Object.entries(routes)) {
    const tripList = Object.values(r.trips);
    // Sort trips by number of stops descending
    tripList.sort((a, b) => b.stops.length - a.stops.length);
    const longestTrip = tripList[0];
    const uniqueStops = new Set();
    tripList.forEach(t => t.stops.forEach(s => uniqueStops.add(s.stopId)));

    console.log(`Route ${r.short_name} (${r.long_name}) : ${tripList.length} trips, total unique stops: ${uniqueStops.size}`);
    if (longestTrip) {
      console.log(`  Longest trip: ${longestTrip.tripId} (${longestTrip.stops.length} stops), headsign: "${longestTrip.headsign}", shapeId: ${longestTrip.shapeId}`);
    }
  }
}

checkRouteShapes();
