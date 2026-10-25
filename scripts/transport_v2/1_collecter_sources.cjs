/**
 * Étape 1a — Collecte des sources officielles de transport autour des refuges.
 *
 * Interroge en direct transport.data.gouv.fr (Point d'accès national) :
 *  1. le catalogue complet des jeux de données (/api/datasets)
 *  2. tous les arrêts GTFS publiés autour des refuges (/api/gtfs-stops, par tuiles de 0,5°)
 * puis rattache chaque refuge à sa commune et son département (geo.api.gouv.fr).
 *
 * Les réponses sont mises en cache dans imports/transport_v2/ (ignoré par Git).
 * L'analyse se fait ensuite hors ligne avec 2_analyser_couverture.cjs.
 *
 * Utilisation :
 *   node scripts/transport_v2/1_collecter_sources.cjs
 *   node scripts/transport_v2/1_collecter_sources.cjs --refresh-communes   # regéocode tous les refuges
 */

const fs = require('fs');
const { PATHS, readJson, writeJson, loadHebergements, fetchJson, mapLimit } = require('./lib.cjs');

const TILE_DEG = 0.5;

// Tuiles de 0,5° contenant au moins un refuge, plus un anneau de tuiles voisines
function tilesAroundRefuges(refuges) {
  const tiles = new Set();
  for (const r of refuges) {
    const i = Math.floor(r.lat / TILE_DEG);
    const j = Math.floor(r.lng / TILE_DEG);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) tiles.add(`${i + di}:${j + dj}`);
  }
  return [...tiles].map((k) => {
    const [i, j] = k.split(':').map(Number);
    return { south: i * TILE_DEG, north: (i + 1) * TILE_DEG, west: j * TILE_DEG, east: (j + 1) * TILE_DEG };
  });
}

async function collectStops(tiles) {
  const seen = new Set();
  const stops = [];
  const counts = await mapLimit(tiles, 4, async (t) => {
    const url = `https://transport.data.gouv.fr/api/gtfs-stops?north=${t.north}&south=${t.south}&east=${t.east}&west=${t.west}`;
    const geo = await fetchJson(url);
    for (const f of geo.features || []) {
      const p = f.properties;
      const key = `${p.resource_id}|${p.stop_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const [lng, lat] = f.geometry.coordinates;
      stops.push({
        r: p.resource_id,
        d: p.dataset_title,
        n: p.stop_name,
        t: p.location_type ?? 0,
        lat,
        lng,
      });
    }
    return (geo.features || []).length;
  });
  return { stops, maxPerTile: Math.max(...counts) };
}

async function geocodeRefuges(refuges, refresh) {
  const cache = !refresh && fs.existsSync(PATHS.communes) ? readJson(PATHS.communes) : {};
  const todo = refuges.filter((r) => !cache[r.id]);
  let done = 0;
  await mapLimit(todo, 6, async (r) => {
    const url = `https://geo.api.gouv.fr/communes?lat=${r.lat}&lon=${r.lng}&fields=nom,code,departement&format=json`;
    const res = await fetchJson(url);
    const c = res[0];
    // Pas de commune française : refuge situé hors de France (Suisse, Italie…)
    cache[r.id] = c
      ? { commune: c.nom, insee: c.code, dep: c.departement?.code || c.code.slice(0, 2), depNom: c.departement?.nom || '' }
      : { commune: '', insee: '', dep: 'HORS_FR', depNom: 'Hors France' };
    if (++done % 250 === 0) console.log(`   … ${done}/${todo.length} refuges géolocalisés`);
  });
  writeJson(PATHS.communes, cache);
  return { total: Object.keys(cache).length, nouveaux: todo.length };
}

async function main() {
  const refresh = process.argv.includes('--refresh-communes');
  const refuges = loadHebergements();
  console.log(`🏔️  ${refuges.length} refuges, cabanes et gîtes à analyser`);

  console.log('📚 Catalogue transport.data.gouv.fr…');
  const datasets = await fetchJson('https://transport.data.gouv.fr/api/datasets');
  writeJson(PATHS.datasets, datasets);
  console.log(`   ✓ ${datasets.length} jeux de données`);

  const tiles = tilesAroundRefuges(refuges);
  console.log(`🚏 Arrêts GTFS officiels sur ${tiles.length} tuiles de ${TILE_DEG}°…`);
  const { stops, maxPerTile } = await collectStops(tiles);
  writeJson(PATHS.arrets, stops);
  console.log(`   ✓ ${stops.length} arrêts (maximum ${maxPerTile} sur une tuile)`);

  console.log('🗺️  Communes et départements des refuges (geo.api.gouv.fr)…');
  const geo = await geocodeRefuges(refuges, refresh);
  console.log(`   ✓ ${geo.total} refuges rattachés (${geo.nouveaux} nouvelles requêtes)`);

  writeJson(PATHS.collecte, {
    date: new Date().toISOString(),
    datasets: datasets.length,
    tuiles: tiles.length,
    arrets: stops.length,
    maxArretsParTuile: maxPerTile,
  });
  console.log('\n✅ Collecte terminée. Lancer ensuite : node scripts/transport_v2/2_analyser_couverture.cjs');
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
