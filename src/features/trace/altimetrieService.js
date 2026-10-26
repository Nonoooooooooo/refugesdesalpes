// Service de calcul altimétrique de la Géoplateforme (IGN), interrogé directement depuis le navigateur.
// La limite d'usage est de 5 requêtes/s par adresse IP : chaque utilisateur a donc son propre quota.
// Pour rester bien en dessous, toutes les requêtes de l'onglet passent par une file unique espacée de 250 ms,
// les altitudes déjà connues sont gardées en mémoire, et un 429 est réessayé après le blocage de 5 s.

const ENDPOINT = 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json'
const RESOURCE = 'ign_rge_alti_wld'
export const MAX_POINTS_PER_REQUEST = 5000
const NO_DATA = -99999
const MIN_INTERVAL_MS = 250
const BLOCK_DURATION_S = 5
const MAX_RETRIES = 3
const CACHE_MAX = 60000

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
    const elevations = await requestChunk(chunk, signal)
    chunk.forEach((c, j) => remember(coordKey(c), elevations[j] ?? null))
  }
  return coords.map((c) => cache.get(coordKey(c)) ?? null)
}
