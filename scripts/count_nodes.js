import fs from 'node:fs';

const d = JSON.parse(fs.readFileSync('scripts/data/resorts_osm_raw.json', 'utf8'));
const nodeIds = new Set();
d.elements.forEach(e => {
  (e.members || []).forEach(m => {
    if (m.type === 'node') {
      nodeIds.add(m.ref);
    }
  });
});
console.log(`Total unique node members across all relations: ${nodeIds.size}`);
