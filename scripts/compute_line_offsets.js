import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('public/transport_alps_v2.geojson', 'utf8'));

// Extract lines
const lines = data.features.filter(f => f.geometry.type === 'LineString');
console.log(`Analyzing ${lines.length} lines for shared corridors...`);

function getBbox(coords) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of coords) {
    if (c[0] < minX) minX = c[0];
    if (c[0] > maxX) maxX = c[0];
    if (c[1] < minY) minY = c[1];
    if (c[1] > maxY) maxY = c[1];
  }
  return [minX, minY, maxX, maxY];
}

function bboxesOverlap(b1, b2, margin = 0.005) {
  return !(b1[2] + margin < b2[0] || b1[0] - margin > b2[2] || b1[3] + margin < b2[1] || b1[1] - margin > b2[3]);
}

function distSq(c1, c2) {
  const dx = (c1[0] - c2[0]) * Math.cos((c1[1] + c2[1]) * 0.5 * Math.PI / 180) * 111320;
  const dy = (c1[1] - c2[1]) * 110574;
  return dx * dx + dy * dy;
}

// Check how many sample points of line1 are within 30m of line2
function checkOverlap(line1, line2) {
  const c1 = line1.geometry.coordinates;
  const c2 = line2.geometry.coordinates;
  const step1 = Math.max(1, Math.floor(c1.length / 40));
  const step2 = Math.max(1, Math.floor(c2.length / 40));

  let sharedCount = 0;
  for (let i = 0; i < c1.length; i += step1) {
    const pt1 = c1[i];
    let close = false;
    for (let j = 0; j < c2.length; j += step2) {
      if (distSq(pt1, c2[j]) < 40 * 40) { // within 40m
        close = true;
        break;
      }
    }
    if (close) sharedCount++;
  }
  return sharedCount >= 4; // at least 4 sample points shared
}

// Compute bboxes
const lineBboxes = lines.map(l => ({ line: l, bbox: getBbox(l.geometry.coordinates) }));

// Build adjacency graph
const adj = new Map();
lines.forEach(l => adj.set(l.properties.id, new Set()));

let overlapPairs = 0;
for (let i = 0; i < lineBboxes.length; i++) {
  for (let j = i + 1; j < lineBboxes.length; j++) {
    if (bboxesOverlap(lineBboxes[i].bbox, lineBboxes[j].bbox)) {
      if (checkOverlap(lineBboxes[i].line, lineBboxes[j].line)) {
        adj.get(lineBboxes[i].line.properties.id).add(lineBboxes[j].line.properties.id);
        adj.get(lineBboxes[j].line.properties.id).add(lineBboxes[i].line.properties.id);
        overlapPairs++;
      }
    }
  }
}

console.log(`Found ${overlapPairs} overlapping line pairs.`);

// Greedy graph coloring / slot assignment
const offsets = {};
const SPACING = 3.5; // pixels offset

lines.forEach(l => {
  const id = l.properties.id;
  const neighbors = adj.get(id);
  const usedSlots = new Set();
  neighbors.forEach(nid => {
    if (offsets[nid] !== undefined) {
      usedSlots.add(offsets[nid]);
    }
  });

  // Pick smallest slot in order: 0, 1, -1, 2, -2, 3, -3...
  let slot = 0;
  let candidate = 0;
  let step = 1;
  while (usedSlots.has(candidate)) {
    candidate = (step % 2 === 1) ? Math.ceil(step / 2) : -Math.ceil(step / 2);
    step++;
  }
  offsets[id] = candidate;
});

// Print sample offsets
console.log('Sample assigned offsets:');
lines.slice(0, 20).forEach(l => {
  const id = l.properties.id;
  console.log(`- ${l.properties.ref} (${l.properties.name.slice(0, 30)}): slot ${offsets[id]} (${offsets[id] * SPACING}px)`);
});
