import fs from 'node:fs';
import readline from 'node:readline';

async function main() {
  console.log('Lecture stops TGV...');
  const stops = {};
  const sLines = fs.readFileSync('imports/tgv/stops.txt', 'utf8').split('\n');
  for (let i = 1; i < sLines.length; i++) {
    const l = sLines[i].trim();
    if (!l) continue;
    const parts = l.split(',');
    stops[parts[0]] = {
      id: parts[0],
      name: parts[2]?.replace(/"/g, ''),
      lat: parseFloat(parts[4]),
      lon: parseFloat(parts[5])
    };
  }
  console.log(`Parsed ${Object.keys(stops).length} stops TGV.`);

  const targetRoutes = {
    'FR:Line::1E753DF8-B3B7-4FFE-BF59-46FC27595D6E:': 'Paris - Tarentaise TGV',
    'FR:Line::D9F206DE-37B5-4299-A71A-5B4201D0B9F9:': 'Paris - Grenoble TGV',
    'FR:Line::60faff89-b743-4b4b-a86b-3c0537769bfa:': 'Paris - Chambéry - Annecy TGV',
    'FR:Line::4767DC65-0993-4961-B6EC-E5BF6DFFB291:': 'Paris - Maurienne TGV',
    'FR:Line::03E81290-4977-4B5A-A051-E1633790D6F3:': 'Lille - Alpes TGV',
  };

  // Trouver un trip représentatif pour chacune
  console.log('Recherche des trips correspondants...');
  const tripsRl = readline.createInterface({ input: fs.createReadStream('imports/tgv/trips.txt'), crlfDelay: Infinity });
  const routeTrips = {};

  for await (const line of tripsRl) {
    if (!line.trim()) continue;
    const parts = line.split(',');
    const rId = parts[0];
    if (targetRoutes[rId] && !routeTrips[rId]) {
      routeTrips[rId] = { tripId: parts[2], headsign: parts[3], name: targetRoutes[rId] };
    }
  }

  console.log('Trips trouvés:', routeTrips);

  // Lire stop_times pour ces trips
  console.log('Recherche des arrêts dans stop_times.txt...');
  const targetTripIds = new Set(Object.values(routeTrips).map(t => t.tripId));
  const tripStopsMap = {};
  targetTripIds.forEach(tId => tripStopsMap[tId] = []);

  const stRl = readline.createInterface({ input: fs.createReadStream('imports/tgv/stop_times.txt'), crlfDelay: Infinity });
  for await (const line of stRl) {
    if (!line.trim()) continue;
    const parts = line.split(',');
    const tripId = parts[0];
    if (targetTripIds.has(tripId)) {
      const s = stops[parts[3]];
      if (s) {
        tripStopsMap[tripId].push({ ...s, seq: parseInt(parts[4]) });
      }
    }
  }

  for (const [rId, tInfo] of Object.entries(routeTrips)) {
    console.log(`\n=== ${tInfo.name} (trip: ${tInfo.tripId}) ===`);
    const stList = tripStopsMap[tInfo.tripId] || [];
    stList.sort((a, b) => a.seq - b.seq);
    stList.forEach(s => console.log(`  [seq ${s.seq}] ${s.name} (${s.lat.toFixed(4)}, ${s.lon.toFixed(4)})`));
  }
}

main();
