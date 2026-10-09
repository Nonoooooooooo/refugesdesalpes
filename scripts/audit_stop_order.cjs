const fs = require('fs');

const data = JSON.parse(fs.readFileSync('public/transports_alpes.json', 'utf8'));

console.log('Auditing stop monotonic progress along line polylines...');

function getDistAlong(poly, pt) {
  let bestDistAlong = 0;
  let minLatDist = Infinity;
  let cum = 0;
  
  for (let i = 0; i < poly.length - 1; i++) {
    const p1 = poly[i];
    const p2 = poly[i+1];
    const segLen = Math.hypot((p2[0] - p1[0]) * 78, (p2[1] - p1[1]) * 111);
    
    // Project pt onto segment
    const dx = (p2[0] - p1[0]) * 78;
    const dy = (p2[1] - p1[1]) * 111;
    const l2 = dx * dx + dy * dy;
    let t = l2 === 0 ? 0 : (((pt.lng - p1[0]) * 78 * dx + (pt.lat - p1[1]) * 111 * dy) / l2);
    t = Math.max(0, Math.min(1, t));
    
    const projX = p1[0] * 78 + t * (p2[0] - p1[0]) * 78;
    const projY = p1[1] * 111 + t * (p2[1] - p1[1]) * 111;
    const dist = Math.hypot(pt.lng * 78 - projX, pt.lat * 111 - projY);
    
    if (dist < minLatDist) {
      minLatDist = dist;
      bestDistAlong = cum + t * segLen;
    }
    cum += segLen;
  }
  return { distAlong: bestDistAlong, totalLen: cum, latDist: minLatDist };
}

const badOrderLines = [];

data.features.forEach(f => {
  const p = f.properties || {};
  if (!f.geometry || (f.geometry.type !== 'LineString' && f.geometry.type !== 'MultiLineString')) return;
  const coords = f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates[0];
  if (!coords || coords.length < 2) return;

  const sps = p.stopPoints || [];
  if (sps.length < 3) return;

  let prevDistAlong = -1;
  let inversions = 0;
  const dists = [];

  for (let i = 0; i < sps.length; i++) {
    const { distAlong, latDist } = getDistAlong(coords, sps[i]);
    dists.push({ name: sps[i].name, distAlong, latDist });
    if (distAlong < prevDistAlong - 0.5) { // more than 500m backtracking
      inversions++;
    }
    prevDistAlong = distAlong;
  }

  if (inversions > 0) {
    badOrderLines.push({
      id: p.id,
      name: p.name,
      inversions,
      dists
    });
  }
});

console.log(`Lines with backtracking / non-monotonic stop order: ${badOrderLines.length}`);
badOrderLines.forEach(l => {
  console.log(`- ${l.id} (${l.name}): ${l.inversions} backtracking jumps`);
  l.dists.slice(0, 5).forEach((d, idx) => console.log(`   [${idx}] ${d.name}: distAlong=${d.distAlong.toFixed(2)}km, latDist=${d.latDist.toFixed(2)}km`));
});
