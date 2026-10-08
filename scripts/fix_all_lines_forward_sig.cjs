const fs = require('fs');
const turf = require('@turf/turf');

const datasetPath = 'public/transports_alpes.json';
const data = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

console.log('=== FORWARD-CONSTRAINED SIG REALIGNMENT FOR ALL LINES ===');

let totalRealignedLines = 0;
let totalStopsProcessed = 0;

data.features.forEach(f => {
  const p = f.properties || {};
  if (!f.geometry || (f.geometry.type !== 'LineString' && f.geometry.type !== 'MultiLineString')) return;
  if (!p.id) return;

  const isMulti = f.geometry.type === 'MultiLineString';
  let coords = isMulti ? f.geometry.coordinates[0] : f.geometry.coordinates;
  if (!coords || coords.length < 2) return;

  let turfLine;
  try {
    turfLine = turf.lineString(coords);
  } catch (e) {
    return;
  }

  const lineTotalKm = turf.length(turfLine, { units: 'kilometers' });
  if (lineTotalKm <= 0.01) return;

  const sps = p.stopPoints || [];
  if (sps.length < 2) return;

  const n = sps.length;

  // Step 1: Forward-constrained location search along the line
  const forwardLocs = new Array(n);
  let currentKm = 0;

  sps.forEach((s, idx) => {
    if (idx === 0) {
      forwardLocs[0] = 0;
      currentKm = 0;
      return;
    }
    if (idx === n - 1) {
      forwardLocs[n - 1] = lineTotalKm;
      return;
    }

    const remainingStops = (n - 1) - idx;
    const maxAllowedKm = lineTotalKm - remainingStops * 0.03; // ensure at least 30m per stop

    let bestLoc = currentKm + 0.03;
    if (currentKm < maxAllowedKm) {
      try {
        const sliced = turf.lineSliceAlong(turfLine, currentKm, lineTotalKm, { units: 'kilometers' });
        const snap = turf.nearestPointOnLine(sliced, [s.lng, s.lat]);
        const candLoc = currentKm + snap.properties.location;
        const distFromSliceKm = snap.properties.dist;

        // If candidate is reasonable (within 1.5km of slice and before maxAllowedKm)
        if (distFromSliceKm <= 1.5 && candLoc <= maxAllowedKm && candLoc > currentKm) {
          bestLoc = candLoc;
        } else {
          // If candidate is too far or past maxAllowedKm, proportionally advance
          const sliceSpan = Math.max(0.05, maxAllowedKm - currentKm);
          bestLoc = currentKm + (sliceSpan / (remainingStops + 1));
        }
      } catch (e) {
        bestLoc = currentKm + 0.05;
      }
    } else {
      bestLoc = Math.min(lineTotalKm, currentKm + 0.02);
    }

    forwardLocs[idx] = Math.min(maxAllowedKm, Math.max(currentKm + 0.01, bestLoc));
    currentKm = forwardLocs[idx];
  });

  // Step 2: Strictly enforce monotonicity
  forwardLocs[0] = 0;
  forwardLocs[n - 1] = lineTotalKm;
  for (let i = 1; i < n; i++) {
    if (forwardLocs[i] <= forwardLocs[i - 1]) {
      forwardLocs[i] = forwardLocs[i - 1] + 0.01;
    }
  }

  // Step 3: Reposition each stop point exactly along the polyline at forwardLocs[idx]
  let hasMod = false;
  sps.forEach((sp, idx) => {
    const loc = Math.max(0, Math.min(lineTotalKm, forwardLocs[idx]));
    const ptAlong = turf.along(turfLine, loc, { units: 'kilometers' });
    const newLng = Number(ptAlong.geometry.coordinates[0].toFixed(6));
    const newLat = Number(ptAlong.geometry.coordinates[1].toFixed(6));

    if (Math.abs(newLng - sp.lng) > 0.00005 || Math.abs(newLat - sp.lat) > 0.00005) {
      hasMod = true;
    }
    sp.lng = newLng;
    sp.lat = newLat;
    totalStopsProcessed++;
  });

  if (hasMod) totalRealignedLines++;

  // Step 4: Update Aller / Retour directions
  const allerStopPoints = sps.map(s => ({ ...s }));
  const retourStopPoints = sps.map(s => ({ ...s })).reverse();
  const allerStops = sps.map(s => s.name);
  const retourStops = [...allerStops].reverse();

  p.directions = [
    {
      id: 'aller',
      name: `Vers ${allerStops[allerStops.length - 1]}`,
      origin: allerStops[0],
      destination: allerStops[allerStops.length - 1],
      stops: allerStops,
      stopPoints: allerStopPoints,
      timetable: p.directions?.[0]?.timetable || p.timetable || null
    },
    {
      id: 'retour',
      name: `Vers ${allerStops[0]}`,
      origin: allerStops[allerStops.length - 1],
      destination: allerStops[0],
      stops: retourStops,
      stopPoints: retourStopPoints,
      timetable: p.directions?.[1]?.timetable || null
    }
  ];
});

console.log(`Finished: ${totalStopsProcessed} stops processed, ${totalRealignedLines} lines realigned.`);

fs.writeFileSync('public/transports_alpes.json', JSON.stringify(data));
fs.writeFileSync('public/transport_alps_v2.geojson', JSON.stringify(data));
console.log('Saved to public/transports_alpes.json & public/transport_alps_v2.geojson');
