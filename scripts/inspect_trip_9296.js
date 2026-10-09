import fs from 'node:fs';

const treStops = {};
fs.readFileSync('imports/trenitalia/stops.txt', 'utf8')
  .split('\n')
  .forEach((l) => {
    const p = l.split(',');
    if (p[0] && p[1]) treStops[p[0]] = { id: p[0], name: p[1], lat: parseFloat(p[2]), lon: parseFloat(p[3]) };
  });

console.log('--- TRENITALIA TRIP 9296 (PARIS - MILAN VIA ALPES) ---');
const stLines = fs.readFileSync('imports/trenitalia/stop_times.txt', 'utf8').split('\n');
const trip9296Stops = [];
stLines.forEach((l) => {
  const p = l.split(',');
  if (p[0] === '69334') { // tripId 69334 (route 9296)
    const s = treStops[p[3]];
    if (s) trip9296Stops.push({ ...s, seq: parseInt(p[4]) });
  }
});
trip9296Stops.sort((a, b) => a.seq - b.seq);
trip9296Stops.forEach((s) => console.log(`[seq ${s.seq}] ${s.name} (${s.lat}, ${s.lon})`));
