import fs from 'node:fs';

const d = JSON.parse(fs.readFileSync('scripts/data/resorts_osm_raw.json', 'utf8'));
const tr = d.elements.find(e => e.id === 9286018);
const nodes = tr.members.filter(m => m.type === 'node');
console.log('Sample node members in Train Rouge:', nodes.slice(0, 5));
