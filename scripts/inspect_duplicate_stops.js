import fs from 'node:fs';

const d = JSON.parse(fs.readFileSync('public/transports_alpes.json', 'utf8'));

const issues = [];
d.features.forEach((f) => {
  if (f.geometry.type !== 'LineString' && f.geometry.type !== 'MultiLineString') return;
  const p = f.properties || {};
  const stops = p.stops || [];

  const seen = new Map();
  stops.forEach((s, i) => {
    const name = typeof s === 'string' ? s.trim().toLowerCase() : (s.name || '').trim().toLowerCase();
    if (!name) return;
    if (!seen.has(name)) seen.set(name, []);
    seen.get(name).push(i);
  });

  const dups = [...seen.entries()].filter(([k, idxs]) => idxs.length > 1);
  if (dups.length > 0) {
    issues.push({
      id: p.id || f.id,
      ref: p.ref,
      name: p.name,
      totalStops: stops.length,
      dupCount: dups.length,
      dupsSample: dups.slice(0, 4).map(([k, idxs]) => ({ name: k, indices: idxs })),
      stops: stops
    });
  }
});

console.log('Total lignes avec arrêts dupliqués dans stops:', issues.length);
issues.forEach((iss) => {
  console.log(`[${iss.ref || 'Sans ref'}] ${iss.name} (${iss.totalStops} arrêts, ${iss.dupCount} dupliqués)`);
  console.log('   Exemples:', JSON.stringify(iss.dupsSample));
});
