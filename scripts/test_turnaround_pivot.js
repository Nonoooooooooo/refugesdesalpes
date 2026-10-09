import fs from 'node:fs';

const d = JSON.parse(fs.readFileSync('public/transports_alpes.json', 'utf8'));

function normalize(s) {
  if (!s) return '';
  const str = typeof s === 'string' ? s : s.name || '';
  return str.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function findTurnaroundPivot(stops) {
  if (!Array.isArray(stops) || stops.length < 4) return -1;
  const n = stops.length;
  const names = stops.map(normalize);

  // Vérifier si le début et la fin correspondent (ex: départ == arrivée)
  const isRoundTrip = names[0] === names[n - 1] || names[0] === names[n - 2] || names[1] === names[n - 1];

  // Chercher le pivot k où la symétrie miroir est maximale
  let bestPivot = -1;
  let maxMirrorMatches = 0;

  for (let k = 1; k < n - 1; k++) {
    let matches = 0;
    const maxOffset = Math.min(k, n - 1 - k);
    for (let offset = 1; offset <= maxOffset; offset++) {
      if (names[k - offset] && names[k - offset] === names[k + offset]) {
        matches++;
      }
    }
    // Pondérer par le ratio
    if (matches > maxMirrorMatches && matches >= 2) {
      maxMirrorMatches = matches;
      bestPivot = k;
    }
  }

  // Si on a trouvé un pivot miroir clair
  if (bestPivot !== -1 && maxMirrorMatches >= 2) {
    return bestPivot;
  }

  // Si le premier arrêt réapparaît au milieu ou à la fin
  const firstDupIdx = names.indexOf(names[0], 2);
  if (firstDupIdx !== -1 && firstDupIdx >= Math.floor(n * 0.4)) {
    return Math.floor(firstDupIdx / 2);
  }

  return -1;
}

let fixedCount = 0;
d.features.forEach((f) => {
  if (f.geometry.type !== 'LineString' && f.geometry.type !== 'MultiLineString') return;
  const p = f.properties || {};
  const stops = p.stops || [];

  const pivot = findTurnaroundPivot(stops);
  if (pivot !== -1) {
    fixedCount++;
    const aller = stops.slice(0, pivot + 1);
    const retour = stops.slice(pivot);
    console.log(`[${p.ref || 'Sans ref'}] ${p.name}`);
    console.log(`   Total: ${stops.length} -> Pivot à [${pivot}] ("${typeof stops[pivot] === 'string' ? stops[pivot] : stops[pivot].name}")`);
    console.log(`   Aller: ${aller.length} arrêts ("${typeof aller[0] === 'string' ? aller[0] : aller[0].name}" -> "${typeof aller[aller.length - 1] === 'string' ? aller[aller.length - 1] : aller[aller.length - 1].name}")`);
    console.log(`   Retour: ${retour.length} arrêts ("${typeof retour[0] === 'string' ? retour[0] : retour[0].name}" -> "${typeof retour[retour.length - 1] === 'string' ? retour[retour.length - 1] : retour[retour.length - 1].name}")`);
  }
});

console.log(`Total lignes scindées par pivot miroir: ${fixedCount}`);
