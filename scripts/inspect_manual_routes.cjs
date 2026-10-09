const fs = require('fs');

const data = JSON.parse(fs.readFileSync('public/transports_alpes.json', 'utf8'));

console.log('Total features:', data.features.length);

const syntheticLines = [];
const gtfsLines = [];

data.features.forEach(f => {
  const p = f.properties || {};
  if (f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString') {
    if (p.id?.startsWith('bus-') || p.id?.startsWith('navette-') || p.id?.startsWith('altigo-') || p.id?.startsWith('ligne-') || p.id?.startsWith('transisere-') || p.id?.startsWith('cars-')) {
      // classify
    }
  }
});

// Let's inspect BUS_ROUTES from build_transport_dataset.js
const btdContent = fs.readFileSync('scripts/build_transport_dataset.js', 'utf8');
const busRouteMatches = [...btdContent.matchAll(/id:\s*['"]([^'"]+)['"],[\s\S]*?name:\s*['"]([^'"]+)['"],[\s\S]*?coords:\s*['"]([^'"]+)['"]/g)];
console.log('BUS_ROUTES with manual coords in build_transport_dataset.js:', busRouteMatches.length);

busRouteMatches.forEach(m => {
  const [_, id, name, coords] = m;
  const parts = coords.split(';');
  const cStart = parts[0].split(',').map(Number);
  const cEnd = parts[parts.length - 1].split(',').map(Number);
  console.log(`${id} | ${name}`);
  console.log(`   Start: [${cStart[0]}, ${cStart[1]}] -> End: [${cEnd[0]}, ${cEnd[1]}] (points: ${parts.length})`);
});
