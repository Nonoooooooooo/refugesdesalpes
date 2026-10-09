const fs = require('fs');

const data = JSON.parse(fs.readFileSync('public/transports_alpes.json', 'utf8'));

console.log('Total features:', data.features.length);

const lineFeatures = data.features.filter(f => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString');
console.log('Line features:', lineFeatures.length);

// 1. Check for lines where directions or start/end might be inverted
let invertedCount = 0;
const suspectLines = [];

lineFeatures.forEach(f => {
  const p = f.properties || {};
  const coords = f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates[0];
  if (!coords || coords.length < 2) return;

  const c0 = coords[0];
  const cLast = coords[coords.length - 1];

  // If directions exist
  if (p.directions && p.directions.length >= 2) {
    const d0 = p.directions[0];
    if (d0.stopPoints && d0.stopPoints.length >= 2) {
      const sp0 = d0.stopPoints[0];
      const spLast = d0.stopPoints[d0.stopPoints.length - 1];
      
      const distStartToC0 = Math.hypot(sp0.lng - c0[0], sp0.lat - c0[1]);
      const distStartToCLast = Math.hypot(sp0.lng - cLast[0], sp0.lat - cLast[1]);

      if (distStartToCLast < distStartToC0 && distStartToC0 > 0.05) {
        suspectLines.push({
          id: p.id,
          name: p.name,
          issue: 'Direction 0 stop 0 is closer to coords[end] than coords[0]',
          distStartToC0,
          distStartToCLast
        });
        invertedCount++;
      }
    }
  }
});

console.log(`Lines with inverted geometry vs direction 0: ${invertedCount}`);
suspectLines.forEach(s => console.log(` - ${s.id} (${s.name}): distToC0=${s.distStartToC0.toFixed(4)}, distToCLast=${s.distStartToCLast.toFixed(4)}`));
