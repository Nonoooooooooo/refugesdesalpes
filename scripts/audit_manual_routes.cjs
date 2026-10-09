const fs = require('fs');

const btdContent = fs.readFileSync('scripts/build_transport_dataset.js', 'utf8');

// Match route blocks in BUS_ROUTES
const routeRegex = /\{\s*id:\s*['"]([^'"]+)['"][\s\S]*?coords:\s*['"]([^'"]+)['"][\s\S]*?\}/g;

const routes = [];
let match;
while ((match = routeRegex.exec(btdContent)) !== null) {
  const fullBlock = match[0];
  const id = match[1];
  const coords = match[2];
  
  const nameMatch = fullBlock.match(/name:\s*['"]([^'"]+)['"]/);
  const stopsMatch = fullBlock.match(/stops:\s*\[([\s\S]*?)\]/);
  
  let stops = [];
  if (stopsMatch) {
    stops = stopsMatch[1].split(',').map(s => s.replace(/['"\r\n]/g, '').trim()).filter(Boolean);
  }
  
  const coordPairs = coords.split(';').map(pt => pt.split(',').map(Number));
  
  routes.push({
    id,
    name: nameMatch ? nameMatch[1] : id,
    firstStop: stops[0] || '',
    lastStop: stops[stops.length - 1] || '',
    stops,
    firstCoord: coordPairs[0],
    lastCoord: coordPairs[coordPairs.length - 1],
    coordCount: coordPairs.length
  });
}

console.log(`Auditing ${routes.length} manual routes in build_transport_dataset.js...`);

routes.forEach(r => {
  // Print routes that are navettes or altigo or local valley shuttles
  if (r.id.includes('altigo') || r.id.includes('navette') || r.id.includes('queyras') || r.id.includes('ecrins')) {
    console.log(`\n[${r.id}] ${r.name}`);
    console.log(`  Start stop: "${r.firstStop}" @ [${r.firstCoord[0]}, ${r.firstCoord[1]}]`);
    console.log(`  End stop:   "${r.lastStop}" @ [${r.lastCoord[0]}, ${r.lastCoord[1]}]`);
  }
});
