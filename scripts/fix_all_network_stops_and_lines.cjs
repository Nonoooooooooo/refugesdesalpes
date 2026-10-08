const fs = require('fs');
const turf = require('@turf/turf');

const datasetPath = 'public/transports_alpes.json';
const data = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

// Load fetched Nevache geometries
const nevacheGeom = JSON.parse(fs.readFileSync('scripts/nevache_road_geometries.json', 'utf8'));

console.log('=== FIX ALL NETWORK STOPS AND LINES ===');

// 1. SPECIFIC CORRECTION FOR NEVACHE LINES
// ----------------------------------------
const nevacheFixes = {
  'altigo-n3-claree': {
    coords: nevacheGeom.n3Coords,
    stops: [
      { name: 'Névache Roubion (Grand Parking obligatoire & Foyer nordique)', lng: 6.631912, lat: 45.017099 },
      { name: 'Névache Sallé (Croix de Mission)', lng: 6.621603, lat: 45.017905 },
      { name: 'Névache Village (Ville-Basse & Le Bon Coin)', lng: 6.612776, lat: 45.018101 },
      { name: 'Névache Ville-Haute (1600 m, Pôle navettes Haute Vallée)', lng: 6.604972, lat: 45.018894 }
    ]
  },
  'altigo-n4-claree': {
    coords: nevacheGeom.n4Coords,
    stops: [
      { name: 'Névache Ville-Haute (1600 m, Billetterie & Départ navettes)', lng: 6.604972, lat: 45.018894 },
      { name: 'Pont du Rately (1680 m, départ Refuge de Buffère 2076 m)', lng: 6.578531, lat: 45.02213 },
      { name: 'Hameau de Fontcouverte (1857 m, Auberge & Refuge de la Fruitière, Cascade de Fontcouverte)', lng: 6.545078, lat: 45.034189 },
      { name: 'Pont du Moutet (Départ sentier Refuge du Chardonnet 2223 m)', lng: 6.538050, lat: 45.042050 },
      { name: 'Chalets de Laval (Refuge de Laval 2010 m)', lng: 6.534020, lat: 45.051815 },
      { name: 'Parking de Laval / Pont de la Clarée (2030 m, départ direct Refuge des Drayères 2180 m & Refuge de Ricou 2115 m, GR57)', lng: 6.525608, lat: 45.059221 }
    ]
  },
  'altigo-l7': {
    coords: nevacheGeom.l7Coords,
    stops: [
      { name: 'Briançon Gare SNCF', lng: 6.634061, lat: 44.89801 },
      { name: 'Briançon Champ de Mars', lng: 6.66534, lat: 44.909811 },
      { name: 'La Vachette', lng: 6.681168, lat: 44.940946 },
      { name: 'Val-des-Prés (Le Rosier, La Vachette)', lng: 6.670454, lat: 44.972742 },
      { name: 'Plampinet (Auberge de la Clarée, départ Col des Thures)', lng: 6.659208, lat: 45.005251 },
      { name: 'Névache Roubion (Foyer nordique)', lng: 6.631912, lat: 45.017099 },
      { name: 'Névache Village (Ville-Basse)', lng: 6.612776, lat: 45.018101 },
      { name: 'Névache Ville-Haute (1600 m, Pôle d\'échange des navettes de la Haute Clarée)', lng: 6.604972, lat: 45.018894 }
    ]
  },
  'navette-vallee-etroite': {
    coords: nevacheGeom.etroiteCoords,
    stops: [
      { name: 'Névache Village (Ville-Haute)', lng: 6.604972, lat: 45.018894 },
      { name: 'Col de l\'Échelle (1762 m)', lng: 6.6570, lat: 45.0270 },
      { name: 'Vallée Étroite (Granges de la Vallée Étroite 1650 m, Refuges I Re Magi & Terzo Alpini)', lng: 6.6350, lat: 45.0870 }
    ]
  }
};

let appliedNevache = 0;
data.features.forEach(f => {
  const p = f.properties || {};
  if (nevacheFixes[p.id]) {
    const fix = nevacheFixes[p.id];
    f.geometry.coordinates = fix.coords;
    p.stops = fix.stops.map(s => s.name);
    p.stopPoints = fix.stops;
    appliedNevache++;
    console.log(`Applied official geometry and stops for ${p.id} (${fix.coords.length} pts, ${fix.stops.length} stops)`);
  }
});

// 2. SPECIFIC FIX FOR BUS-HS-274 (Sallanches - Mont-Blanc false anchor in Geneva)
// -----------------------------------------------------------------------------
const hs274 = data.features.find(f => f.properties?.id === 'bus-hs-274');
if (hs274) {
  const c0 = hs274.geometry.coordinates[0];
  const sp0 = hs274.properties.stopPoints?.[0];
  if (sp0 && sp0.name.includes('Sallanches')) {
    sp0.lng = c0[0];
    sp0.lat = c0[1];
    console.log('Fixed bus-hs-274: Sallanches stop placed at actual line start in Sallanches');
  }
}

// 3. SYSTEMIC SIG CHECK & CORRECTION FOR ALL 299 LINES
// ---------------------------------------------------
let reversedPolylines = 0;
let monotonicityFixed = 0;
let snappedStopsCount = 0;

data.features.forEach(f => {
  const p = f.properties || {};
  if (!f.geometry || (f.geometry.type !== 'LineString' && f.geometry.type !== 'MultiLineString')) return;
  if (!p.id) return;

  // Work with LineString (or flatten first LineString of MultiLineString)
  let coords = f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates[0];
  if (!coords || coords.length < 2) return;

  let turfLine;
  try {
    turfLine = turf.lineString(coords);
  } catch (e) {
    return;
  }

  const lineTotalKm = turf.length(turfLine, { units: 'kilometers' });
  if (lineTotalKm <= 0) return;

  const sps = p.stopPoints || [];
  if (sps.length < 2) return;

  // A. Check if the polyline direction is INVERTED relative to Direction 0 stops
  const sp0 = sps[0];
  const spLast = sps[sps.length - 1];

  const snap0 = turf.nearestPointOnLine(turfLine, [sp0.lng, sp0.lat]);
  const snapLast = turf.nearestPointOnLine(turfLine, [spLast.lng, spLast.lat]);

  const loc0 = snap0.properties.location; // km from line start
  const locLast = snapLast.properties.location; // km from line start

  // If stop 0 is close to line end and stop last is close to line start:
  if (loc0 > lineTotalKm * 0.7 && locLast < lineTotalKm * 0.3) {
    // Polyline was digitized in reverse! Reverse coords array so it matches Direction 0!
    coords.reverse();
    if (f.geometry.type === 'LineString') {
      f.geometry.coordinates = coords;
    } else {
      f.geometry.coordinates[0] = coords;
    }
    turfLine = turf.lineString(coords);
    reversedPolylines++;
    console.log(`Reversed polyline for ${p.id} (${p.name}) to match Direction 0`);
  }

  // B. Enforce strictly monotonic stop locations along the line
  // Calculate projected distance along line for each stop
  const stopDists = sps.map((sp, idx) => {
    const snap = turf.nearestPointOnLine(turfLine, [sp.lng, sp.lat]);
    return {
      idx,
      name: sp.name,
      sp,
      locKm: snap.properties.location,
      distFromLineKm: snap.properties.dist
    };
  });

  // Ensure first stop is at start and last stop is at end if they are terminals
  if (stopDists[0].locKm > lineTotalKm * 0.15) {
    stopDists[0].locKm = 0;
  }
  if (stopDists[stopDists.length - 1].locKm < lineTotalKm * 0.85) {
    stopDists[stopDists.length - 1].locKm = lineTotalKm;
  }

  // Fix any non-monotonic stops (backtracking)
  let needsFix = false;
  for (let i = 1; i < stopDists.length; i++) {
    if (stopDists[i].locKm <= stopDists[i - 1].locKm) {
      needsFix = true;
      break;
    }
  }

  if (needsFix) {
    monotonicityFixed++;
    // Enforce strictly increasing distances
    // Find valid monotonic anchors and interpolate bad ones
    const n = stopDists.length;
    // Set endpoints
    stopDists[0].locKm = Math.min(stopDists[0].locKm, lineTotalKm * 0.05);
    stopDists[n - 1].locKm = Math.max(stopDists[n - 1].locKm, lineTotalKm * 0.95);

    for (let i = 1; i < n - 1; i++) {
      if (stopDists[i].locKm <= stopDists[i - 1].locKm) {
        // Find next valid stop with higher distance
        let nextValid = n - 1;
        for (let j = i + 1; j < n; j++) {
          if (stopDists[j].locKm > stopDists[i - 1].locKm) {
            nextValid = j;
            break;
          }
        }
        const span = nextValid - (i - 1);
        const distStep = (stopDists[nextValid].locKm - stopDists[i - 1].locKm) / span;
        for (let k = i; k < nextValid; k++) {
          stopDists[k].locKm = stopDists[i - 1].locKm + (k - (i - 1)) * distStep;
        }
      }
    }
  }

  // C. Update stop coordinates to their snapped position on the line
  sps.forEach((sp, idx) => {
    const targetKm = Math.max(0, Math.min(lineTotalKm, stopDists[idx].locKm));
    const ptAlong = turf.along(turfLine, targetKm, { units: 'kilometers' });
    sp.lng = Number(ptAlong.geometry.coordinates[0].toFixed(6));
    sp.lat = Number(ptAlong.geometry.coordinates[1].toFixed(6));
    snappedStopsCount++;
  });

  // D. Build / Update Direction 0 and Direction 1 with synchronized stopPoints
  const allerStopPoints = sps.map(s => ({ ...s }));
  const retourStopPoints = sps.map(s => ({ ...s })).reverse();
  const allerStops = sps.map(s => s.name);
  const retourStops = [...allerStops].reverse();

  let origin = allerStops[0] || 'Départ';
  let dest = allerStops[allerStops.length - 1] || 'Terminus';

  p.directions = [
    {
      id: 'aller',
      name: `Vers ${dest}`,
      origin: origin,
      destination: dest,
      stops: allerStops,
      stopPoints: allerStopPoints,
      timetable: p.directions?.[0]?.timetable || p.timetable || null
    },
    {
      id: 'retour',
      name: `Vers ${origin}`,
      origin: dest,
      destination: origin,
      stops: retourStops,
      stopPoints: retourStopPoints,
      timetable: p.directions?.[1]?.timetable || null
    }
  ];
});

console.log(`\nSIG Processing summary:`);
console.log(`- Applied custom geometries: ${appliedNevache} lines`);
console.log(`- Reversed polylines to match direction 0: ${reversedPolylines} lines`);
console.log(`- Monotonicity fixed: ${monotonicityFixed} lines`);
console.log(`- Snapped & verified stops: ${snappedStopsCount} stops`);

// Save updated GeoJSON
fs.writeFileSync('public/transports_alpes.json', JSON.stringify(data));
fs.writeFileSync('public/transport_alps_v2.geojson', JSON.stringify(data));
console.log('\nSaved updated public/transports_alpes.json and public/transport_alps_v2.geojson successfully!');
