import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('public/transports_alpes.json', 'utf8'));
const geo = JSON.parse(fs.readFileSync('public/transport_alps_v2.geojson', 'utf8'));

const targetRefs = ['Train Rouge', 'S82', 'T76', 'Citron', 'Pomme', 'Fraise', 'Myrtille', 'S62', 'S61', "Vallée'BUS"];

console.log('--- Checking new resort routes in public/transports_alpes.json ---');
targetRefs.forEach(ref => {
  const feat = geo.features.find(f => f.geometry.type === 'LineString' && f.properties?.ref === ref);
  if (feat) {
    console.log(`[PASS] ${feat.properties.ref}: "${feat.properties.name}" (${feat.properties.network}) - ${feat.properties.stops?.length || 0} stops, timetable: ${!!feat.properties.timetable}`);
  } else {
    console.log(`[FAIL] Missing line: ${ref}`);
  }
});

console.log('--- Checking hubs in public/transports_alpes.json ---');
const targetHubs = ['hub-valdisere-centre', 'hub-alpe-huez-sports', 'hub-valmorel-bourg', 'hub-doucy-station'];
targetHubs.forEach(hid => {
  const hub = geo.features.find(f => f.geometry.type === 'Point' && f.properties?.id === hid);
  if (hub) {
    console.log(`[PASS] Hub ${hub.properties.id}: "${hub.properties.name}" at [${hub.geometry.coordinates}]`);
  } else {
    console.log(`[FAIL] Missing hub: ${hid}`);
  }
});

console.log('--- Checking GeoJSON features ---');
targetRefs.forEach(ref => {
  const feat = geo.features.find(f => f.properties?.ref === ref);
  if (feat) {
    console.log(`[PASS] GeoJSON feature ${ref}: coords=${feat.geometry.coordinates?.length}, stopPoints=${feat.properties?.stopPoints?.length}`);
  } else {
    console.log(`[FAIL] Missing GeoJSON feature: ${ref}`);
  }
});
