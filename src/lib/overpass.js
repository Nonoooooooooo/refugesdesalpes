const FALLBACK_OVERPASS_ENDPOINTS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
]

// Cache client en mémoire pour éviter de refaire la même requête au pan/zoom
const clientCache = new Map()
const CLIENT_CACHE_TTL = 8 * 60 * 1000 // 8 minutes

/**
 * Exécute une requête QL sur l'API Overpass :
 * 1. Essaie via le proxy local / Vercel (/api/overpass)
 * 2. Si non disponible, bascule sur les miroirs publics
 */
async function queryOverpass(qlQuery, signal) {
  const cached = clientCache.get(qlQuery)
  if (cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL) {
    return cached.data
  }

  // 1. Essai via le proxy /api/overpass
  try {
    const res = await fetch('/api/overpass', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: qlQuery }),
      signal,
    })

    if (res.ok) {
      const data = await res.json()
      const elements = data.elements || []
      clientCache.set(qlQuery, { timestamp: Date.now(), data: elements })
      return elements
    }
  } catch (e) {
    if (e.name === 'AbortError') throw e
    console.warn('Proxy /api/overpass indisponible, tentative directe...', e)
  }

  // 2. Basculement sur les miroirs publics directs (lz4 en premier)
  let lastError = null
  for (const endpoint of FALLBACK_OVERPASS_ENDPOINTS) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: 'data=' + encodeURIComponent(qlQuery),
        signal,
      })

      if (res.ok) {
        const data = await res.json()
        const elements = data.elements || []
        clientCache.set(qlQuery, { timestamp: Date.now(), data: elements })
        return elements
      }
      lastError = new Error(`Overpass ${endpoint} status ${res.status}`)
    } catch (e) {
      if (e.name === 'AbortError') throw e
      lastError = e
    }
  }

  throw lastError || new Error('Impossible de joindre les serveurs Overpass')
}

/**
 * Récupère les parkings dans la bounding box (zoom >= 12)
 * @param {[number, number, number, number]} bounds [south, west, north, east]
 */
export async function fetchOverpassParkings([south, west, north, east], signal) {
  // Arrondi à 3 décimales (~100m) pour dédoublonner le cache sans restreindre la précision
  const s = south.toFixed(3)
  const w = west.toFixed(3)
  const n = north.toFixed(3)
  const e = east.toFixed(3)

  const ql = `[out:json][timeout:20];(node["amenity"="parking"](${s},${w},${n},${e});way["amenity"="parking"](${s},${w},${n},${e}););out center;`
  const elements = await queryOverpass(ql, signal)

  return elements
    .map((el) => {
      const tags = el.tags || {}
      const lat = el.lat ?? el.center?.lat
      const lng = el.lon ?? el.center?.lon

      if (lat == null || lng == null) return null

      // Exclure les accès strictement privés pour éviter d'envoyer les randonneurs chez des particuliers
      if (tags.access === 'private' || tags.access === 'no') return null

      let name = tags.name || tags.operator || tags.description
      if (!name) {
        if (tags.parking === 'underground' || tags.parking === 'multi-storey') {
          name = 'Parking couvert'
        } else if (tags.fee === 'no') {
          name = 'Parking gratuit'
        } else {
          name = 'Parking'
        }
      }

      const fee = tags.fee === 'yes' ? 'Payant' : tags.fee === 'no' ? 'Gratuit' : null

      return {
        id: `parking-${el.type}-${el.id}`,
        lat,
        lng,
        name,
        capacity: tags.capacity || null,
        fee,
        surface: tags.surface || null,
        access: tags.access || null,
        parkingType: tags.parking || null,
      }
    })
    .filter(Boolean)
}

/**
 * Récupère les sommets et cols dans la bounding box (zoom >= 12)
 * @param {[number, number, number, number]} bounds [south, west, north, east]
 */
export async function fetchOverpassPeaksAndPasses([south, west, north, east], signal) {
  const s = south.toFixed(3)
  const w = west.toFixed(3)
  const n = north.toFixed(3)
  const e = east.toFixed(3)

  const ql = `[out:json][timeout:20];(node["natural"="peak"](${s},${w},${n},${e});node["natural"="saddle"](${s},${w},${n},${e});node["mountain_pass"="yes"](${s},${w},${n},${e}););out;`
  const elements = await queryOverpass(ql, signal)

  return elements
    .filter((el) => el.tags && (el.tags.name || el.tags.ele) && el.lat != null && el.lon != null)
    .map((el) => {
      const tags = el.tags
      const name = tags.name || (tags.natural === 'peak' ? 'Sommet' : 'Col')
      const ele = tags.ele ? tags.ele.replace(/m$/, '') : null
      const label = ele ? `${name} (${ele}m)` : name
      const isPeak = tags.natural === 'peak'

      return {
        id: `peak-${el.id}`,
        lat: el.lat,
        lng: el.lon,
        name,
        ele,
        label,
        isPeak,
      }
    })
}
