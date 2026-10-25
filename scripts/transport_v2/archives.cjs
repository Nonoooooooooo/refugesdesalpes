/**
 * Archive des flux GTFS saisonniers (navettes de station) qui se vident entre deux saisons.
 *
 * Certains éditeurs publient un flux vide (en-têtes seulement) hors saison, ou un flux « glissant »
 * qui ne couvre que les jours à venir. Pour continuer à afficher la dernière saison, on garde dans
 * le dépôt, pour chaque ressource, la version remplie la plus complète de la dernière saison.
 *
 * Fichiers (versionnés dans Git pour que la construction soit reproductible) :
 *   scripts/transport_v2/archives/index.json            versions gardées et leurs mesures
 *   scripts/transport_v2/archives/gtfs/<ressource>/*.zip archives GTFS
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { CACHE_DIR } = require('./lib.cjs');
const { extractGtfs, eachRow, loadServiceDates, ymd, parseYmd } = require('./gtfs.cjs');

const ARCHIVE_DIR = path.join(__dirname, 'archives');
const INDEX_FILE = path.join(ARCHIVE_DIR, 'index.json');
const WORK_DIR = path.join(CACHE_DIR, 'archives'); // extractions temporaires (ignoré par Git)
const TAILLE_MAX = 1e6; // on n'archive que des flux légers (navettes de station), pour garder le dépôt léger
const MEME_SAISON_JOURS = 60;

function loadIndex() {
  return fs.existsSync(INDEX_FILE) ? JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')) : {};
}

function saveIndex(index) {
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2) + '\n', 'utf8');
}

const sha1 = (file) => crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');

// Vrai si le fichier contient au moins une ligne de données sous l'en-tête
function hasDataRows(root, file) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) return false;
  const fd = fs.openSync(p, 'r');
  const buf = Buffer.alloc(65536);
  const n = fs.readSync(fd, buf, 0, buf.length, 0);
  fs.closeSync(fd);
  return buf.toString('utf8', 0, n).split(/\r?\n/).filter((l) => l.trim()).length > 1;
}

function isEmptyFeed(root) {
  return !hasDataRows(root, 'routes.txt') || !hasDataRows(root, 'trips.txt') || !hasDataRows(root, 'stop_times.txt');
}

/**
 * Mesures d'un flux : nombre de lignes, de courses, période couverte et jours de service.
 */
async function measureFeed(root) {
  if (isEmptyFeed(root)) return { lignes: 0, courses: 0, joursService: 0, debut: null, fin: null };
  let lignes = 0;
  await eachRow(root, 'routes.txt', () => lignes++);
  const services = new Set();
  let courses = 0;
  await eachRow(root, 'trips.txt', (get) => {
    courses++;
    services.add(get('service_id'));
  });
  const today = new Date();
  const from = ymd(new Date(Date.UTC(today.getUTCFullYear() - 3, 0, 1)));
  const to = ymd(new Date(Date.UTC(today.getUTCFullYear() + 2, 11, 31)));
  const dates = new Set();
  for (const set of (await loadServiceDates(root, services, from, to)).values()) for (const d of set) dates.add(d);
  const sorted = [...dates].sort();
  const iso = (s) => (s ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null);
  return { lignes, courses, joursService: dates.size, debut: iso(sorted[0]), fin: iso(sorted[sorted.length - 1]) };
}

/**
 * Meilleure version archivée : parmi les versions de la dernière saison connue, celle qui a
 * le plus de lignes, puis le plus de jours de service, de courses, et enfin la plus récente.
 */
function bestVersion(versions) {
  const pleines = versions.filter((v) => v.courses > 0 && v.fin);
  if (!pleines.length) return null;
  const derniereFin = pleines.map((v) => v.fin).sort().pop();
  const limite = ymd(new Date(parseYmd(derniereFin.replace(/-/g, '')).getTime() - MEME_SAISON_JOURS * 86400000));
  const saison = pleines.filter((v) => v.fin.replace(/-/g, '') >= limite);
  return saison.sort(
    (a, b) => b.lignes - a.lignes || b.joursService - a.joursService || b.courses - a.courses || b.versionDate.localeCompare(a.versionDate)
  )[0];
}

function pickArchived(resourceId) {
  const entry = loadIndex()[String(resourceId)];
  return entry ? bestVersion(entry.versions) : null;
}

// Ne garde que la meilleure version (les suivantes lui sont comparées grâce à ses mesures)
function prune(entry) {
  const best = bestVersion(entry.versions);
  for (const v of entry.versions) if (v !== best) fs.rmSync(path.join(ARCHIVE_DIR, v.fichier), { force: true });
  entry.versions = best ? [best] : [];
}

// Applique les règles de conservation à toute l'archive (taille maximale, une version par ressource)
function nettoyer() {
  const index = loadIndex();
  for (const [key, entry] of Object.entries(index)) {
    for (const v of entry.versions.filter((x) => x.taille > TAILLE_MAX)) fs.rmSync(path.join(ARCHIVE_DIR, v.fichier), { force: true });
    entry.versions = entry.versions.filter((x) => x.taille <= TAILLE_MAX);
    prune(entry);
    if (!entry.versions.length) {
      fs.rmSync(path.join(ARCHIVE_DIR, 'gtfs', key), { recursive: true, force: true });
      delete index[key];
    }
  }
  saveIndex(index);
  return index;
}

/**
 * Ajoute une version à l'archive si elle est remplie et nouvelle.
 * Retourne { ajoutee, vide, mesures }.
 */
async function archiveZip({ resourceId, datasetId, titre, versionDate, url, origine, zipPath }) {
  if (!zipPath || !fs.existsSync(zipPath) || fs.statSync(zipPath).size > TAILLE_MAX) return { ajoutee: false, raison: 'trop lourd ou absent' };
  const index = loadIndex();
  const key = String(resourceId);
  const entry = index[key] || { datasetId, titre, versions: [] };
  const hash = sha1(zipPath);
  if (entry.versions.some((v) => v.sha1 === hash)) return { ajoutee: false, raison: 'déjà archivée' };
  if ((entry.vues || []).includes(hash)) return { ajoutee: false, raison: 'déjà examinée' };

  const root = extractGtfs(zipPath, path.join(WORK_DIR, `${key}-${hash.slice(0, 10)}`));
  const mesures = await measureFeed(root);
  entry.vues = [...(entry.vues || []), hash].slice(-30); // versions déjà mesurées, pour ne pas les réexaminer
  if (mesures.courses === 0) {
    if (index[key]) saveIndex({ ...index, [key]: entry });
    return { ajoutee: false, vide: true, mesures };
  }

  const fichier = `gtfs/${key}/${versionDate.slice(0, 10)}-${hash.slice(0, 10)}.zip`;
  fs.mkdirSync(path.dirname(path.join(ARCHIVE_DIR, fichier)), { recursive: true });
  fs.copyFileSync(zipPath, path.join(ARCHIVE_DIR, fichier));
  entry.titre = titre || entry.titre;
  entry.versions.push({ versionDate, origine, url, fichier, sha1: hash, taille: fs.statSync(zipPath).size, ...mesures });
  prune(entry);
  index[key] = entry;
  saveIndex(index);
  return { ajoutee: entry.versions.some((v) => v.sha1 === hash), mesures };
}

// Extrait (une seule fois) une version archivée et retourne son dossier GTFS
function extractArchived(resourceId, version) {
  const dir = path.join(WORK_DIR, `${resourceId}-${version.sha1.slice(0, 10)}`);
  const marker = path.join(dir, '.extrait');
  if (fs.existsSync(marker)) return JSON.parse(fs.readFileSync(marker, 'utf8')).root;
  const root = extractGtfs(path.join(ARCHIVE_DIR, version.fichier), dir);
  fs.writeFileSync(marker, JSON.stringify({ root }), 'utf8');
  return root;
}

module.exports = { ARCHIVE_DIR, INDEX_FILE, TAILLE_MAX, loadIndex, isEmptyFeed, measureFeed, bestVersion, pickArchived, archiveZip, extractArchived, nettoyer };
