import fs from 'node:fs';

const resorts = JSON.parse(fs.readFileSync('scripts/data/resorts_osm_raw.json', 'utf8'));
const tags = JSON.parse(fs.readFileSync('scripts/data/resorts_stop_tags.json', 'utf8'));

function distSq(c1, c2) {
  const dx = c1[0] - c2[0];
  const dy = c1[1] - c2[1];
  return dx * dx + dy * dy;
}

function projectPointOnSegment(p, a, b) {
  const ax = a[0], ay = a[1];
  const bx = b[0], by = b[1];
  const px = p[0], py = p[1];
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return [ax, ay];
  let t = ((px - ax) * abx + (py - ay) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return [Number((ax + t * abx).toFixed(6)), Number((ay + t * aby).toFixed(6))];
}

function snapToPolyline(point, polyline) {
  let bestDist = Infinity;
  let bestPoint = point;
  for (let i = 0; i < polyline.length - 1; i++) {
    const proj = projectPointOnSegment(point, polyline[i], polyline[i + 1]);
    const d = distSq(point, proj);
    if (d < bestDist) {
      bestDist = d;
      bestPoint = proj;
    }
  }
  return bestPoint;
}

function stitchWays(ways) {
  if (!ways || ways.length === 0) return [];
  // each way is array of [lon, lat]
  const segments = ways.map(w => w.geometry.map(pt => [Number(pt.lon.toFixed(6)), Number(pt.lat.toFixed(6))]));
  
  // Greedy chain stitching
  const polyline = [...segments[0]];
  const remaining = segments.slice(1);

  while (remaining.length > 0) {
    const currentEnd = polyline[polyline.length - 1];
    let bestIdx = -1;
    let bestReverse = false;
    let minDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const seg = remaining[i];
      const startDist = distSq(currentEnd, seg[0]);
      const endDist = distSq(currentEnd, seg[seg.length - 1]);

      if (startDist < minDist) {
        minDist = startDist;
        bestIdx = i;
        bestReverse = false;
      }
      if (endDist < minDist) {
        minDist = endDist;
        bestIdx = i;
        bestReverse = true;
      }
    }

    if (bestIdx === -1) break;

    const chosen = remaining.splice(bestIdx, 1)[0];
    const pts = bestReverse ? chosen.reverse() : chosen;
    // Skip duplicate first point
    for (let j = 0; j < pts.length; j++) {
      if (polyline.length === 0 || polyline[polyline.length - 1][0] !== pts[j][0] || polyline[polyline.length - 1][1] !== pts[j][1]) {
        polyline.push(pts[j]);
      }
    }
  }

  return polyline;
}

resorts.elements.forEach(rel => {
  const ways = (rel.members || []).filter(m => m.type === 'way' && m.geometry && m.geometry.length > 0);
  const stops = (rel.members || []).filter(m => m.type === 'node');
  const poly = stitchWays(ways);
  console.log(`Rel ${rel.id} [${rel.tags?.ref || '-'}] "${rel.tags?.name}": ${poly.length} pts, ${stops.length} stop nodes`);
});
