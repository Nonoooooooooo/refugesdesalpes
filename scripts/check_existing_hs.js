import fs from 'node:fs';

const content = fs.readFileSync('scripts/build_transport_dataset.js', 'utf8');

// Find all items in BUS_ROUTES
const matches = [...content.matchAll(/id:\s*['"]([^'"]+)['"],\s*ref:\s*['"]([^'"]+)['"],\s*name:\s*['"]([^'"]+)['"]/g)];

console.log('Matches in build_transport_dataset.js:');
const keywords = ['chamonix', 'sixt', 'clusaz', 'aravis', 'sallanches', 'annecy', 'thonon', 'morzine', 'contamines', 'megeve', 'grand-bornand', 'y02', 'y62', 'y81', 'y82', 'y83', 'y84', 'y91', 'y92', 'y94', '272', '274'];

for (const m of matches) {
  const [full, id, ref, name] = m;
  const lower = (id + ' ' + ref + ' ' + name).toLowerCase();
  if (keywords.some(k => lower.includes(k))) {
    console.log(`- [${id}] ref: "${ref}" | name: "${name}"`);
  }
}
