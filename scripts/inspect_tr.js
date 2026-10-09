import fs from 'node:fs';

const d = JSON.parse(fs.readFileSync('scripts/data/resorts_osm_raw.json', 'utf8'));
const tr = d.elements.find(e => e.id === 9286018);
console.log('Train rouge tags:', tr.tags);
console.log('Train rouge members summary:');
const roles = {};
tr.members.forEach(m => {
  roles[m.role + ':' + m.type] = (roles[m.role + ':' + m.type] || 0) + 1;
});
console.log(roles);
