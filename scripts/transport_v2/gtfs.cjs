/**
 * Téléchargement et lecture des flux GTFS (cache dans imports/transport_v2/gtfs/).
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { execFileSync } = require('child_process');
const { CACHE_DIR } = require('./lib.cjs');

const GTFS_DIR = path.join(CACHE_DIR, 'gtfs');

// ---------------------------------------------------------------------------
// Téléchargement et extraction
// ---------------------------------------------------------------------------

function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const attempts = [
    ['tar', ['-xf', zipPath, '-C', destDir]], // bsdtar (Windows 10+, macOS)
    ['unzip', ['-o', '-q', zipPath, '-d', destDir]], // Linux
    ['powershell', ['-NoProfile', '-Command', `Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`]],
  ];
  for (const [cmd, args] of attempts) {
    try {
      execFileSync(cmd, args, { stdio: 'ignore' });
      return;
    } catch {
      // essayer l'outil suivant
    }
  }
  throw new Error(`Impossible d'extraire ${path.basename(zipPath)}`);
}

// Certains flux rangent leurs fichiers dans un sous-dossier de l'archive
function findGtfsRoot(dir) {
  if (fs.existsSync(path.join(dir, 'stops.txt'))) return dir;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const found = findGtfsRoot(path.join(dir, entry.name));
      if (found) return found;
    }
  }
  return null;
}

async function downloadTo(url, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': 'RefugesDesAlpes-ReseauTransport/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} au téléchargement de ${url}`);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(destPath));
}

// Extrait une archive GTFS dans un dossier vidé au préalable et retourne le dossier qui contient stops.txt
function extractGtfs(zipPath, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  extractZip(zipPath, dir);
  const root = findGtfsRoot(dir);
  if (!root) throw new Error(`Archive sans stops.txt (${path.basename(zipPath)})`);
  return root;
}

/**
 * Garantit qu'une ressource GTFS est disponible localement et à jour.
 * Retourne le dossier contenant stops.txt, routes.txt… et l'archive zip téléchargée (gardée en cache).
 */
async function ensureResource(resource) {
  const dir = path.join(GTFS_DIR, String(resource.id));
  const metaFile = path.join(GTFS_DIR, `${resource.id}.json`);
  const zipPath = path.join(GTFS_DIR, `${resource.id}.zip`);
  const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : null;
  if (meta && meta.updated === resource.updated && meta.root && fs.existsSync(path.join(meta.root, 'stops.txt'))) {
    return { root: meta.root, zipPath: fs.existsSync(zipPath) ? zipPath : null, downloaded: false };
  }

  await downloadTo(resource.url, zipPath);
  const root = extractGtfs(zipPath, dir); // dossier de cache propre à cette ressource
  fs.writeFileSync(metaFile, JSON.stringify({ updated: resource.updated, url: resource.url, root }), 'utf8');
  return { root, zipPath, downloaded: true };
}

// ---------------------------------------------------------------------------
// Lecture CSV en flux
// ---------------------------------------------------------------------------

function parseLine(line) {
  if (!line.includes('"')) return line.split(',');
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * Parcourt un fichier GTFS ligne à ligne. onRow(get) reçoit un accesseur get('colonne').
 * Retourne false si le fichier n'existe pas.
 */
async function eachRow(root, file, onRow) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) return false;
  const rl = readline.createInterface({ input: fs.createReadStream(filePath, 'utf8'), crlfDelay: Infinity });
  let cols = null;
  let parts = null;
  const get = (name) => {
    const i = cols.get(name);
    return i === undefined ? '' : (parts[i] ?? '').trim();
  };
  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!cols) {
      cols = new Map(parseLine(line.replace(/^﻿/, '')).map((h, i) => [h.trim(), i]));
      continue;
    }
    parts = parseLine(line);
    onRow(get);
  }
  return true;
}

// « 25:10:00 » → 1510 minutes
function toMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(':');
  const v = Number(h) * 60 + Number(m);
  return Number.isFinite(v) ? v : null;
}

function formatMinutes(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Calendriers
// ---------------------------------------------------------------------------

const DAY_COLS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function ymd(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function parseYmd(s) {
  return new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8))));
}

/**
 * Jours de circulation de chaque service, limités à la fenêtre [from, to] (AAAAMMJJ).
 */
async function loadServiceDates(root, serviceIds, from, to) {
  const dates = new Map([...serviceIds].map((id) => [id, new Set()]));
  await eachRow(root, 'calendar.txt', (get) => {
    const set = dates.get(get('service_id'));
    if (!set) return;
    const start = get('start_date') > from ? get('start_date') : from;
    const end = get('end_date') < to ? get('end_date') : to;
    if (start > end) return;
    const days = DAY_COLS.map((c) => get(c) === '1');
    for (let d = parseYmd(start); ymd(d) <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      if (days[d.getUTCDay()]) set.add(ymd(d));
    }
  });
  await eachRow(root, 'calendar_dates.txt', (get) => {
    const set = dates.get(get('service_id'));
    const date = get('date');
    if (!set || date < from || date > to) return;
    if (get('exception_type') === '1') set.add(date);
    else if (get('exception_type') === '2') set.delete(date);
  });
  return dates;
}

module.exports = {
  GTFS_DIR,
  downloadTo,
  extractGtfs,
  ensureResource,
  eachRow,
  toMinutes,
  formatMinutes,
  loadServiceDates,
  ymd,
  parseYmd,
};
