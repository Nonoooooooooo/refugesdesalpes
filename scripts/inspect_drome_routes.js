import fs from 'node:fs';

const lines = fs.readFileSync('imports/drome/routes.txt', 'utf8').split('\n');
console.log(`Total routes in Drôme GTFS: ${lines.length - 1}`);

const alpineKeywords = ['vercors', 'diois', 'die', 'saillans', 'crest', 'nyons', 'royans', 'pont-en-royans', 'chapelle', 'vassieux', 'buis', 'luc-en-diois', 'valreas', 'montelimar', 'valence', 'romans'];

const alpineRoutes = [];
for (let i = 1; i < lines.length; i++) {
  const l = lines[i].trim();
  if (!l) continue;
  const parts = l.split(',').map(s => s.replace(/"/g, '').trim());
  const ref = parts[2];
  const name = parts[3];
  const lower = (ref + ' ' + name).toLowerCase();
  if (alpineKeywords.some(k => lower.includes(k))) {
    alpineRoutes.push({ ref, name, color: parts[7] });
  }
}

console.log(`Found ${alpineRoutes.length} alpine/prealpine routes in Drôme:`);
alpineRoutes.slice(0, 30).forEach(r => console.log(`  - [${r.ref}] ${r.name} (#${r.color})`));
if (alpineRoutes.length > 30) console.log(`  ... and ${alpineRoutes.length - 30} more`);
