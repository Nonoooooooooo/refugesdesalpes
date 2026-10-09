import fs from 'node:fs';

const d = JSON.parse(fs.readFileSync('scripts/data/resorts_osm_raw.json', 'utf8'));
console.log('Total elements:', d.elements.length);
d.elements.forEach(e => {
  const members = e.members || [];
  const ways = members.filter(m => m.type === 'way');
  const stops = members.filter(m => m.role === 'stop' || m.role === 'platform');
  console.log(`ID ${e.id} | [${e.tags.ref || '-'}] ${e.tags.name} | ways: ${ways.length}, stops: ${stops.length}`);
});
