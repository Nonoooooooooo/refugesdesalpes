import fs from 'node:fs';
import * as turf from '@turf/turf';

const d = JSON.parse(fs.readFileSync('public/transports_alpes.json', 'utf8'));

let totalStops = 0;
const gaps = [];

d.features.forEach((f) => {
  if (f.geometry.type !== 'LineString' && f.geometry.type !== 'MultiLineString') return;
  const multi = f.geometry.type === 'LineString' ? turf.lineString(f.geometry.coordinates) : turf.multiLineString(f.geometry.coordinates);
  const sps = f.properties.stopPoints || [];

  sps.forEach((sp) => {
    if (sp.lat == null || sp.lng == null) return;
    totalStops++;
    const pt = turf.point([sp.lng, sp.lat]);
    try {
      const snapped = turf.nearestPointOnLine(multi, pt);
      const distKm = turf.distance(pt, snapped, { units: 'kilometers' });
      const distM = distKm * 1000;
      if (distM > 5) { // Écart supérieur à 5 mètres
        gaps.push({ line: f.properties.name, stop: sp.name, distM: Math.round(distM), original: [sp.lng, sp.lat], snapped: snapped.geometry.coordinates });
      }
    } catch (e) {
      // ignore
    }
  });
});

console.log('=== DIAGNOSTIC SIG DES ARRÊTS ===');
console.log('Total arrêts analysés:', totalStops);
console.log('Arrêts à plus de 5 mètres de leur ligne:', gaps.length);
console.log('Arrêts à plus de 20 mètres de leur ligne:', gaps.filter(g => g.distM > 20).length);
console.log('Arrêts à plus de 50 mètres de leur ligne:', gaps.filter(g => g.distM > 50).length);

console.log('\nTop 15 des plus grands écarts :');
gaps.sort((a, b) => b.distM - a.distM);
gaps.slice(0, 15).forEach(g => {
  console.log(`- [${g.distM}m] ${g.line} ➔ "${g.stop}"`);
});
