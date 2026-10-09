import fs from 'node:fs';

const d = JSON.parse(fs.readFileSync('public/transports_alpes.json', 'utf8'));

function inspectLine(refOrName) {
  const f = d.features.find(
    (feat) => feat.properties.ref === refOrName || feat.properties.name?.includes(refOrName)
  );
  if (!f) return console.log('Non trouvé:', refOrName);
  console.log(`=== Ligne ${f.properties.ref}: ${f.properties.name} ===`);
  console.log('Total stops:', f.properties.stops?.length);
  console.log('Stops:');
  f.properties.stops?.forEach((s, idx) => {
    console.log(`  [${idx}] ${s}`);
  });
}

inspectLine('S04');
inspectLine('MAUV');
