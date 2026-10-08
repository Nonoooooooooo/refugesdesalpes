import fs from 'node:fs';
import readline from 'node:readline';

async function buildFinalCarsRegionExpress() {
  console.log('--- Generating High-Precision Cars Région Express Network ---');
  
  const inseeMap = JSON.parse(fs.readFileSync('scripts/insee_communes.json', 'utf8'));

  // 1. Routes
  const routesCsv = fs.readFileSync('imports/cars_region_express/routes.txt', 'utf8').trim().split('\n');
  const routesMap = new Map();
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

  // 2. Stops with INSEE prefixing
  const stopsCsv = fs.readFileSync('imports/cars_region_express/stops.txt', 'utf8').trim().split('\n');
  const stopsHeader = stopsCsv[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
  const idIdx = stopsHeader.indexOf('stop_id');
  const nameIdx = stopsHeader.indexOf('stop_name');
  const latIdx = stopsHeader.indexOf('stop_lat');
  const lonIdx = stopsHeader.indexOf('stop_lon');
  
  const stopsMap = new Map();
  for (let i = 1; i < stopsCsv.length; i++) {
    const parts = stopsCsv[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    if (parts.length <= latIdx) continue;
    const rawId = parts[idIdx];
    let rawName = parts[nameIdx];
    const mInsee = rawId.match(/^FR:(\d{5}):/);
    const inseeCode = mInsee ? mInsee[1] : null;
    const cityName = inseeCode && inseeMap[inseeCode] ? inseeMap[inseeCode] : '';

    let cleanName = rawName;
    const genericWords = ['centre', 'mairie', 'gare', 'gare routière', 'église', 'place', 'poste', 'école', 'lycée', 'collège', 'déviation', 'montée', 'les pommiers', 'menuiserie', 'rd'];
    const isGeneric = genericWords.some(w => rawName.toLowerCase() === w || rawName.toLowerCase().startsWith(w + ' '));
    
    if (cityName && isGeneric && !rawName.toLowerCase().includes(cityName.toLowerCase())) {
      cleanName = `${cityName} (${rawName})`;
    } else if (cityName && !rawName.toLowerCase().includes(cityName.toLowerCase()) && rawName.length <= 12) {
      cleanName = `${cityName} - ${rawName}`;
    }

    stopsMap.set(rawId, {
      id: rawId,
      name: cleanName,
      lat: parseFloat(parts[latIdx]),
      lng: parseFloat(parts[lonIdx])
    });
  }

  // 3. Trips
  const tripsCsv = fs.readFileSync('imports/cars_region_express/trips.txt', 'utf8').trim().split('\n');
  const tripsHeader = tripsCsv[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
  const tripRouteIdx = tripsHeader.indexOf('route_id');
  const tripIdIdx = tripsHeader.indexOf('trip_id');
  const tripShapeIdx = tripsHeader.indexOf('shape_id');

  const routeTrips = new Map();
  for (let i = 1; i < tripsCsv.length; i++) {
    const parts = tripsCsv[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    if (parts.length <= tripShapeIdx) continue;
    const rId = parts[tripRouteIdx];
    const tId = parts[tripIdIdx];
    const sId = parts[tripShapeIdx];
    if (!routeTrips.has(rId)) routeTrips.set(rId, []);
    routeTrips.get(rId).push({ trip_id: tId, shape_id: sId });
  }

  // 4. Stop_times
  console.log('Streaming stop_times.txt...');
  const stopTimesStream = fs.createReadStream('imports/cars_region_express/stop_times.txt');
  const rl = readline.createInterface({ input: stopTimesStream, crlfDelay: Infinity });
  
  let stHeader = null;
  const tripStopsMap = new Map();
  
  for await (const line of rl) {
    if (!stHeader) {
      stHeader = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
      continue;
    }
    const parts = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    const tId = parts[0];
    const depTime = parts[2] || parts[1];
    const sId = parts[3];
    const seq = parseInt(parts[4], 10);
    if (!tripStopsMap.has(tId)) tripStopsMap.set(tId, []);
    tripStopsMap.get(tId).push({ stop_id: sId, sequence: seq, time: depTime });
  }

  // 5. Shapes
  console.log('Streaming shapes.txt...');
  const shapePointsMap = new Map();
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

  // RDP Simplification
  function simplify(points, sqTolerance) {
    if (points.length <= 2) return points;
    let dmax = 0;
    let index = 0;
    const end = points.length - 1;
    const [x1, y1] = points[0];
    const [x2, y2] = points[end];
    const dx = x2 - x1;
    const dy = y2 - y1;

    for (let i = 1; i < end; i++) {
      const [x, y] = points[i];
      let d = 0;
      if (dx !== 0 || dy !== 0) {
        const u = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
        if (u > 1) {
          d = (x - x2) * (x - x2) + (y - y2) * (y - y2);
        } else if (u > 0) {
          d = (x - (x1 + u * dx)) * (x - (x1 + u * dx)) + (y - (y1 + u * dy)) * (y - (y1 + u * dy));
        } else {
          d = (x - x1) * (x - x1) + (y - y1) * (y - y1);
        }
      } else {
        d = (x - x1) * (x - x1) + (y - y1) * (y - y1);
      }
      if (d > dmax) {
        index = i;
        dmax = d;
      }
    }

    if (dmax > sqTolerance) {
      const rec1 = simplify(points.slice(0, index + 1), sqTolerance);
      const rec2 = simplify(points.slice(index), sqTolerance);
      return rec1.slice(0, -1).concat(rec2);
    }
    return [points[0], points[end]];
  }

  const tol = 0.00006;
  const sqTol = tol * tol;

  const finalRoutes = [];

  routesMap.forEach((r, rId) => {
    const trips = routeTrips.get(rId) || [];
    if (trips.length === 0) return;

    // Trier les trips par nombre de points du shape
    let bestTrip = trips[0];
    let bestShapePts = shapePointsMap.get(bestTrip.shape_id) || [];
    for (const t of trips) {
      const pts = shapePointsMap.get(t.shape_id) || [];
      if (pts.length > bestShapePts.length) {
        bestTrip = t;
        bestShapePts = pts;
      }
    }

    // Récupérer les arrêts ordonnés
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

    bestShapePts.sort((a, b) => a[2] - b[2]);
    const rawCoords = bestShapePts.map(p => [Number(p[0].toFixed(6)), Number(p[1].toFixed(6))]);
    const simplifiedCoords = simplify(rawCoords, sqTol);

    // Construire une grille horaire synthétique avec plusieurs allers-retours
    const sampleTrips = trips.slice(0, 5);
    const headers = sampleTrips.map((_, idx) => `Service ${idx + 1}`);
    const timetableRows = stopPoints.map(sp => {
      const times = sampleTrips.map(tr => {
        const tripSt = tripStopsMap.get(tr.trip_id) || [];
        const match = tripSt.find(item => {
          const sObj = stopsMap.get(item.stop_id);
          return sObj && sObj.name === sp.name;
        });
        return match && match.time ? match.time.slice(0, 5) : '-';
      });
      return { stop: sp.name, times };
    });

    const routeEntry = {
      id: 'cars-express-' + r.shortName.toLowerCase(),
      ref: r.shortName,
      name: `Ligne Express ${r.shortName} : ${r.longName}`,
      mode: 'bus',
      operator: 'Cars Région Express (AURA)',
      network: 'Cars Région Express',
      route: stopNames.length > 1 ? `${stopNames[0]} ↔ ${stopNames[stopNames.length - 1]}` : r.longName,
      frequency: 'Liaison express régionale cadencée',
      period: 'Toute l\'année (Horaires officiels GTFS)',
      stops: stopNames,
      stopPoints: stopPoints,
      color: '#059669', // Vert émeraude officiel Cars Région Express
      url: 'https://www.laregionvoustransporte.fr',
      directCoordinates: simplifiedCoords,
      timetable: {
        headers,
        rows: timetableRows,
        note: 'Horaires officiels Cars Région Express (Région Auvergne-Rhône-Alpes)'
      }
    };

    finalRoutes.push(routeEntry);
    console.log(`✓ Ligne [${r.shortName}] : ${stopNames.length} arrêts, ${simplifiedCoords.length} points géolocalisés`);
  });

  fs.writeFileSync('scripts/data/cars_region_express_final.json', JSON.stringify(finalRoutes, null, 2));
  console.log(`\nTERMINE ! ${finalRoutes.length} lignes Cars Région Express prêtes dans scripts/data/cars_region_express_final.json`);
}

buildFinalCarsRegionExpress().catch(console.error);
