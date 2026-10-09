import fs from 'node:fs';
import readline from 'node:readline';

async function checkNavettes() {
  const tripsFile = 'imports/haute_savoie/trips.txt';
  const tStream = readline.createInterface({ input: fs.createReadStream(tripsFile) });
  let first = true;
  const navetteTrips = {};
  for await (const line of tStream) {
    if (first) { first = false; continue; }
    const parts = line.split(',');
    const rId = parts[0].replace(/"/g, '');
    const tripHeadsign = parts[3] ? parts[3].replace(/"/g, '') : '';
    const shortName = parts[4] ? parts[4].replace(/"/g, '') : '';
    if (rId.includes('1007002') || rId.includes('1007005') || rId.includes('1008465')) {
      if (!navetteTrips[rId]) navetteTrips[rId] = new Set();
      navetteTrips[rId].add(`${tripHeadsign} (${shortName})`);
    }
  }
  for (const [rId, set] of Object.entries(navetteTrips)) {
    console.log(`\nRoute ${rId}:`);
    for (const item of set) console.log(`  - ${item}`);
  }
}

checkNavettes();
