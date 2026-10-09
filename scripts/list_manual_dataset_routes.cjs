const fs = require('fs');

const btdContent = fs.readFileSync('scripts/build_transport_dataset.js', 'utf8');

// Match each route object in BUS_ROUTES
const routeRegex = /\{\s*id:\s*['"]([^'"]+)['"][\s\S]*?coords:\s*['"]([^'"]+)['"][\s\S]*?\}/g;

// Let's parse all routes with coords
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
  
  routes.push({
    id,
    name: nameMatch ? nameMatch[1] : id,
    coords,
    stops
  });
}

console.log('Total manual routes in build_transport_dataset.js:', routes.length);

// Let's check which of these manual routes are in public/transports_alpes.json
const dataset = JSON.parse(fs.readFileSync('public/transports_alpes.json', 'utf8'));
const datasetIds = new Set(dataset.features.map(f => f.properties?.id));

const manualInDataset = routes.filter(r => datasetIds.has(r.id));
console.log('Manual routes present in transports_alpes.json:', manualInDataset.length);

manualInDataset.forEach(r => {
  console.log(`- ${r.id}: ${r.name} (stops: ${r.stops.length})`);
});
