import fs from 'node:fs';

const targetStopIds = new Set(['1145943', 'FR:74191:ZE:58699:HAUTExSAVOIE', 'FR:74191:ZE:58700:HAUTExSAVOIE', 'FR:74191:ZE:58886:HAUTExSAVOIE']);

// 1. Lire stop_times.txt pour trouver les trip_ids
const stopTimes = fs.readFileSync('scripts/gtfs_74/stop_times.txt', 'utf8').split('\n');
const tripIds = new Set();
for (let i = 1; i < stopTimes.length; i++) {
  const line = stopTimes[i].trim();
  if (!line) continue;
  const parts = line.split(',');
  const tripId = parts[0];
  const stopId = parts[3];
  if (targetStopIds.has(stopId)) {
    tripIds.add(tripId);
  }
}
console.log('Trips serving Prodains / Avoriaz:', tripIds.size);

// 2. Lire trips.txt pour trouver les route_ids
const trips = fs.readFileSync('scripts/gtfs_74/trips.txt', 'utf8').split('\n');
const routeIds = new Set();
const routeTrips = {};
for (let i = 1; i < trips.length; i++) {
  const line = trips[i].trim();
  if (!line) continue;
  const parts = line.split(',');
  const routeId = parts[0];
  const tripId = parts[2];
  const shapeId = parts[6];
  if (tripIds.has(tripId)) {
    routeIds.add(routeId);
    if (!routeTrips[routeId]) routeTrips[routeId] = [];
    routeTrips[routeId].push({ tripId, shapeId });
  }
}

// 3. Lire routes.txt pour les noms des lignes
const routes = fs.readFileSync('scripts/gtfs_74/routes.txt', 'utf8').split('\n');
const routeMap = {};
for (let i = 1; i < routes.length; i++) {
  const line = routes[i].trim();
  if (!line) continue;
  const parts = line.split(',');
  const routeId = parts[0];
  const shortName = parts[2];
  const longName = parts[3];
  routeMap[routeId] = { shortName, longName };
}

console.log('\nRoutes serving Prodains / Avoriaz:');
for (const rId of routeIds) {
  const r = routeMap[rId] || { shortName: rId, longName: 'Unknown' };
  console.log(`- Route ID: ${rId} | Short: ${r.shortName} | Long: ${r.longName} | Trips count: ${routeTrips[rId]?.length}`);
}
