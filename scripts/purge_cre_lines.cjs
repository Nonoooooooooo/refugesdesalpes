const fs = require('fs');

const EXCLUDED_REFS = new Set([
  'X13', 'X18', 'X25',
  'X51', 'X71', 'X73', 'X74', 'X75', 'X76'
]);

const EXCLUDED_IDS = new Set([
  'cars-express-x13', 'cars-express-x18', 'cars-express-x25',
  'cars-express-x51', 'cars-express-x71', 'cars-express-x73',
  'cars-express-x74', 'cars-express-x75', 'cars-express-x76'
]);

console.log('=== REMOVING ALL REQUESTED NON-ALPINE CARS REGION EXPRESS LINES ===');
console.log('Target refs:', Array.from(EXCLUDED_REFS).join(', '));

// 1. Process public/transports_alpes.json & public/transport_alps_v2.geojson
['public/transports_alpes.json', 'public/transport_alps_v2.geojson'].forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const initial = data.features.length;

  data.features = data.features.filter(f => {
    const p = f.properties || {};
    const ref = (p.ref || '').toUpperCase();
    const id = (p.id || '').toLowerCase();

    if (EXCLUDED_REFS.has(ref) || EXCLUDED_IDS.has(id)) {
      console.log(`[${filePath}] Removing: ${p.id} (${p.ref} - ${p.name})`);
      return false;
    }
    return true;
  });

  // Clean references in station hubs
  data.features.forEach(f => {
    const p = f.properties || {};
    if (p.id === 'st-valence-tgv') {
      p.stops = ['TGV Méditerranée', 'TER Valence - Grenoble', 'Ligne des Alpes'];
    }
    if (p.id === 'st-nyons') {
      p.stops = ['Cars Région D36, D37, D38, D44 (Baronnies Provençales)'];
    }
    if (Array.isArray(p.stops)) {
      p.stops = p.stops.filter(s => {
        return !Array.from(EXCLUDED_REFS).some(r => new RegExp('\\b' + r + '\\b', 'i').test(s));
      });
    }
  });

  console.log(`[${filePath}] ${initial} -> ${data.features.length} (-${initial - data.features.length})`);
  fs.writeFileSync(filePath, JSON.stringify(data));
});

// 2. Process scripts/data/cars_region_express_final.json
const crePath = 'scripts/data/cars_region_express_final.json';
if (fs.existsSync(crePath)) {
  const routes = JSON.parse(fs.readFileSync(crePath, 'utf8'));
  const initial = routes.length;
  const filtered = routes.filter(r => {
    const ref = (r.ref || '').toUpperCase();
    const id = (r.id || '').toLowerCase();
    if (EXCLUDED_REFS.has(ref) || EXCLUDED_IDS.has(id)) {
      console.log(`[${crePath}] Removing: ${r.id} (${r.ref} - ${r.name})`);
      return false;
    }
    return true;
  });
  console.log(`[${crePath}] ${initial} -> ${filtered.length} (-${initial - filtered.length})`);
  fs.writeFileSync(crePath, JSON.stringify(filtered, null, 2));
}

console.log('Removal completed successfully!');
