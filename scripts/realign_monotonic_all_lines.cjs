const fs = require('fs');
const turf = require('@turf/turf');

const data = JSON.parse(fs.readFileSync('public/transports_alpes.json', 'utf8'));

let fixedLinesCount = 0;
let totalStopsRealigned = 0;

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

  // 1. Initial projections for each stop
  const stops = sps.map((sp, idx) => {
    const snap = turf.nearestPointOnLine(turfLine, [sp.lng, sp.lat]);
    return {
      idx,
      name: sp.name,
      time: sp.time,
      origLng: sp.lng,
      origLat: sp.lat,
      locKm: snap.properties.location,
      distFromLineKm: snap.properties.dist
    };
  });

  // 2. Identify reliable anchor points:
  // Must be within 1.5 km of line (distFromLineKm <= 1.5)
  // Endpoints:
  const valid = new Array(n).fill(false);
  const targetDists = new Array(n).fill(0);

  // Stop 0: anchor at start
  valid[0] = true;
  targetDists[0] = stops[0].distFromLineKm <= 1.5 ? Math.min(stops[0].locKm, lineTotalKm * 0.05) : 0;

  // Stop n-1: anchor at end
  valid[n - 1] = true;
  targetDists[n - 1] = stops[n - 1].distFromLineKm <= 1.5 ? Math.max(stops[n - 1].locKm, lineTotalKm * 0.95) : lineTotalKm;

  // Intermediate stops: check if valid and monotonically increasing
  let lastValidLoc = targetDists[0];
  for (let i = 1; i < n - 1; i++) {
    const st = stops[i];
    // Check if within 1.5km of line and strictly greater than lastValidLoc
    // Also must not jump more than proportional share
    const remainingStops = (n - 1) - i;
    const maxAllowedLoc = lineTotalKm - remainingStops * 0.05; // leave at least 50m per remaining stop
    if (st.distFromLineKm <= 1.5 && st.locKm > lastValidLoc + 0.01 && st.locKm <= maxAllowedLoc) {
      valid[i] = true;
      targetDists[i] = st.locKm;
      lastValidLoc = st.locKm;
    }
  }

  // 3. Interpolate any stops that were not valid anchors
  for (let i = 0; i < n; i++) {
    if (!valid[i]) {
      // Find previous valid anchor
      let prevIdx = i - 1;
      while (prevIdx >= 0 && !valid[prevIdx]) prevIdx--;

      // Find next valid anchor
      let nextIdx = i + 1;
      while (nextIdx < n && !valid[nextIdx]) nextIdx++;

      const prevDist = targetDists[prevIdx];
      const nextDist = targetDists[nextIdx];
      const fraction = (i - prevIdx) / (nextIdx - prevIdx);
      targetDists[i] = prevDist + fraction * (nextDist - prevDist);
    }
  }

  // 4. Reposition each stop strictly along the polyline at targetDists[i]
  let lineChanged = false;
  sps.forEach((sp, idx) => {
    const distKm = Math.max(0, Math.min(lineTotalKm, targetDists[idx]));
    const ptAlong = turf.along(turfLine, distKm, { units: 'kilometers' });
    const newLng = Number(ptAlong.geometry.coordinates[0].toFixed(6));
    const newLat = Number(ptAlong.geometry.coordinates[1].toFixed(6));

    if (Math.abs(newLng - sp.lng) > 0.0001 || Math.abs(newLat - sp.lat) > 0.0001) {
      lineChanged = true;
      totalStopsRealigned++;
    }
    sp.lng = newLng;
    sp.lat = newLat;
  });

  if (lineChanged) fixedLinesCount++;

  // Update directions
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

console.log(`Realigned ${totalStopsRealigned} stops across ${fixedLinesCount} lines.`);

// Save
fs.writeFileSync('public/transports_alpes.json', JSON.stringify(data));
fs.writeFileSync('public/transport_alps_v2.geojson', JSON.stringify(data));
console.log('Saved to public/transports_alpes.json & public/transport_alps_v2.geojson');
