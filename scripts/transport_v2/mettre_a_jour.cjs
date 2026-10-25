/**
 * Mise à jour complète du réseau de transport (remplace l'ancien update_transports_monthly.cjs).
 *
 *   npm run update-transports   collecte des arrêts officiels, tracés des navettes, construction
 *                               du réseau (avec archivage des flux saisonniers) et rapport de couverture
 *   npm run check-transports    vérifie seulement ce qui a changé, sans rien reconstruire :
 *                               flux officiels republiés depuis la dernière construction et
 *                               navettes hors open data dont la saison relevée est terminée
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { fetchJson } = require('./lib.cjs');
const { GTFS_DIR } = require('./gtfs.cjs');
const { loadNavettes } = require('./navettes.cjs');
const SOURCES = require('./sources.cjs');

const ETAPES = [
  ['Collecte des arrêts officiels autour des refuges', '1_collecter_sources.cjs'],
  ['Tracés des navettes hors open data', 'navettes_tracer.cjs'],
  ['Construction du réseau', '3_construire_reseau.cjs'],
  ['Rapport de couverture des refuges', '2_analyser_couverture.cjs', '--carte', 'public/transports_v2.json', '--suffixe', 'v2'],
];

function run() {
  for (const [titre, script, ...args] of ETAPES) {
    console.log(`\n=== ${titre} ===`);
    execFileSync(process.execPath, ['--max-old-space-size=6144', path.join(__dirname, script), ...args], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../..'),
    });
  }
  console.log('\n✅ Réseau à jour. Comptes rendus : docs/transport/construction_reseau.md et docs/transport/rapport_couverture_v2.md');
}

async function verifier() {
  console.log('📡 Flux officiels republiés depuis la dernière construction :');
  const catalogue = await fetchJson('https://transport.data.gouv.fr/api/datasets');
  const byId = new Map(catalogue.map((d) => [d.id, d]));
  let changes = 0;
  for (const s of SOURCES.filter((x) => x.actif !== false)) {
    const ds = byId.get(s.id);
    if (!ds) {
      console.log(`   ⚠️  ${s.reseau} : jeu de données introuvable dans le catalogue`);
      continue;
    }
    for (const r of (ds.resources || []).filter((x) => x.format === 'GTFS')) {
      const metaFile = path.join(GTFS_DIR, `${r.id}.json`);
      const local = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')).updated : null;
      if (local !== r.updated) {
        changes++;
        console.log(`   • ${s.reseau} (ressource ${r.id}) : ${local ? `version locale ${String(local).slice(0, 10)}` : 'jamais téléchargée'} → publiée le ${String(r.updated).slice(0, 10)}`);
      }
    }
  }
  if (!changes) console.log('   aucun');

  const today = new Date().toISOString().slice(0, 10);
  const finies = loadNavettes().filter((n) => n.saison?.fin < today);
  console.log(`\n🚐 Navettes hors open data dont la saison relevée est terminée (${finies.length}) — chercher le document de la saison suivante :`);
  for (const n of finies) console.log(`   • ${n.nom} : saison ${n.saison.debut} → ${n.saison.fin}, source ${n.source?.url}`);
  console.log(changes ? '\n➡️  Lancer « npm run update-transports » pour intégrer les nouvelles versions.' : '');
}

if (process.argv.includes('--verifier')) {
  verifier().catch((err) => {
    console.error('❌', err);
    process.exit(1);
  });
} else {
  run();
}
