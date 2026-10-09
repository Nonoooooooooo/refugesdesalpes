import fs from 'node:fs';

const xml = fs.readFileSync('scripts/osm_madame_carle.osm', 'utf8');

// Parse all nodes
const nodes = {};
const nodeMatches = xml.matchAll(/<node id="(\d+)"[^>]*?lat="([0-9.-]+)"[^>]*?lon="([0-9.-]+)"/g);
for (const m of nodeMatches) {
  nodes[m[1]] = [parseFloat(m[3]), parseFloat(m[2])]; // [lon, lat]
}

// Parse all ways
const wayRegex = /<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g;
const ways = [];
let match;
while ((match = wayRegex.exec(xml)) !== null) {
  const wayId = match[1];
  const body = match[2];
  const nds = [...body.matchAll(/<nd ref="(\d+)"\/>/g)].map(m => m[1]);
  const tags = {};
  const tagMatches = body.matchAll(/<tag k="([^"]+)" v="([^"]+)"\/>/g);
  for (const tm of tagMatches) {
    tags[tm[1]] = tm[2];
  }
  const coords = nds.map(id => nodes[id]).filter(Boolean);
  ways.push({ id: wayId, tags, nds, coords });
}

// Find all ways that are part of D 204T road
const d204Ways = ways.filter(w => {
  const ref = w.tags.ref || '';
  const name = w.tags.name || '';
  return ref.includes('204T') || name.includes('Madame Carle') || name.includes('Ailefroide');
});

console.log('D204T ways found:', d204Ways.length);

// Also find any way in the corridor between 44.89 and 44.92 and 6.41 and 6.45 that is a highway
const corridorWays = ways.filter(w => {
  if (!w.tags.highway) return false;
  return w.coords.some(c => c[0] >= 6.415 && c[0] <= 6.448 && c[1] >= 44.891 && c[1] <= 44.919);
});
console.log('Corridor highway ways:', corridorWays.length);

// Stitch the road starting at Ailefroide [6.4458, 44.8919] and going up to Madame Carle [6.417, 44.917]
let currentPt = [6.445821, 44.89193];
const visited = new Set();
const fullRoadCoords = [currentPt];

for (let step = 0; step < 50; step++) {
  let bestWay = null;
  let bestReverse = false;
  let bestDist = Infinity;

  for (const w of corridorWays) {
    if (visited.has(w.id)) continue;
    if (w.coords.length < 2) continue;
    // Don't take walking paths if there's a road
    const isFootway = w.tags.highway === 'path' || w.tags.highway === 'footway' || w.tags.highway === 'steps';
    const penalty = isFootway ? 0.005 : 0;

    const s = w.coords[0];
    const e = w.coords[w.coords.length - 1];

    const dS = Math.hypot(s[0] - currentPt[0], s[1] - currentPt[1]) + penalty;
    const dE = Math.hypot(e[0] - currentPt[0], e[1] - currentPt[1]) + penalty;

    if (dS < bestDist) {
      bestDist = dS;
      bestWay = w;
      bestReverse = false;
    }
    if (dE < bestDist) {
      bestDist = dE;
      bestWay = w;
      bestReverse = true;
    }
  }

  if (!bestWay || bestDist > 0.01) {
    console.log('Finished or gap at step', step, 'dist:', bestDist);
    break;
  }

  visited.add(bestWay.id);
  const pts = bestReverse ? [...bestWay.coords].reverse() : bestWay.coords;
  console.log(`Step ${step}: added way ${bestWay.id} (${bestWay.tags.ref || bestWay.tags.name || bestWay.tags.highway}, pts: ${pts.length}) -> end at [${pts[pts.length-1][0].toFixed(4)}, ${pts[pts.length-1][1].toFixed(4)}]`);
  fullRoadCoords.push(...pts);
  currentPt = pts[pts.length - 1];

  // If reached Madame Carle parking area (lon <= 6.418, lat >= 44.916)
  if (currentPt[0] <= 6.418 && currentPt[1] >= 44.916) {
    console.log('Reached Pré de Madame Carle parking!');
    break;
  }
}

console.log('Total stitched D 204T road points:', fullRoadCoords.length);
console.log('Start (Ailefroide):', fullRoadCoords[0]);
console.log('End (Pré de Madame Carle):', fullRoadCoords[fullRoadCoords.length - 1]);

fs.writeFileSync('scripts/d204t_road.json', JSON.stringify(fullRoadCoords, null, 2));
