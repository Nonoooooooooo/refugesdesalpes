const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
]

/**
 * Exécute une requête QL sur l'API Overpass avec basculement automatique en cas d'erreur
 */
async function queryOverpass(qlQuery, signal) {
  let lastError = null

  for (const endpoint of OVERPASS_ENDPOINTS) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'Accept': 'application/json, text/plain, */*',
        },
        body: 'data=' + encodeURIComponent(qlQuery),
        signal,
      })

      if (res.ok) {
        const data = await res.json()
        return data.elements || []
      }
      lastError = new Error(`Overpass ${endpoint} returned status ${res.status}`)
    } catch (e) {
      if (e.name === 'AbortError') throw e
      lastError = e
    }
  }

  throw lastError || new Error('All Overpass endpoints failed')
}

/**
 * Récupère les parkings dans la bounding box (zoom >= 13)
 * Inclut les points (node) et les zones/surfaces de parking (way, relation)
 * @param {[number, number, number, number]} bounds [south, west, north, east]
 */
export async function fetchOverpassParkings([south, west, north, east], signal) {
  const s = south.toFixed(5)
  const w = west.toFixed(5)
  const n = north.toFixed(5)
  const e = east.toFixed(5)

  const ql = `[out:json][timeout:25];(node["amenity"="parking"](${s},${w},${n},${e});way["amenity"="parking"](${s},${w},${n},${e}););out center;`
  const elements = await queryOverpass(ql, signal)

  return elements
    .map((el) => {
      const tags = el.tags || {}
      const lat = el.lat ?? el.center?.lat
      const lng = el.lon ?? el.center?.lon

      if (lat == null || lng == null) return null

      const name = tags.name || tags.operator || (tags.parking === 'underground' ? 'Parking souterrain' : 'Parking')
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
      }
    })
    .filter(Boolean)
}

/**
 * Récupère les sommets et cols dans la bounding box (zoom >= 13)
 * @param {[number, number, number, number]} bounds [south, west, north, east]
 */
export async function fetchOverpassPeaksAndPasses([south, west, north, east], signal) {
  const s = south.toFixed(5)
  const w = west.toFixed(5)
  const n = north.toFixed(5)
  const e = east.toFixed(5)

  const ql = `[out:json][timeout:25];(node["natural"="peak"](${s},${w},${n},${e});node["natural"="saddle"](${s},${w},${n},${e});node["mountain_pass"="yes"](${s},${w},${n},${e}););out;`
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
