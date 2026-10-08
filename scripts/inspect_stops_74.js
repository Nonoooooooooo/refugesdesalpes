import fs from 'node:fs';

const stops = fs.readFileSync('scripts/gtfs_74/stops.txt', 'utf8').split('\n');
console.log('Total stops count:', stops.length - 1);

const targetKeywords = ['morzine', 'avoriaz', 'prodains', 'gets', 'aulps', 'montriond', 'téléphérique'];
const matchingStops = [];

for (let i = 1; i < stops.length; i++) {
  const line = stops[i].trim();
  if (!line) continue;
  const parts = line.split(',');
  const stopId = parts[0];
  const stopName = parts[2] ? parts[2].replace(/"/g, '') : '';
  const lat = parts[4];
  const lon = parts[5];
  
  if (targetKeywords.some(k => stopName.toLowerCase().includes(k))) {
    matchingStops.push({ stopId, stopName, lat, lon });
  }
}

console.log(`Found ${matchingStops.length} stops matching Morzine / Avoriaz area:`);
matchingStops.slice(0, 40).forEach(s => console.log(`- ${s.stopName} (${s.lat}, ${s.lon}) [ID: ${s.stopId}]`));
