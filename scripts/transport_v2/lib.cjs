/**
 * Outils partagés de l'étape 1 « Transport v2 » (inventaire des sources et couverture des refuges).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const CACHE_DIR = path.join(ROOT, 'imports/transport_v2'); // ignoré par Git (imports/)
const DOCS_DIR = path.join(ROOT, 'docs/transport');

const PATHS = {
  refuges: path.join(ROOT, 'public/refuges_index.json'),
  carte: path.join(ROOT, 'public/transports_v2.json'),
  sources: path.join(ROOT, 'scripts/transport_v2/sources.cjs'),
  datasets: path.join(CACHE_DIR, 'datasets.json'),
  arrets: path.join(CACHE_DIR, 'arrets_officiels.json'),
  communes: path.join(CACHE_DIR, 'communes_refuges.json'),
  collecte: path.join(CACHE_DIR, 'collecte.json'),
};

// Types de points refuges.info pour lesquels la desserte en transport a du sens
const TYPES_HEBERGEMENT = ['refuge gardé', 'cabane non gardée', "gîte d'étape"];

const UA = { 'User-Agent': 'RefugesDesAlpes-InventaireTransport/1.0' };

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data), 'utf8');
}

function loadHebergements() {
  return readJson(PATHS.refuges)
    .filter((r) => TYPES_HEBERGEMENT.includes(r.type) && Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map((r) => ({ ...r, id: String(r.id) }));
}

async function fetchJson(url, { retries = 4 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} pour ${url}`), { fatal: true });
      return await res.json();
    } catch (err) {
      if (err.fatal || attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}

// Exécute fn sur chaque élément avec une concurrence limitée
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Index spatial en grille pour trouver rapidement le point le plus proche.
 * Les points sont des objets { lat, lng, ... }.
 */
class GridIndex {
  constructor(points, cellDeg = 0.05) {
    this.cellDeg = cellDeg;
    this.cells = new Map();
    this.points = points;
    for (const p of points) {
      const key = this.key(Math.floor(p.lat / cellDeg), Math.floor(p.lng / cellDeg));
      if (!this.cells.has(key)) this.cells.set(key, []);
      this.cells.get(key).push(p);
    }
    // Largeur minimale d'une cellule en km (côté longitude, au nord des Alpes)
    this.cellKmMin = cellDeg * 111.32 * Math.cos((47 * Math.PI) / 180);
  }

  key(i, j) {
    return `${i}:${j}`;
  }

  nearest(lat, lng, maxKm = 40) {
    const ci = Math.floor(lat / this.cellDeg);
    const cj = Math.floor(lng / this.cellDeg);
    const maxRing = Math.ceil(maxKm / this.cellKmMin) + 1;
    let best = null;
    let bestD = Infinity;
    for (let r = 0; r <= maxRing; r++) {
      for (let i = ci - r; i <= ci + r; i++) {
        for (let j = cj - r; j <= cj + r; j++) {
          if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue; // seulement l'anneau r
          const cell = this.cells.get(this.key(i, j));
          if (!cell) continue;
          for (const p of cell) {
            const d = distanceKm(lat, lng, p.lat, p.lng);
            if (d < bestD) {
              bestD = d;
              best = p;
            }
          }
        }
      }
      if (best && bestD <= r * this.cellKmMin) break;
    }
    return best && bestD <= maxKm ? { point: best, km: bestD } : null;
  }

  // Tous les points à moins de km du point donné
  within(lat, lng, km) {
    const ci = Math.floor(lat / this.cellDeg);
    const cj = Math.floor(lng / this.cellDeg);
    const rings = Math.ceil(km / this.cellKmMin) + 1;
    const out = [];
    for (let i = ci - rings; i <= ci + rings; i++) {
      for (let j = cj - rings; j <= cj + rings; j++) {
        const cell = this.cells.get(this.key(i, j));
        if (!cell) continue;
        for (const p of cell) if (distanceKm(lat, lng, p.lat, p.lng) <= km) out.push(p);
      }
    }
    return out;
  }
}

// CSV au format Excel français (séparateur « ; », BOM UTF-8 pour les accents)
function toCsv(rows, columns) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => esc(c.label)).join(';')];
  for (const row of rows) lines.push(columns.map((c) => esc(row[c.key])).join(';'));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

module.exports = {
  ROOT,
  CACHE_DIR,
  DOCS_DIR,
  PATHS,
  TYPES_HEBERGEMENT,
  readJson,
  writeJson,
  loadHebergements,
  fetchJson,
  mapLimit,
  distanceKm,
  GridIndex,
  toCsv,
};
