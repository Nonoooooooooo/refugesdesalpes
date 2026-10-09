const fs = require('fs');

const data = JSON.parse(fs.readFileSync('public/transports_alpes.json', 'utf8'));

console.log('Auditing polyline orientation across all lines in transports_alpes.json...');

const invertedLines = [];

data.features.forEach(f => {
  const p = f.properties || {};
  if (!f.geometry || (f.geometry.type !== 'LineString' && f.geometry.type !== 'MultiLineString')) return;

  const coords = f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates[0];
  if (!coords || coords.length < 2) return;

  const c0 = coords[0];
  const cLast = coords[coords.length - 1];

  // Check with stopPoints if available
  const sps = p.stopPoints || (p.directions?.[0]?.stopPoints) || [];
  if (sps.length >= 2) {
    const sp0 = sps[0];
    const spLast = sps[sps.length - 1];

    const dStartToC0 = Math.hypot((sp0.lng - c0[0]) * 78, (sp0.lat - c0[1]) * 111);
    const dStartToCLast = Math.hypot((sp0.lng - cLast[0]) * 78, (sp0.lat - cLast[1]) * 111);
    const dEndToCLast = Math.hypot((spLast.lng - cLast[0]) * 78, (spLast.lat - cLast[1]) * 111);
    const dEndToC0 = Math.hypot((spLast.lng - c0[0]) * 78, (spLast.lat - c0[1]) * 111);

    // If stop 0 is significantly closer to cLast than c0, AND stop last is closer to c0 than cLast:
    if (dStartToCLast < dStartToC0 && dEndToC0 < dEndToCLast && (dStartToC0 - dStartToCLast > 1)) {
      invertedLines.push({
        id: p.id,
        name: p.name,
        sp0Name: sp0.name,
        spLastName: spLast.name,
        dStartToC0: dStartToC0.toFixed(2),
        dStartToCLast: dStartToCLast.toFixed(2),
        dEndToC0: dEndToC0.toFixed(2),
        dEndToCLast: dEndToCLast.toFixed(2)
      });
    }
  }
});

console.log(`Found ${invertedLines.length} lines with reversed polylines:`);
invertedLines.forEach(l => {
  console.log(`- ${l.id} (${l.name})`);
  console.log(`    sp0 (${l.sp0Name}) -> c0: ${l.dStartToC0}km, cLast: ${l.dStartToCLast}km`);
  console.log(`    spLast (${l.spLastName}) -> c0: ${l.dEndToC0}km, cLast: ${l.dEndToCLast}km`);
});
