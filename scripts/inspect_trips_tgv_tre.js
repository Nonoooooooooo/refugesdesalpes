import fs from 'node:fs';

console.log('--- INSPECTION TRENITALIA TRIPS & STOPS ---');
const treTrips = fs.readFileSync('imports/trenitalia/trips.txt', 'utf8').split('\n');
console.log('Trenitalia trips header:', treTrips[0]);
console.log('Sample trips:');
treTrips.slice(1, 10).forEach((t) => console.log(t));

const treStopTimes = fs.readFileSync('imports/trenitalia/stop_times.txt', 'utf8').split('\n');
console.log('Trenitalia stop_times sample:');
treStopTimes.slice(0, 15).forEach((st) => console.log(st));

console.log('\n--- TGV TRIPS SAMPLE FOR PARIS-TARENTAISE & PARIS-GRENOBLE ---');
const tgvTripsStream = fs.readFileSync('imports/tgv/trips.txt', 'utf8');
const lines = tgvTripsStream.split('\n');
const targetRouteIds = [
  'FR:Line::1E753DF8-B3B7-4FFE-BF59-46FC27595D6E:', // Paris - Tarentaise TGV
  'FR:Line::D9F206DE-37B5-4299-A71A-5B4201D0B9F9:', // Paris - Grenoble TGV
  'FR:Line::60faff89-b743-4b4b-a86b-3c0537769bfa:', // Paris - Chambéry - Annecy TGV
  'FR:Line::4767DC65-0993-4961-B6EC-E5BF6DFFB291:', // Paris - Maurienne TGV
];

const foundTrips = [];
for (let i = 1; i < lines.length; i++) {
  const l = lines[i];
  if (!l) continue;
  for (const rId of targetRouteIds) {
    if (l.startsWith(rId) || l.includes(rId)) {
      foundTrips.push(l);
      break;
    }
  }
  if (foundTrips.length >= 10) break;
}
foundTrips.forEach((t) => console.log(t));
