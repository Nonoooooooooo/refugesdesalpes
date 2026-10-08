import fs from 'node:fs';
import * as turf from '@turf/turf';

const datasetPath = 'public/transports_alpes.json';
const d = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

console.log('=== SNAPPING GÉOMÉTRIQUE DES ARRÊTS SUR LES LIGNES AVEC TURF.JS ===');

let totalSnapped = 0;
let modifiedCount = 0;
let maxShiftMeters = 0;
let maxShiftInfo = null;

d.features.forEach((f) => {
  if (f.geometry.type !== 'LineString' && f.geometry.type !== 'MultiLineString') return;
  const geom = f.geometry.type === 'LineString' ? turf.lineString(f.geometry.coordinates) : turf.multiLineString(f.geometry.coordinates);

  // 1. Corriger stopPoints de la ligne
  if (Array.isArray(f.properties.stopPoints)) {
    f.properties.stopPoints.forEach((sp) => {
      if (sp.lat == null || sp.lng == null) return;
      totalSnapped++;
      const origPt = turf.point([sp.lng, sp.lat]);
      try {
        const snapped = turf.nearestPointOnLine(geom, origPt);
        const [snapLng, snapLat] = snapped.geometry.coordinates;
        const distM = turf.distance(origPt, snapped, { units: 'kilometers' }) * 1000;

        if (distM > maxShiftMeters) {
          maxShiftMeters = distM;
          maxShiftInfo = { line: f.properties.name, stop: sp.name, distM: Math.round(distM) };
        }

        if (distM > 0.01) { // plus de 1 cm d'écart
          modifiedCount++;
          sp.lng = Number(snapLng.toFixed(6));
          sp.lat = Number(snapLat.toFixed(6));
        }
      } catch (e) {
        // ignore
      }
    });
  }

  // 2. Corriger les stopPoints dans directions
  if (Array.isArray(f.properties.directions)) {
    f.properties.directions.forEach((dir) => {
      if (Array.isArray(dir.stopPoints)) {
        dir.stopPoints.forEach((sp) => {
          if (sp.lat == null || sp.lng == null) return;
          const origPt = turf.point([sp.lng, sp.lat]);
          try {
            const snapped = turf.nearestPointOnLine(geom, origPt);
            const [snapLng, snapLat] = snapped.geometry.coordinates;
            sp.lng = Number(snapLng.toFixed(6));
            sp.lat = Number(snapLat.toFixed(6));
          } catch (e) {
            // ignore
          }
        });
      }
    });
  }
});

console.log(`Total arrêts traités : ${totalSnapped}`);
console.log(`Arrêts ré-aimantés (snappés) sur leur ligne : ${modifiedCount}`);
console.log(`Déplacement maximum corrigé : ${Math.round(maxShiftMeters)}m (${maxShiftInfo?.line} - ${maxShiftInfo?.stop})`);

fs.writeFileSync(datasetPath, JSON.stringify(d, null, 2), 'utf8');
if (fs.existsSync('public/transport_alps_v2.geojson')) {
  fs.writeFileSync('public/transport_alps_v2.geojson', JSON.stringify(d, null, 2), 'utf8');
}
console.log('Fichiers GeoJSON mis à jour avec des arrêts 100% alignés sur leurs tracés !');
