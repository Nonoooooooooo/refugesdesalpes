import fs from 'node:fs';

const d = JSON.parse(fs.readFileSync('public/transports_alpes.json', 'utf8'));

const y02 = d.features.find((f) => f.properties.ref === 'Y02');
console.log('Y02 total stops:', y02.properties.stops.length);
y02.properties.stops.forEach((s, idx) => console.log(`[${idx}] ${s}`));
