import fs from 'node:fs';

const routes = JSON.parse(fs.readFileSync('scripts/data/haute_savoie_parsed.json', 'utf8'));

function projectPointOnSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return a;
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return [a[0] + t * dx, a[1] + t * dy];
}

function projectPointOnPolyline(point, polylineCoords) {
  let bestPoint = polylineCoords[0];
  let bestDistSq = Infinity;
  for (let i = 0; i < polylineCoords.length - 1; i++) {
    const proj = projectPointOnSegment(point, polylineCoords[i], polylineCoords[i + 1]);
    const dx = point[0] - proj[0];
    const dy = point[1] - proj[1];
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestPoint = proj;
    }
  }
  return { proj: bestPoint, distMeters: Math.sqrt(bestDistSq) * 111320 };
}

let totalStops = 0;
let maxDist = 0;
let farStops = 0;

for (const r of routes) {
  for (const sp of r.stopPoints) {
    totalStops++;
    const { proj, distMeters } = projectPointOnPolyline(sp.coord, r.directCoordinates);
    if (distMeters > maxDist) maxDist = distMeters;
    if (distMeters > 300) {
      farStops++;
    }
  }
}

console.log(`Total stops checked: ${totalStops}`);
console.log(`Max distance to line: ${maxDist.toFixed(1)}m`);
console.log(`Stops > 300m from line: ${farStops}`);
