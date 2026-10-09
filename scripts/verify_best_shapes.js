import fs from 'node:fs';
import readline from 'node:readline';

// Script to test shape selection and stop filtering for each route
async function verifyRouteBestShapes() {
  const dir = 'imports/haute_savoie';
  const routesFile = `${dir}/routes.txt`;
  const tripsFile = `${dir}/trips.txt`;
  const shapesFile = `${dir}/shapes.txt`;

  const routeNames = {};
  fs.readFileSync(routesFile, 'utf8').split('\n').slice(1).forEach(l => {
    if (!l.trim()) return;
    const parts = l.split(',').map(s => s.replace(/"/g, '').trim());
    routeNames[parts[0]] = parts[2];
  });

  const tripCounts = {};
  const tRl = readline.createInterface({ input: fs.createReadStream(tripsFile), crlfDelay: Infinity });
  let tFirst = true;
  for await (const line of tRl) {
    if (tFirst) { tFirst = false; continue; }
    if (!line.trim()) continue;
    const parts = line.split(',').map(s => s.replace(/"/g, '').trim());
    const rId = parts[0];
    const sId = parts[7];
    const headsign = parts[3];
    if (!sId) continue;
    if (!tripCounts[rId]) tripCounts[rId] = {};
    if (!tripCounts[rId][sId]) tripCounts[rId][sId] = { count: 0, headsign };
    tripCounts[rId][sId].count++;
  }

  for (const [rId, shapes] of Object.entries(tripCounts)) {
    const rShort = routeNames[rId] || rId;
    const sorted = Object.entries(shapes).sort((a, b) => b[1].count - a[1].count);
    console.log(`Route [${rShort}]: top shapes: ${sorted.slice(0, 3).map(s => `${s[0]} (${s[1].count}x, "${s[1].headsign}")`).join(' | ')}`);
  }
}

verifyRouteBestShapes();
