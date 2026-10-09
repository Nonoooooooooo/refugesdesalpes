import fs from 'node:fs';

const datasetPath = 'public/transports_alpes.json';
const d = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

function normalize(s) {
  if (!s) return '';
  const str = typeof s === 'string' ? s : s.name || '';
  return str.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

/**
 * Trouve le point de rebroussement (terminus pivot) dans une liste d'arrêts
 * qui concatène l'aller et le retour (forme A -> B -> A)
 */
function findTurnaroundPivot(stops) {
  if (!Array.isArray(stops) || stops.length < 4) return -1;
  const n = stops.length;
  const names = stops.map(normalize);

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
    if (matches > maxMirrorMatches && matches >= 2) {
      maxMirrorMatches = matches;
      bestPivot = k;
    }
  }

  if (bestPivot !== -1 && maxMirrorMatches >= 2) {
    return bestPivot;
  }

  // Cas spécial : si un arrêt réapparaît et que la moitié correspond
  for (let i = 0; i < Math.floor(n * 0.4); i++) {
    const name = names[i];
    if (!name) continue;
    const lastIdx = names.lastIndexOf(name);
    if (lastIdx > n - 10 && lastIdx > i + 5) {
      const half = Math.floor((i + lastIdx) / 2);
      return half;
    }
  }

  return -1;
}

/**
 * Supprime les doublons d'arrêts au sein d'une même liste (en conservant le premier passage)
 */
function deduplicateStopsList(stopsList) {
  if (!Array.isArray(stopsList)) return [];
  const seen = new Set();
  const result = [];
  stopsList.forEach((s) => {
    const key = normalize(s);
    if (!key) return;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(s);
    }
  });
  return result;
}

/**
 * Déduplique les stopPoints
 */
function deduplicateStopPoints(stopPointsList) {
  if (!Array.isArray(stopPointsList)) return [];
  const seen = new Set();
  const result = [];
  stopPointsList.forEach((sp) => {
    if (!sp || !sp.name) return;
    const key = normalize(sp.name);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(sp);
    }
  });
  return result;
}

let modifiedLines = 0;

d.features.forEach((f) => {
  if (f.geometry.type !== 'LineString' && f.geometry.type !== 'MultiLineString') return;
  const p = f.properties || {};
  let stops = Array.isArray(p.stops) ? p.stops : [];
  let stopPoints = Array.isArray(p.stopPoints) ? p.stopPoints : [];

  let isModified = false;

  // 1. Détecter si la liste d'arrêts globale est un aller-retour concaténé
  const pivot = findTurnaroundPivot(stops);
  let allerStops = stops;
  let retourStops = [];
  let allerStopPoints = stopPoints;
  let retourStopPoints = [];

  if (pivot > 0 && pivot < stops.length - 1) {
    // Liste concaténée Aller-Retour détectée !
    allerStops = deduplicateStopsList(stops.slice(0, pivot + 1));
    retourStops = deduplicateStopsList(stops.slice(pivot));
    if (retourStops.length < 2) {
      retourStops = [...allerStops].reverse();
    }

    if (stopPoints.length === stops.length) {
      allerStopPoints = deduplicateStopPoints(stopPoints.slice(0, pivot + 1));
      retourStopPoints = deduplicateStopPoints(stopPoints.slice(pivot));
      if (retourStopPoints.length < 2) {
        retourStopPoints = [...allerStopPoints].reverse();
      }
    } else {
      allerStopPoints = deduplicateStopPoints(stopPoints);
      retourStopPoints = [...allerStopPoints].reverse();
    }

    p.stops = allerStops;
    p.stopPoints = allerStopPoints;
    isModified = true;
  } else {
    // Pas de pivot miroir évident : dédupliquer les doublons internes
    const dedupedStops = deduplicateStopsList(stops);
    const dedupedPoints = deduplicateStopPoints(stopPoints);

    if (dedupedStops.length !== stops.length) {
      p.stops = dedupedStops;
      isModified = true;
    }
    if (dedupedPoints.length !== stopPoints.length) {
      p.stopPoints = dedupedPoints;
      isModified = true;
    }

    allerStops = p.stops || [];
    allerStopPoints = p.stopPoints || [];
    retourStops = [...allerStops].reverse();
    retourStopPoints = [...allerStopPoints].reverse();
  }

  // 2. Nettoyer ou mettre à jour les directions
  if (Array.isArray(p.directions) && p.directions.length >= 2) {
    const dir0 = p.directions[0];
    const dir1 = p.directions[1];

    const cleanDir0Stops = deduplicateStopsList(dir0.stops || allerStops);
    const cleanDir1Stops = deduplicateStopsList(dir1.stops || retourStops);
    const cleanDir0Points = deduplicateStopPoints(dir0.stopPoints || allerStopPoints);
    const cleanDir1Points = deduplicateStopPoints(dir1.stopPoints || retourStopPoints);

    if (
      cleanDir0Stops.length !== (dir0.stops?.length || 0) ||
      cleanDir1Stops.length !== (dir1.stops?.length || 0) ||
      isModified
    ) {
      dir0.stops = cleanDir0Stops;
      dir0.stopPoints = cleanDir0Points;
      dir1.stops = cleanDir1Stops;
      dir1.stopPoints = cleanDir1Points;
      isModified = true;
    }
  } else if (p.name && (p.name.includes('↔') || p.name.includes('<=>') || p.route?.includes('↔'))) {
    // Créer des directions propres
    const origin = allerStops[0] || 'Départ';
    const dest = allerStops[allerStops.length - 1] || 'Terminus';
    p.directions = [
      {
        id: 'aller',
        name: `Vers ${dest}`,
        origin,
        destination: dest,
        stops: allerStops,
        stopPoints: allerStopPoints,
        timetable: p.timetable || null
      },
      {
        id: 'retour',
        name: `Vers ${origin}`,
        origin: dest,
        destination: origin,
        stops: retourStops,
        stopPoints: retourStopPoints,
        timetable: p.timetable && Array.isArray(p.timetable.rows)
          ? {
              ...p.timetable,
              title: `Horaires Retour (Sens inverse)`,
              rows: [...p.timetable.rows].reverse()
            }
          : null
      }
    ];
    isModified = true;
  }

  if (isModified) {
    modifiedLines++;
  }
});

console.log(`Lignes nettoyées sans aucun arrêt dupliqué: ${modifiedLines}`);

// Écrire le dataset nettoyé
fs.writeFileSync(datasetPath, JSON.stringify(d, null, 2), 'utf8');

if (fs.existsSync('public/transport_alps_v2.geojson')) {
  fs.writeFileSync('public/transport_alps_v2.geojson', JSON.stringify(d, null, 2), 'utf8');
}

console.log('Dataset transports_alpes.json sauvegardé avec succès !');
