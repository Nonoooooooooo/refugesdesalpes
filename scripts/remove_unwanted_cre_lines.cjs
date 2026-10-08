const fs = require('fs');

const EXCLUDED_REFS = new Set(['X76', 'X73', 'X18', 'X13', 'X25']);
const EXCLUDED_IDS = new Set(['cars-express-x76', 'cars-express-x73', 'cars-express-x18', 'cars-express-x13', 'cars-express-x25']);

console.log('=== REMOVING EXCLUDED CARS REGION EXPRESS LINES: X76, X73, X18, X13, X25 ===');

// 1. Update public/transports_alpes.json
const datasetPath = 'public/transports_alpes.json';
const data = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
const initialCount = data.features.length;

data.features = data.features.filter(f => {
  const p = f.properties || {};
  const ref = (p.ref || '').toUpperCase();
  const id = (p.id || '').toLowerCase();
  if (EXCLUDED_REFS.has(ref) || EXCLUDED_IDS.has(id)) {
    console.log(`Removing feature from transports_alpes.json: ${p.id} (${p.ref} - ${p.name})`);
    return false;
  }
  return true;
});

console.log(`transports_alpes.json: ${initialCount} -> ${data.features.length} features (-${initialCount - data.features.length})`);
fs.writeFileSync('public/transports_alpes.json', JSON.stringify(data));
fs.writeFileSync('public/transport_alps_v2.geojson', JSON.stringify(data));

// 2. Update scripts/data/cars_region_express_final.json
const crePath = 'scripts/data/cars_region_express_final.json';
if (fs.existsSync(crePath)) {
  const creRoutes = JSON.parse(fs.readFileSync(crePath, 'utf8'));
  const initialCreCount = creRoutes.length;
  const filteredCre = creRoutes.filter(r => {
    const ref = (r.ref || '').toUpperCase();
    const id = (r.id || '').toLowerCase();
    if (EXCLUDED_REFS.has(ref) || EXCLUDED_IDS.has(id)) {
      console.log(`Removing route from cars_region_express_final.json: ${r.id} (${r.ref} - ${r.name})`);
      return false;
    }
    return true;
  });
  console.log(`cars_region_express_final.json: ${initialCreCount} -> ${filteredCre.length} routes (-${initialCreCount - filteredCre.length})`);
  fs.writeFileSync(crePath, JSON.stringify(filteredCre, null, 2));
}

console.log('\nDone removing X76, X73, X18, X13, X25 successfully!');
