const fs = require('fs');

const data = JSON.parse(fs.readFileSync('public/transports_alpes.json', 'utf8'));

// Load insee communes
let communes = [];
try {
  const commObj = JSON.parse(fs.readFileSync('scripts/insee_communes.json', 'utf8'));
  communes = Object.values(commObj);
} catch (e) {}

console.log(`Loaded ${communes.length} communes.`);

// Build a map of known places: commune names -> [lng, lat]
const placeCoords = new Map();
communes.forEach(c => {
  if (c.nom && (c.centre?.coordinates || (c.lat && c.lon) || (c.centre?.lat && c.centre?.lon))) {
    const coords = c.centre?.coordinates || [c.lon || c.centre?.lon, c.lat || c.centre?.lat];
    placeCoords.set(c.nom.toLowerCase(), coords);
  }
});

// Also add well-known alpine landmarks and spots
const knownLandmarks = {
  'roubion': [6.6319, 45.0171],
  'nevache': [6.6050, 45.0187],
  'ville-haute': [6.6050, 45.0187],
  'fontcouverte': [6.5451, 45.0342],
  'laval': [6.5256, 45.0592],
  'briancon': [6.634, 44.898],
  'grenoble': [5.714, 45.191],
  'chamonix': [6.869, 45.923],
  'chambery': [5.920, 45.565],
  'annecy': [6.129, 45.899],
  'gap': [6.079, 44.563],
  'nice': [7.262, 43.703],
  'valence': [4.892, 44.933],
  'albertville': [6.392, 45.676],
  'modane': [6.671, 45.201],
  'bourg-saint-maurice': [6.768, 45.618]
};

Object.entries(knownLandmarks).forEach(([k, v]) => placeCoords.set(k, v));

const issues = [];

data.features.forEach(f => {
  const p = f.properties || {};
  if (!p.id) return;

  const isLine = f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString';
  if (!isLine) return;

  const coords = f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates[0];
  if (!coords || coords.length < 2) return;

  const c0 = coords[0];
  const cLast = coords[coords.length - 1];

  // 1. Check stopPoints
  const stopPoints = p.stopPoints || [];
  if (stopPoints.length >= 2) {
    const sp0 = stopPoints[0];
    const spLast = stopPoints[stopPoints.length - 1];

    // Check if sp0 and spLast are far from line ends
    const distSp0ToC0 = Math.hypot((sp0.lng - c0[0]) * 78, (sp0.lat - c0[1]) * 111); // km
    const distSp0ToCLast = Math.hypot((sp0.lng - cLast[0]) * 78, (sp0.lat - cLast[1]) * 111); // km

    if (distSp0ToCLast < distSp0ToC0 && distSp0ToC0 > 2) {
      issues.push({
        id: p.id,
        name: p.name,
        type: 'INVERTED_GEOMETRY',
        detail: `sp0 (${sp0.name}) is closer to line end (${distSp0ToCLast.toFixed(1)}km) than line start (${distSp0ToC0.toFixed(1)}km)`
      });
    }

    // Check each stopPoint against known place names
    stopPoints.forEach((sp, idx) => {
      const nameLower = sp.name.toLowerCase();
      
      // Check if this stop name matches a landmark
      for (const [placeName, expectedCoord] of placeCoords.entries()) {
        if (placeName.length < 5) continue; // avoid tiny substrings
        // Word boundary match
        const regex = new RegExp(`\\b${placeName}\\b`, 'i');
        if (regex.test(nameLower)) {
          const distKm = Math.hypot((sp.lng - expectedCoord[0]) * 78, (sp.lat - expectedCoord[1]) * 111);
          // Special cases: if it's "Col de...", it can be far from commune center, but if it's > 10km it's definitely suspicious
          if (distKm > 10 && !nameLower.includes('col') && !nameLower.includes('refuge') && !nameLower.includes('vallee')) {
            issues.push({
              id: p.id,
              name: p.name,
              type: 'MISPLACED_STOP',
              detail: `Stop "${sp.name}" (index ${idx}) is ${distKm.toFixed(1)}km away from ${placeName} ([${expectedCoord[0]}, ${expectedCoord[1]}]) - Actual coord: [${sp.lng}, ${sp.lat}]`
            });
            break;
          }
        }
      }
    });
  }
});

console.log(`Found ${issues.length} potential issues across dataset:`);
issues.forEach(i => console.log(`[${i.type}] ${i.id}: ${i.detail}`));
