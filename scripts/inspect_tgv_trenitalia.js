import fs from 'node:fs';

console.log('=== TRENITALIA ROUTES ===');
const treLines = fs.readFileSync('imports/trenitalia/routes.txt', 'utf8').split('\n');
treLines.slice(0, 15).forEach((l) => console.log(l));

console.log('\n=== TRENITALIA STOPS ===');
const treStops = fs.readFileSync('imports/trenitalia/stops.txt', 'utf8').split('\n');
treStops.forEach((l) => console.log(l));

console.log('\n=== TGV ROUTES (sample) ===');
const tgvLines = fs.readFileSync('imports/tgv/routes.txt', 'utf8').split('\n');
tgvLines.slice(0, 25).forEach((l) => console.log(l));
