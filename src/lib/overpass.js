const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

/**
 * Exécute une requête QL sur l'API Overpass
 */
async function queryOverpass(qlQuery, signal) {
  const body = new URLSearchParams({ data: qlQuery }).toString()
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body,
    signal,
  })

  if (!res.ok) {
    throw new Error(`Overpass API error (${res.status})`)
  }

  const data = await res.json()
  return data.elements || []
}

/**
 * Récupère les parkings dans la bounding box (zoom >= 13)
 * @param {[number, number, number, number]} bounds [south, west, north, east]
 */
export async function fetchOverpassParkings([south, west, north, east], signal) {
  const ql = `[out:json][timeout:25];node["amenity"="parking"](${south.toFixed(5)},${west.toFixed(5)},${north.toFixed(5)},${east.toFixed(5)});out;`
  const elements = await queryOverpass(ql, signal)

  return elements.map((el) => {
    const tags = el.tags || {}
    return {
      id: `parking-${el.id}`,
      lat: el.lat,
      lng: el.lon,
      name: tags.name || tags.operator || 'Parking',
      capacity: tags.capacity || null,
      fee: tags.fee === 'yes' ? 'Payant' : tags.fee === 'no' ? 'Gratuit' : null,
      surface: tags.surface || null,
    }
  })
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
    .filter((el) => el.tags && (el.tags.name || el.tags.ele))
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
