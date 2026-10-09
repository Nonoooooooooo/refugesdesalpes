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

for (const r of routes) {
  const far = [];
  for (const sp of r.stopPoints) {
    const { distMeters } = projectPointOnPolyline(sp.coord, r.directCoordinates);
    if (distMeters > 300) {
      far.push({ name: sp.name, dist: distMeters });
    }
  }
  if (far.length > 0) {
    console.log(`Route ${r.short_name}: ${far.length} stops > 300m away (e.g. ${far[0].name}: ${far[0].dist.toFixed(0)}m, ${far[far.length-1].name}: ${far[far.length-1].dist.toFixed(0)}m)`);
  }
}
