import fs from 'node:fs';

const trips = fs.readFileSync('scripts/gtfs_74/trips.txt', 'utf8').split('\n');
const stopTimes = fs.readFileSync('scripts/gtfs_74/stop_times.txt', 'utf8').split('\n');
const stops = fs.readFileSync('scripts/gtfs_74/stops.txt', 'utf8').split('\n');
const shapes = fs.readFileSync('scripts/gtfs_74/shapes.txt', 'utf8').split('\n');

const stopMap = {};
for (let i = 1; i < stops.length; i++) {
  const line = stops[i].trim();
  if (!line) continue;
  const parts = line.split(',');
  stopMap[parts[0]] = { name: parts[2]?.replace(/"/g, ''), lat: Number(parts[4]), lon: Number(parts[5]) };
}

// Find a trip of Y91 and Y92 that serves Prodains
const targetTripIds = ['HAUTExSAVOIE:Line:1007022:LOC', 'HAUTExSAVOIE:Line:1007023:LOC'];
const tripInfo = {};
for (let i = 1; i < trips.length; i++) {
  const line = trips[i].trim();
  if (!line) continue;
  const parts = line.split(',');
  const routeId = parts[0];
  const tripId = parts[2];
  const headsign = parts[3]?.replace(/"/g, '');
  const shapeId = parts[6];
  if (targetTripIds.includes(routeId)) {
    if (!tripInfo[routeId]) tripInfo[routeId] = [];
    tripInfo[routeId].push({ tripId, headsign, shapeId });
  }
}

for (const routeId of targetTripIds) {
  console.log(`\n=================== ROUTE ${routeId} ===================`);
  const list = tripInfo[routeId] || [];
  console.log(`Total trips: ${list.length}`);
  // Group by headsign
  const byHeadsign = {};
  for (const t of list) {
    byHeadsign[t.headsign] = (byHeadsign[t.headsign] || 0) + 1;
  }
  console.log('Headsigns:', byHeadsign);

  // Pick one trip and list its stops
  const sampleTrip = list[0];
  console.log(`\nSample trip: ${sampleTrip.tripId} (${sampleTrip.headsign}), shape: ${sampleTrip.shapeId}`);
  const tripStops = [];
  for (let i = 1; i < stopTimes.length; i++) {
    const line = stopTimes[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts[0] === sampleTrip.tripId) {
      const sId = parts[3];
      const seq = Number(parts[4]);
      const arr = parts[1];
      const dep = parts[2];
      const stop = stopMap[sId] || { name: sId, lat: 0, lon: 0 };
      tripStops.push({ seq, name: stop.name, lat: stop.lat, lon: stop.lon, arr, dep });
    }
  }
  tripStops.sort((a, b) => a.seq - b.seq);
  console.log(`Stops sequence (${tripStops.length} stops):`);
  tripStops.forEach(s => console.log(`  ${s.seq}. ${s.name} (${s.lat.toFixed(4)}, ${s.lon.toFixed(4)}) - Arr: ${s.arr}`));
}
