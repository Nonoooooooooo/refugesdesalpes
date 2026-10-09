import fs from 'node:fs';

const d = JSON.parse(fs.readFileSync('scripts/data/missing_resorts_final.json', 'utf8'));
d.forEach(r => {
  console.log(`- [${r.ref}] ${r.name}`);
  console.log(`  coords: ${r.directCoordinates?.length}, stops: ${r.stopPoints?.length}, timetable rows: ${r.timetable?.rows?.length}`);
  console.log(`  sample stop 0: ${r.stopPoints[0]?.name} (${r.stopPoints[0]?.coord}) time: ${r.stopPoints[0]?.time}`);
});
