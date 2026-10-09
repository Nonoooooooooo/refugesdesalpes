const fs = require('fs');
const turf = require('@turf/turf');

const data = JSON.parse(fs.readFileSync('public/transports_alpes.json', 'utf8'));

// Longest Increasing Subsequence with minimum gap
function findLIS(arr, minGap = 0.02) {
  const n = arr.length;
  if (n <= 2) return [0, n - 1];

  // We MUST include 0 and n - 1 if possible
  // Standard dynamic programming for LIS
  const dp = new Array(n).fill(1);
  const parent = new Array(n).fill(-1);

  for (let i = 1; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (arr[i] >= arr[j] + minGap && dp[j] + 1 > dp[i]) {
        dp[i] = dp[j] + 1;
        parent[i] = j;
      }
    }
  }

  // Find max in dp
  let maxLen = 0;
  let bestEnd = n - 1;
  for (let i = 0; i < n; i++) {
    if (dp[i] > maxLen) {
      maxLen = dp[i];
      bestEnd = i;
    }
  }

  // Backtrack
  const lisIndices = [];
  let curr = bestEnd;
  while (curr !== -1) {
    lisIndices.unshift(curr);
    curr = parent[curr];
  }

  // Ensure 0 is first and n-1 is last
  if (lisIndices[0] !== 0) lisIndices.unshift(0);
  if (lisIndices[lisIndices.length - 1] !== n - 1) lisIndices.push(n - 1);

  return lisIndices;
}

let fixedLines = 0;

data.features.forEach(f => {
  const p = f.properties || {};
  if (!f.geometry || (f.geometry.type !== 'LineString' && f.geometry.type !== 'MultiLineString')) return;
  if (!p.id) return;

  const isMulti = f.geometry.type === 'MultiLineString';
  const coords = isMulti ? f.geometry.coordinates[0] : f.geometry.coordinates;
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
  if (sps.length < 3) return;

  const n = sps.length;

  // 1. Project all stops
  const rawLocs = sps.map((sp, idx) => {
    const snap = turf.nearestPointOnLine(turfLine, [sp.lng, sp.lat]);
    let loc = snap.properties.location;
    // Pin terminals
    if (idx === 0) loc = 0;
    if (idx === n - 1) loc = lineTotalKm;
    return loc;
  });

  // Check if already strictly monotonic
  let isMonotonic = true;
  for (let i = 1; i < n; i++) {
    if (rawLocs[i] < rawLocs[i - 1] + 0.01) {
      isMonotonic = false;
      break;
    }
  }

  if (isMonotonic) return;

  fixedLines++;

  // 2. Compute LIS of valid projected stops
  const lisIndices = findLIS(rawLocs, 0.01);
  const lisSet = new Set(lisIndices);

  const finalLocs = new Array(n);
  // Fill LIS locations
  lisIndices.forEach(idx => {
    finalLocs[idx] = rawLocs[idx];
  });
  finalLocs[0] = 0;
  finalLocs[n - 1] = lineTotalKm;

  // 3. Interpolate non-LIS locations
  for (let i = 0; i < n; i++) {
    if (!lisSet.has(i)) {
      // Find prev LIS
      let pIdx = i - 1;
      while (pIdx >= 0 && !lisSet.has(pIdx)) pIdx--;
      if (pIdx < 0) pIdx = 0;

      // Find next LIS
      let nIdx = i + 1;
      while (nIdx < n && !lisSet.has(nIdx)) nIdx++;
      if (nIdx >= n) nIdx = n - 1;

      const pLoc = finalLocs[pIdx];
      const nLoc = finalLocs[nIdx];
      const frac = (i - pIdx) / (nIdx - pIdx);
      finalLocs[i] = pLoc + frac * (nLoc - pLoc);
    }
  }

  // Ensure strict monotonicity with tiny epsilon
  for (let i = 1; i < n; i++) {
    if (finalLocs[i] <= finalLocs[i - 1]) {
      finalLocs[i] = finalLocs[i - 1] + 0.005;
    }
  }

  // 4. Update coordinates along line
  sps.forEach((sp, idx) => {
    const targetKm = Math.max(0, Math.min(lineTotalKm, finalLocs[idx]));
    const ptAlong = turf.along(turfLine, targetKm, { units: 'kilometers' });
    sp.lng = Number(ptAlong.geometry.coordinates[0].toFixed(6));
    sp.lat = Number(ptAlong.geometry.coordinates[1].toFixed(6));
  });

  // 5. Update directions
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

console.log(`LIS Monotonic Fix applied to ${fixedLines} lines.`);

fs.writeFileSync('public/transports_alpes.json', JSON.stringify(data));
fs.writeFileSync('public/transport_alps_v2.geojson', JSON.stringify(data));
console.log('Saved to public/transports_alpes.json & public/transport_alps_v2.geojson');
