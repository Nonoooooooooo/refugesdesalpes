import fs from 'node:fs';
import path from 'node:path';

const dirs = [
  'ain',
  'alpe_huez',
  'bourg_saint_maurice',
  'drome',
  'funiculaire_arcs',
  'la_rosiere',
  'meribus',
  'deux_alpes',
  'courchevel',
  'belleville',
  'savoie',
  'valdisere',
  'valmorel'
];

console.log('=== INSPECTION OF EXTRACTED IMPORTS ===');

for (const d of dirs) {
  const p = path.join('imports', d);
  if (!fs.existsSync(p)) {
    console.log(`Directory ${p} does not exist`);
    continue;
  }
  const files = fs.readdirSync(p);
  console.log(`\n📁 [${d}] (${files.length} files: ${files.slice(0, 8).join(', ')}...)`);

  // Check agency.txt
  if (fs.existsSync(path.join(p, 'agency.txt'))) {
    const lines = fs.readFileSync(path.join(p, 'agency.txt'), 'utf8').split('\n');
    console.log(`   Agency: ${lines[1] ? lines[1].trim() : 'N/A'}`);
  }

  // Check routes.txt
  if (fs.existsSync(path.join(p, 'routes.txt'))) {
    const lines = fs.readFileSync(path.join(p, 'routes.txt'), 'utf8').split('\n');
    const routeHeaders = lines[0].split(',').map(s => s.replace(/"/g, '').trim());
    console.log(`   Total routes in routes.txt: ${lines.length - 1}`);
    lines.slice(1, 10).forEach(l => {
      if (!l.trim()) return;
      const parts = l.split(',').map(s => s.replace(/"/g, '').trim());
      console.log(`     - [${parts[2] || parts[0]}] ${parts[3] || ''} (color: ${parts[7] || 'default'})`);
    });
    if (lines.length > 11) console.log(`     ... and ${lines.length - 11} more routes`);
  }

  // Check shapes.txt
  if (fs.existsSync(path.join(p, 'shapes.txt'))) {
    const stat = fs.statSync(path.join(p, 'shapes.txt'));
    console.log(`   shapes.txt: ${(stat.size / 1024).toFixed(1)} KB`);
  } else {
    console.log(`   shapes.txt: NOT FOUND`);
  }
}
