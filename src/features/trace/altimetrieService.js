// Service de calcul altimétrique de la Géoplateforme (IGN), interrogé directement depuis le navigateur.
// La limite d'usage est de 5 requêtes/s par adresse IP : chaque utilisateur a donc son propre quota.
// Pour rester bien en dessous, toutes les requêtes de l'onglet passent par une file unique espacée de 250 ms,
// les altitudes déjà connues sont gardées en mémoire, et un 429 est réessayé après le blocage de 5 s.
// Si le service tombe (erreur 5xx ou réseau), les altitudes sont lues dans la grille RGE ALTI brute du WMS IGN,
// découpée en tuiles fixes que le service worker garde aussi pour le hors-ligne.

const ENDPOINT = 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json'
const RESOURCE = 'ign_rge_alti_wld'
export const MAX_POINTS_PER_REQUEST = 5000
const NO_DATA = -99999
const MIN_INTERVAL_MS = 250
const BLOCK_DURATION_S = 5
const MAX_RETRIES = 3
const CACHE_MAX = 60000
// Après une panne du service, on passe directement par le WMS pendant ce délai
const OUTAGE_MS = 60000

const WMS_ENDPOINT = 'https://data.geopf.fr/wms-r/wms'
const WMS_LAYER = 'ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES'
// Tuiles de 0,01° sur 256 px : un pixel fait ~4 m, assez fin pour la pente mesurée sur 20 m
const TILE_DEG = 0.01
const TILE_PX = 256
const TILES_MAX = 64

// "lon,lat" arrondis à 1e-6° (~10 cm) → altitude, ou null hors couverture
const cache = new Map()

const coordKey = ([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`

function remember(key, z) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value)
  cache.set(key, z)
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

let queue = Promise.resolve()
let lastRequestAt = 0

function throttled(fn) {
  const run = queue.then(async () => {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastRequestAt = Date.now()
    return fn()
  })
  queue = run.catch(() => {})
  return run
}

async function requestChunk(coords, signal, attempt = 0) {
  signal?.throwIfAborted()
  const res = await throttled(() =>
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lon: coords.map((c) => c[0].toFixed(6)).join('|'),
        lat: coords.map((c) => c[1].toFixed(6)).join('|'),
        resource: RESOURCE,
        delimiter: '|',
        zonly: 'true',
      }),
      signal,
    }),
  )
  if (res.status === 429 && attempt < MAX_RETRIES) {
    // L'en-tête retry-after n'est pas toujours lisible en CORS : on retombe sur la durée de blocage documentée
    const retryAfter = Number(res.headers.get('retry-after')) || BLOCK_DURATION_S
    await sleep(Math.min(retryAfter, BLOCK_DURATION_S) * 1000, signal)
    return requestChunk(coords, signal, attempt + 1)
  }
  if (!res.ok) throw new Error(`Service altimétrique IGN indisponible (${res.status})`)
  const data = await res.json()
  return data.elevations.map((z) => (z == null || z <= NO_DATA ? null : z))
}

// "i,j" (indices de tuile en longitude, latitude) → grille Float32 de TILE_PX × TILE_PX, ligne nord en premier
const tiles = new Map()

function tileUrl(i, j) {
  const south = j * TILE_DEG
  const west = i * TILE_DEG
  // WMS 1.3.0 en EPSG:4326 : l'emprise s'écrit latitude d'abord
  const bbox = [south, west, south + TILE_DEG, west + TILE_DEG].map((v) => v.toFixed(5)).join(',')
  return (
    `${WMS_ENDPOINT}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${WMS_LAYER}&STYLES=&CRS=EPSG:4326` +
    `&BBOX=${bbox}&WIDTH=${TILE_PX}&HEIGHT=${TILE_PX}&FORMAT=image/x-bil;bits=32`
  )
}

async function loadTile(i, j, signal, attempt = 0) {
  signal?.throwIfAborted()
  const res = await throttled(() => fetch(tileUrl(i, j), { signal }))
  if (res.status === 429 && attempt < MAX_RETRIES) {
    await sleep(BLOCK_DURATION_S * 1000, signal)
    return loadTile(i, j, signal, attempt + 1)
  }
  if (!res.ok) throw new Error(`Service altimétrique IGN indisponible (${res.status})`)
  const buf = await res.arrayBuffer()
  // Hors-ligne, le service worker renvoie un pixel transparent à la place d'une tuile jamais téléchargée
  if (buf.byteLength !== TILE_PX * TILE_PX * 4) throw new Error('Altitude IGN indisponible')
  return new Float32Array(buf)
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

/** Altitude interpolée entre les 4 pixels voisins, null si l'un d'eux est hors couverture */
function sampleTile(grid, i, j, [lng, lat]) {
  const pxDeg = TILE_DEG / TILE_PX
  // Position depuis le coin nord-ouest, en pixels, centres de pixels à +0,5
  const x = (lng - i * TILE_DEG) / pxDeg - 0.5
  const y = ((j + 1) * TILE_DEG - lat) / pxDeg - 0.5
  const x0 = clamp(Math.floor(x), 0, TILE_PX - 2)
  const y0 = clamp(Math.floor(y), 0, TILE_PX - 2)
  const fx = clamp(x - x0, 0, 1)
  const fy = clamp(y - y0, 0, 1)
  const z00 = grid[y0 * TILE_PX + x0]
  const z10 = grid[y0 * TILE_PX + x0 + 1]
  const z01 = grid[(y0 + 1) * TILE_PX + x0]
  const z11 = grid[(y0 + 1) * TILE_PX + x0 + 1]
  if ([z00, z10, z01, z11].some((z) => !(z > NO_DATA))) return null
  return z00 * (1 - fx) * (1 - fy) + z10 * fx * (1 - fy) + z01 * (1 - fx) * fy + z11 * fx * fy
}

async function elevationsFromWms(coords, signal) {
  const tileOf = ([lng, lat]) => [Math.floor(lng / TILE_DEG), Math.floor(lat / TILE_DEG)]
  // Grilles utiles à cet appel, gardées à part : un long tracé peut dépasser la taille du cache partagé
  const grids = new Map()
  for (const c of coords) {
    const [i, j] = tileOf(c)
    const k = `${i},${j}`
    if (grids.has(k)) continue
    let grid = tiles.get(k)
    if (!grid) {
      grid = await loadTile(i, j, signal)
      if (tiles.size >= TILES_MAX) tiles.delete(tiles.keys().next().value)
      tiles.set(k, grid)
    }
    grids.set(k, grid)
  }
  return coords.map((c) => {
    const [i, j] = tileOf(c)
    return sampleTile(grids.get(`${i},${j}`), i, j, c)
  })
}

let outageUntil = 0

async function requestWithFallback(coords, signal) {
  if (Date.now() >= outageUntil) {
    try {
      return await requestChunk(coords, signal)
    } catch (e) {
      if (signal?.aborted) throw e
      outageUntil = Date.now() + OUTAGE_MS
    }
  }
  return elevationsFromWms(coords, signal)
}

/**
 * Altitudes (m) de coordonnées [lng, lat], dans le même ordre. null hors couverture IGN.
 * Seules les coordonnées absentes du cache sont demandées, par paquets de 5 000 points.
 */
export async function fetchElevations(coords, signal) {
  const missing = []
  const queued = new Set()
  for (const c of coords) {
    const key = coordKey(c)
    if (!cache.has(key) && !queued.has(key)) {
      queued.add(key)
      missing.push(c)
    }
  }
  for (let i = 0; i < missing.length; i += MAX_POINTS_PER_REQUEST) {
    const chunk = missing.slice(i, i + MAX_POINTS_PER_REQUEST)
    const elevations = await requestWithFallback(chunk, signal)
    chunk.forEach((c, j) => remember(coordKey(c), elevations[j] ?? null))
  }
  return coords.map((c) => cache.get(coordKey(c)) ?? null)
}
