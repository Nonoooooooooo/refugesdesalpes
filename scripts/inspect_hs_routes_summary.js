import fs from 'node:fs';

const routes = JSON.parse(fs.readFileSync('scripts/data/haute_savoie_parsed.json', 'utf8'));

console.log('--- HAUTE-SAVOIE ROUTES SUMMARY ---');
for (const r of routes) {
  const pts = r.directCoordinates;
  const start = pts[0];
  const end = pts[pts.length - 1];
  console.log(`[${r.short_name}] ${r.long_name}`);
  console.log(`   Color: ${r.color} | Pts: ${pts.length} | Stops: ${r.stopPoints.length}`);
  console.log(`   Start: [${start[0]}, ${start[1]}] -> End: [${end[0]}, ${end[1]}]`);
  console.log(`   First 2 stops: "${r.stopPoints[0]?.name}", "${r.stopPoints[1]?.name}"`);
  console.log(`   Last 2 stops: "${r.stopPoints[r.stopPoints.length - 2]?.name}", "${r.stopPoints[r.stopPoints.length - 1]?.name}"`);
  console.log('');
}
