import fs from 'node:fs';

const shapes = fs.readFileSync('scripts/gtfs_74/shapes.txt', 'utf8').split('\n');
console.log('Shapes lines:', shapes.length - 1);
console.log('Shape header:', shapes[0]);

// Find shapes for Y91 and Y92 trips
const trips = fs.readFileSync('scripts/gtfs_74/trips.txt', 'utf8').split('\n');
const targetRouteIds = ['HAUTExSAVOIE:Line:1007022:LOC', 'HAUTExSAVOIE:Line:1007023:LOC', 'HAUTExSAVOIE:Line:1007002:LOC'];
const shapeIds = new Set();

for (let i = 1; i < trips.length; i++) {
  const parts = trips[i].split(',');
  if (targetRouteIds.includes(parts[0]) && parts[6]) {
    shapeIds.add(parts[6].trim());
  }
}

console.log('Unique shape IDs for Y91, Y92, N-BAB:', Array.from(shapeIds));

if (shapeIds.size > 0) {
  // count points per shape
  const shapeCounts = {};
  for (let i = 1; i < shapes.length; i++) {
    const parts = shapes[i].split(',');
    const sId = parts[0]?.trim();
    if (shapeIds.has(sId)) {
      shapeCounts[sId] = (shapeCounts[sId] || 0) + 1;
    }
  }
  console.log('Shape point counts:', shapeCounts);
} else {
  console.log('No shape_id specified in trips for these routes.');
}
