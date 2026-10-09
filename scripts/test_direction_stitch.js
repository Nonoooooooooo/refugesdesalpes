import fs from 'node:fs';

const resorts = JSON.parse(fs.readFileSync('scripts/data/resorts_osm_raw.json', 'utf8'));

function distSq(c1, c2) {
  const dx = c1[0] - c2[0];
  const dy = c1[1] - c2[1];
  return dx * dx + dy * dy;
}

function stitchWays(ways) {
  if (!ways || ways.length === 0) return [];
  const segments = ways.map(w => w.geometry.map(pt => [Number(pt.lon.toFixed(6)), Number(pt.lat.toFixed(6))]));
  
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
    for (let j = 0; j < pts.length; j++) {
      if (polyline.length === 0 || polyline[polyline.length - 1][0] !== pts[j][0] || polyline[polyline.length - 1][1] !== pts[j][1]) {
        polyline.push(pts[j]);
      }
    }
  }

  return polyline;
}

function getRel(id) {
  return resorts.elements.find(e => e.id === id);
}

// Compare mixing vs separate
[
  { name: 'T76 Aller only', ids: [10039943] },
  { name: 'T76 Retour only', ids: [10039944] },
  { name: 'T76 Both mixed', ids: [10039943, 10039944] },
  { name: 'Pomme Aller only', ids: [3548360] },
  { name: 'Pomme Retour only', ids: [3548361] },
  { name: 'Pomme Both mixed', ids: [3548360, 3548361] },
  { name: 'Citron Aller only', ids: [3548354] },
  { name: 'Citron Retour only', ids: [3548355] },
  { name: 'Citron Both mixed', ids: [3548354, 3548355] },
  { name: 'S61 Aller only', ids: [8293003] },
  { name: 'S61 Retour only', ids: [11256060] },
  { name: 'S61 Both mixed', ids: [8293003, 11256060] },
].forEach(test => {
  const allWays = [];
  test.ids.forEach(id => {
    const r = getRel(id);
    if (!r) return;
    (r.members || []).forEach(m => {
      if (m.type === 'way' && m.geometry) allWays.push(m);
    });
  });
  const poly = stitchWays(allWays);
  console.log(`${test.name}: ${poly.length} coords`);
});
