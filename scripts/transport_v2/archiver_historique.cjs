/**
 * Remplit l'archive des flux saisonniers à partir de l'historique de transport.data.gouv.fr.
 *
 * transport.data.gouv.fr conserve les dernières versions de chaque ressource (champ « history »
 * de /api/datasets/:id, avec une adresse permanente). Ce script télécharge les versions
 * remplies les plus récentes et garde dans scripts/transport_v2/archives/ la plus complète
 * de la dernière saison (voir archives.cjs).
 *
 * Utilisation :
 *   node scripts/transport_v2/archiver_historique.cjs                 # toutes les navettes de sources.cjs
 *   node scripts/transport_v2/archiver_historique.cjs <id> [<id>…]    # jeux de données précis
 */

const path = require('path');
const { CACHE_DIR, fetchJson } = require('./lib.cjs');
const { downloadTo } = require('./gtfs.cjs');
const { archiveZip, loadIndex, bestVersion, nettoyer } = require('./archives.cjs');
const SOURCES = require('./sources.cjs');

const VERSIONS_EXAMINEES = 8; // versions remplies les plus récentes téléchargées par ressource
const TAILLE_VIDE = 5000; // octets décompressés : en dessous, le flux ne contient que des en-têtes

async function main() {
  const ids = process.argv.slice(2);
  const sources = ids.length
    ? ids.map((id) => SOURCES.find((s) => s.id === id) || { id, reseau: id })
    : SOURCES.filter((s) => s.actif !== false && (s.archiver || (s.navette && s.archiver !== false)));

  for (const source of sources) {
    const dataset = await fetchJson(`https://transport.data.gouv.fr/api/datasets/${source.id}`);
    const gtfsIds = new Set((dataset.resources || []).filter((r) => r.format === 'GTFS').map((r) => r.id));
    const history = (dataset.history || [])
      .filter((h) => h.payload?.format === 'GTFS' && gtfsIds.has(h.resource_id) && h.payload.permanent_url)
      .filter((h) => (h.payload.total_uncompressed_size || 0) > TAILLE_VIDE)
      .sort((a, b) => String(b.payload.download_datetime).localeCompare(String(a.payload.download_datetime)));

    const parRessource = new Map();
    for (const h of history) {
      if (!parRessource.has(h.resource_id)) parRessource.set(h.resource_id, []);
      if (parRessource.get(h.resource_id).length < VERSIONS_EXAMINEES) parRessource.get(h.resource_id).push(h);
    }
    console.log(`\n📚 ${source.reseau} : ${history.length} versions remplies dans l'historique`);

    for (const [resourceId, versions] of parRessource) {
      for (const h of versions) {
        const zipPath = path.join(CACHE_DIR, 'historique', String(resourceId), path.basename(h.payload.filename));
        try {
          await downloadTo(h.payload.permanent_url, zipPath);
          const r = await archiveZip({
            resourceId,
            datasetId: source.id,
            titre: dataset.title,
            versionDate: h.payload.download_datetime,
            url: h.payload.permanent_url,
            origine: 'historique transport.data.gouv.fr',
            zipPath,
          });
          const m = r.mesures;
          console.log(`   ${h.payload.download_datetime.slice(0, 10)}  ${m ? `${m.lignes} lignes, ${m.courses} courses, ${m.joursService} jours (${m.debut} → ${m.fin})` : r.raison}${r.ajoutee ? '' : r.vide ? ' — vide' : ''}`);
        } catch (err) {
          console.log(`   ⚠️  ${h.payload.download_datetime.slice(0, 10)} : ${err.message}`);
        }
      }
      const best = bestVersion(loadIndex()[String(resourceId)]?.versions || []);
      if (best) console.log(`   ✅ version retenue : ${best.versionDate.slice(0, 10)} (${best.joursService} jours de service, ${best.debut} → ${best.fin})`);
    }
  }
  const index = nettoyer();
  console.log(`\n🗄️  Archive : ${Object.keys(index).length} ressources, une version chacune`);
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
