const fs = require('fs');
const turf = require('@turf/turf');

const data = JSON.parse(fs.readFileSync('public/transports_alpes.json', 'utf8'));

console.log('Auditing stop monotonic progress along lines with Turf...');

const badLines = [];

data.features.forEach(f => {
  const p = f.properties || {};
  if (!f.geometry || (f.geometry.type !== 'LineString' && f.geometry.type !== 'MultiLineString')) return;
  const isMulti = f.geometry.type === 'MultiLineString';
  const coords = isMulti ? f.geometry.coordinates[0] : f.geometry.coordinates;
  if (!coords || coords.length < 2) return;

  let line;
  try {
    line = turf.lineString(coords);
  } catch (e) {
    return;
  }

  const sps = p.stopPoints || [];
  if (sps.length < 3) return;

  let prevLoc = -1;
  const jumps = [];

  sps.forEach((sp, idx) => {
    const snap = turf.nearestPointOnLine(line, [sp.lng, sp.lat]);
    const loc = snap.properties.location;
    if (loc < prevLoc - 0.05) { // more than 50m backtracking
      jumps.push({ idx, name: sp.name, loc, prevLoc, jump: prevLoc - loc });
    }
    prevLoc = loc;
  });

  if (jumps.length > 0) {
    badLines.push({
      id: p.id,
      name: p.name,
      jumps
    });
  }
});

console.log(`Lines with backtracking / non-monotonic stop order (Turf): ${badLines.length}`);
badLines.forEach(l => {
  console.log(`- ${l.id} (${l.name}): ${l.jumps.length} jumps`);
  l.jumps.forEach(j => {
    console.log(`   Stop [${j.idx}] "${j.name}" @ ${j.loc.toFixed(2)}km was after stop @ ${j.prevLoc.toFixed(2)}km (jump back: ${j.jump.toFixed(2)}km)`);
  });
});
