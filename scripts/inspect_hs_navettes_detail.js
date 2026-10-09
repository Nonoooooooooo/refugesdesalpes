import fs from 'node:fs';
import readline from 'node:readline';

async function inspectNavetteDetails() {
  const tripsFile = 'imports/haute_savoie/trips.txt';
  const routesFile = 'imports/haute_savoie/routes.txt';

  const tStream = readline.createInterface({ input: fs.createReadStream(tripsFile) });
  let first = true;
  const trips = [];
  for await (const line of tStream) {
    if (first) { first = false; continue; }
    if (!line.trim()) continue;
    const parts = line.split(',').map(s => s.replace(/"/g, '').trim());
    if (parts[0].includes('1008465') || parts[0].includes('1007002') || parts[0].includes('1007005')) {
      trips.push({
        routeId: parts[0],
        tripId: parts[2],
        headsign: parts[3],
        shortName: parts[4],
        shapeId: parts[7]
      });
    }
  }

  console.log(`Found ${trips.length} navette trips.`);
  // Group by route and headsign
  const groups = {};
  for (const t of trips) {
    const key = `${t.routeId} | ${t.headsign}`;
    if (!groups[key]) groups[key] = { count: 0, shapes: new Set() };
    groups[key].count++;
    if (t.shapeId) groups[key].shapes.add(t.shapeId);
  }
  for (const [k, v] of Object.entries(groups)) {
    console.log(`${k} -> ${v.count} trips, shapes: ${[...v.shapes].join(', ')}`);
  }
}

inspectNavetteDetails();
