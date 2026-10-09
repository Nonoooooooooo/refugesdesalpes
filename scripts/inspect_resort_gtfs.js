import fs from 'node:fs';
import path from 'node:path';

function inspectGTFS(dirName) {
  const p = path.join('imports', dirName);
  console.log(`\n=================== ${dirName.toUpperCase()} ===================`);
  if (!fs.existsSync(p)) return;

  const routes = {};
  if (fs.existsSync(path.join(p, 'routes.txt'))) {
    const lines = fs.readFileSync(path.join(p, 'routes.txt'), 'utf8').split('\n');
    for (let i = 1; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) continue;
      const parts = l.split(',').map(s => s.replace(/"/g, '').trim());
      routes[parts[0]] = {
        id: parts[0],
        short: parts[2],
        long: parts[3],
        color: parts[7] ? '#' + parts[7] : '#008BD2'
      };
    }
  }

  let stopCount = 0;
  if (fs.existsSync(path.join(p, 'stops.txt'))) {
    stopCount = fs.readFileSync(path.join(p, 'stops.txt'), 'utf8').split('\n').filter(l => l.trim()).length - 1;
  }

  let tripCount = 0;
  if (fs.existsSync(path.join(p, 'trips.txt'))) {
    tripCount = fs.readFileSync(path.join(p, 'trips.txt'), 'utf8').split('\n').filter(l => l.trim()).length - 1;
  }

  console.log(`Routes: ${Object.keys(routes).length} | Stops: ${stopCount} | Trips: ${tripCount}`);
  for (const r of Object.values(routes)) {
    console.log(`  - [${r.short}] ${r.long} (Color: ${r.color})`);
  }
}

['savoie', 'bourg_saint_maurice', 'funiculaire_arcs', 'meribus', 'courchevel', 'belleville', 'deux_alpes', 'la_rosiere'].forEach(inspectGTFS);
