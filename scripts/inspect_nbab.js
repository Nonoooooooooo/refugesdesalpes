import fs from 'node:fs';

const trips = fs.readFileSync('scripts/gtfs_74/trips.txt', 'utf8').split('\n');
const stopTimes = fs.readFileSync('scripts/gtfs_74/stop_times.txt', 'utf8').split('\n');
const stops = fs.readFileSync('scripts/gtfs_74/stops.txt', 'utf8').split('\n');

const stopMap = {};
for (let i = 1; i < stops.length; i++) {
  const line = stops[i].trim();
  if (!line) continue;
  const parts = line.split(',');
  stopMap[parts[0]] = { name: parts[2]?.replace(/"/g, ''), lat: Number(parts[4]), lon: Number(parts[5]) };
}

// Route ID for N-BAB:
const routes = fs.readFileSync('scripts/gtfs_74/routes.txt', 'utf8').split('\n');
let nbabRouteId = null;
for (const r of routes) {
  if (r.includes('BALAD\'AULPS') || r.includes('N-BAB')) {
    nbabRouteId = r.split(',')[0];
    console.log('Found N-BAB Route:', r);
    break;
  }
}

if (nbabRouteId) {
  const nbabTrips = [];
  for (let i = 1; i < trips.length; i++) {
    const parts = trips[i].split(',');
    if (parts[0] === nbabRouteId) {
      nbabTrips.push({ tripId: parts[2], headsign: parts[3]?.replace(/"/g, '') });
    }
  }
  console.log(`N-BAB trips: ${nbabTrips.length}`);
  const headsigns = {};
  nbabTrips.forEach(t => headsigns[t.headsign] = (headsigns[t.headsign] || 0) + 1);
  console.log('Headsigns:', headsigns);

  // Print stops for first trip of each headsign
  const seenHeadsigns = new Set();
  for (const t of nbabTrips) {
    if (!seenHeadsigns.has(t.headsign)) {
      seenHeadsigns.add(t.headsign);
      console.log(`\nStops for headsign: "${t.headsign}" (trip ${t.tripId}):`);
      const tripStops = [];
      for (let i = 1; i < stopTimes.length; i++) {
        const parts = stopTimes[i].split(',');
        if (parts[0] === t.tripId) {
          const s = stopMap[parts[3]] || { name: parts[3] };
          tripStops.push({ seq: Number(parts[4]), name: s.name, lat: s.lat, lon: s.lon, arr: parts[1] });
        }
      }
      tripStops.sort((a,b) => a.seq - b.seq);
      tripStops.forEach(s => console.log(`  ${s.seq}. ${s.name} (${s.lat?.toFixed(4)}, ${s.lon?.toFixed(4)}) arr: ${s.arr}`));
    }
  }
}
