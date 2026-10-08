import fs from 'node:fs';
import readline from 'node:readline';

async function parseCarsRegionExpress() {
  console.log('--- Parsing Cars Région Express ---');
  
  // 1. Routes
  const routesCsv = fs.readFileSync('imports/cars_region_express/routes.txt', 'utf8').trim().split('\n');
  const routesHeader = routesCsv[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
  const routesMap = new Map(); // route_id -> routeObj
  for (let i = 1; i < routesCsv.length; i++) {
    const parts = routesCsv[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    if (parts.length < 3) continue;
    routesMap.set(parts[0], {
      id: parts[0],
      shortName: parts[2],
      longName: parts[3],
      color: parts[7] ? '#' + parts[7] : '#047857'
    });
  }
  console.log(`Routes found: ${routesMap.size}`);

  // 2. Stops
  const stopsCsv = fs.readFileSync('imports/cars_region_express/stops.txt', 'utf8').trim().split('\n');
  const stopsHeader = stopsCsv[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
  const idIdx = stopsHeader.indexOf('stop_id');
  const nameIdx = stopsHeader.indexOf('stop_name');
  const latIdx = stopsHeader.indexOf('stop_lat');
  const lonIdx = stopsHeader.indexOf('stop_lon');
  
  const stopsMap = new Map(); // stop_id -> { name, lat, lng }
  for (let i = 1; i < stopsCsv.length; i++) {
    const parts = stopsCsv[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    if (parts.length <= latIdx) continue;
    stopsMap.set(parts[idIdx], {
      id: parts[idIdx],
      name: parts[nameIdx],
      lat: parseFloat(parts[latIdx]),
      lng: parseFloat(parts[lonIdx])
    });
  }
  console.log(`Stops found: ${stopsMap.size}`);

  // 3. Trips (find best shape_id and representative trip per route)
  const tripsCsv = fs.readFileSync('imports/cars_region_express/trips.txt', 'utf8').trim().split('\n');
  const tripsHeader = tripsCsv[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
  const tripRouteIdx = tripsHeader.indexOf('route_id');
  const tripIdIdx = tripsHeader.indexOf('trip_id');
  const tripShapeIdx = tripsHeader.indexOf('shape_id');

  const routeTrips = new Map(); // route_id -> [ { trip_id, shape_id } ]
  for (let i = 1; i < tripsCsv.length; i++) {
    const parts = tripsCsv[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    if (parts.length <= tripShapeIdx) continue;
    const rId = parts[tripRouteIdx];
    const tId = parts[tripIdIdx];
    const sId = parts[tripShapeIdx];
    if (!routeTrips.has(rId)) routeTrips.set(rId, []);
    routeTrips.get(rId).push({ trip_id: tId, shape_id: sId });
  }

  // 4. Stop_times (find stops for each trip)
  console.log('Reading stop_times.txt...');
  const stopTimesStream = fs.createReadStream('imports/cars_region_express/stop_times.txt');
  const rl = readline.createInterface({ input: stopTimesStream, crlfDelay: Infinity });
  
  let stHeader = null;
  const tripStopsMap = new Map(); // trip_id -> [ { stop_id, sequence, time } ]
  
  for await (const line of rl) {
    if (!stHeader) {
      stHeader = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
      continue;
    }
    const parts = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    const tId = parts[0];
    const arrTime = parts[1];
    const sId = parts[3];
    const seq = parseInt(parts[4], 10);
    if (!tripStopsMap.has(tId)) tripStopsMap.set(tId, []);
    tripStopsMap.get(tId).push({ stop_id: sId, sequence: seq, time: arrTime });
  }
  console.log(`Parsed stop times for ${tripStopsMap.size} trips.`);

  // 5. Shapes (stream reading to avoid 9MB memory hit)
  console.log('Reading shapes.txt...');
  const shapePointsMap = new Map(); // shape_id -> [ [lon, lat, seq] ]
  const shapesStream = fs.createReadStream('imports/cars_region_express/shapes.txt');
  const rlShapes = readline.createInterface({ input: shapesStream, crlfDelay: Infinity });
  let shHeader = null;

  for await (const line of rlShapes) {
    if (!shHeader) {
      shHeader = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
      continue;
    }
    const parts = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    const sId = parts[0];
    const lat = parseFloat(parts[1]);
    const lon = parseFloat(parts[2]);
    const seq = parseInt(parts[3], 10);
    if (!shapePointsMap.has(sId)) shapePointsMap.set(sId, []);
    shapePointsMap.get(sId).push([lon, lat, seq]);
  }
  console.log(`Parsed ${shapePointsMap.size} shapes.`);

  // Sort each shape by sequence
  shapePointsMap.forEach((pts) => {
    pts.sort((a, b) => a[2] - b[2]);
  });

  // Assemble clean routes
  const processedRoutes = [];
  routesMap.forEach((r, rId) => {
    const trips = routeTrips.get(rId) || [];
    if (trips.length === 0) return;

    // Pick trip with the shape that has the most points
    let bestTrip = trips[0];
    let bestShapePts = shapePointsMap.get(bestTrip.shape_id) || [];
    for (const t of trips) {
      const pts = shapePointsMap.get(t.shape_id) || [];
      if (pts.length > bestShapePts.length) {
        bestTrip = t;
        bestShapePts = pts;
      }
    }

    // Get stops for best trip
    const rawStops = tripStopsMap.get(bestTrip.trip_id) || [];
    rawStops.sort((a, b) => a.sequence - b.sequence);
    const stopNames = [];
    const stopPoints = [];
    rawStops.forEach(st => {
      const stopObj = stopsMap.get(st.stop_id);
      if (stopObj && !stopNames.includes(stopObj.name)) {
        stopNames.push(stopObj.name);
        stopPoints.push({
          name: stopObj.name,
          lat: Number(stopObj.lat.toFixed(6)),
          lng: Number(stopObj.lng.toFixed(6)),
          time: st.time ? st.time.slice(0, 5) : null
        });
      }
    });

    const cleanCoords = bestShapePts.map(p => [Number(p[0].toFixed(6)), Number(p[1].toFixed(6))]);
    
    console.log(`Route [${r.shortName}] ${r.longName}: ${cleanCoords.length} pts, ${stopNames.length} stops`);
    processedRoutes.push({
      id: 'cars-express-' + r.shortName.toLowerCase(),
      ref: r.shortName,
      name: `Ligne Express ${r.shortName} : ${r.longName}`,
      mode: 'bus',
      operator: 'Cars Région Express (AURA)',
      network: 'Cars Région Express',
      route: stopNames.length > 0 ? `${stopNames[0]} ↔ ${stopNames[stopNames.length - 1]}` : r.longName,
      frequency: 'Liaison express régionale cadencée',
      period: 'Toute l\'année',
      stops: stopNames,
      stopPoints: stopPoints,
      color: r.color || '#047857',
      coordinates: cleanCoords
    });
  });

  fs.writeFileSync('scripts/data/cars_region_express_parsed.json', JSON.stringify(processedRoutes, null, 2));
  console.log(`\nSuccessfully processed and saved ${processedRoutes.length} Cars Région Express routes!`);
}

parseCarsRegionExpress().catch(console.error);
