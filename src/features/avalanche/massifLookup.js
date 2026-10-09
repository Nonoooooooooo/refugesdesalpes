import * as turf from '@turf/turf'

let geojsonPromise = null

/**
 * Charge de manière asynchrone le GeoJSON officiel des massifs BERA Météo-France.
 */
export async function loadMassifsGeoJSON() {
  if (!geojsonPromise) {
    geojsonPromise = fetch('/data/massifs_bra.geojson')
      .then((res) => {
        if (!res.ok) throw new Error(`Erreur chargement massifs (${res.status})`)
        return res.json()
      })
      .catch((err) => {
        console.error('Impossible de charger les massifs BRA :', err)
        geojsonPromise = null
        throw err
      })
  }
  return geojsonPromise
}

/**
 * Identifie le massif BERA Météo-France correspondant aux coordonnées d'un point (lat, lng).
 * Utilise le test géométrique point-in-polygon (Turf.js).
 * Si le point est légèrement à l'extérieur des frontières (ligne de crête, vallée limitrophe),
 * sélectionne le massif le plus proche dans un rayon de 40 km.
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<{ id: number, code: string, label: string, slug: string, exact: boolean, distanceKm?: number } | null>}
 */
export async function findMassifByCoords(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return null
  }

  try {
    const geojson = await loadMassifsGeoJSON()
    const pt = turf.point([lng, lat])

    // 1. Recherche exacte : le point est-il à l'intérieur du polygone du massif ?
    for (const feature of geojson.features) {
      try {
        if (turf.booleanPointInPolygon(pt, feature)) {
          const numId = parseInt(feature.properties.id.replace('OPP', ''), 10)
          return {
            id: numId,
            code: feature.properties.id,
            label: feature.properties.label,
            slug: feature.properties.slug,
            exact: true,
          }
        }
      } catch {
        // Ignorer les erreurs géométriques isolées
      }
    }

    // 2. Recherche par proximité si sur une ligne de crête frontière ou vallée immédiate
    let closest = null
    let minDist = Infinity

    for (const feature of geojson.features) {
      try {
        const center = turf.centerOfMass(feature)
        const dist = turf.distance(pt, center, { units: 'kilometers' })
        if (dist < minDist) {
          minDist = dist
          closest = feature
        }
      } catch {
        // Continuer
      }
    }

    // Tolérance max de 45 km par rapport au centre de masse du massif
    if (closest && minDist < 45) {
      const numId = parseInt(closest.properties.id.replace('OPP', ''), 10)
      return {
        id: numId,
        code: closest.properties.id,
        label: closest.properties.label,
        slug: closest.properties.slug,
        exact: false,
        distanceKm: Math.round(minDist),
      }
    }

    return null
  } catch (err) {
    console.warn('Erreur lors de la localisation du massif BERA :', err)
    return null
  }
}

/**
 * Retourne la liste de tous les massifs répertoriés.
 */
export async function getAllMassifs() {
  const geojson = await loadMassifsGeoJSON()
  return geojson.features.map((f) => ({
    id: parseInt(f.properties.id.replace('OPP', ''), 10),
    code: f.properties.id,
    label: f.properties.label,
    slug: f.properties.slug,
  }))
}
