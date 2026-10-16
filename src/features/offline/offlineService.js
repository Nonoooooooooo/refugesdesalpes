/**
 * Service de gestion cartographique et données hors-ligne
 * Refuges des Alpes
 */

const TILES_CACHE_NAME = 'refuges-map-tiles-v1'
const STORAGE_KEY_ZONES = 'refuges_offline_saved_zones'

// Conversion coordonnées géographiques (WGS84) vers coordonnées tuiles Web Mercator
export function lon2tile(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom))
}

export function lat2tile(lat, zoom) {
  const rad = (lat * Math.PI) / 180
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom),
  )
}

export function tile2lon(x, zoom) {
  return (x / Math.pow(2, zoom)) * 360 - 180
}

export function tile2lat(y, zoom) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom)
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

/**
 * Calcule la liste et le nombre de tuiles pour un rectangle d'emprise géographique
 * @param {[number, number, number, number]} bbox - [west, south, east, north]
 * @param {number} minZoom
 * @param {number} maxZoom
 */
export function calculateZoneTiles(bbox, minZoom = 10, maxZoom = 13) {
  const [west, south, east, north] = bbox
  let totalTiles = 0
  const levels = []

  for (let z = minZoom; z <= maxZoom; z++) {
    const xMin = lon2tile(west, z)
    const xMax = lon2tile(east, z)
    const yMin = lat2tile(north, z) // Au nord, y est plus petit
    const yMax = lat2tile(south, z)

    const width = Math.max(1, xMax - xMin + 1)
    const height = Math.max(1, yMax - yMin + 1)
    const count = width * height

    totalTiles += count
    levels.push({
      zoom: z,
      xMin,
      xMax,
      yMin,
      yMax,
      width,
      height,
      count,
    })
  }

  // Poids moyen par tuile PNG topo / IGN : ~25 Ko
  const estimatedSizeBytes = totalTiles * 25 * 1024
  const estimatedSizeMb = (estimatedSizeBytes / (1024 * 1024)).toFixed(1)

  return {
    totalTiles,
    estimatedSizeBytes,
    estimatedSizeMb,
    levels,
  }
}

/**
 * Génère l'URL d'une tuile selon le calque choisi
 */
export function getTileUrl(layerKey, z, x, y) {
  if (layerKey === 'ign') {
    return `https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`
  }
  if (layerKey === 'opentopo') {
    const subdomains = ['a', 'b', 'c']
    const sub = subdomains[Math.abs(x + y) % subdomains.length]
    return `https://${sub}.tile.opentopomap.org/${z}/${x}/${y}.png`
  }
  // Par défaut IGN
  return `https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`
}

/**
 * Télécharge et met en cache l'ensemble des tuiles et refuges d'une zone géographique
 */
export async function downloadZone({
  id,
  name,
  bbox,
  layer = 'ign',
  minZoom = 10,
  maxZoom = 13,
  onProgress = () => {},
  signal,
}) {
  const calculation = calculateZoneTiles(bbox, minZoom, maxZoom)
  const total = calculation.totalTiles

  // 1. Génération de toutes les coordonnées de tuiles
  const tilesToFetch = []
  for (const level of calculation.levels) {
    const z = level.zoom
    for (let x = level.xMin; x <= level.xMax; x++) {
      for (let y = level.yMin; y <= level.yMax; y++) {
        tilesToFetch.push({
          z,
          x,
          y,
          url: getTileUrl(layer, z, x, y),
        })
      }
    }
  }

  // 2. Ouverture du cache de tuiles
  const cache = await caches.open(TILES_CACHE_NAME)
  let downloaded = 0
  let totalBytes = 0
  const CONCURRENCY = 6

  // File d'attente concurrente avec limitation
  let index = 0
  async function worker() {
    while (index < tilesToFetch.length) {
      if (signal?.aborted) throw new Error('Téléchargement annulé')

      const current = tilesToFetch[index++]
      const url = current.url

      try {
        // Vérifie si déjà en cache
        const alreadyInCache = await cache.match(url)
        if (!alreadyInCache) {
          const res = await fetch(url, { signal, mode: 'cors' })
          if (res.ok) {
            const clone = res.clone()
            await cache.put(url, res)
            const blob = await clone.blob()
            totalBytes += blob.size
          }
        } else {
          totalBytes += 25 * 1024 // Estimation
        }
      } catch (err) {
        if (signal?.aborted) throw err
        // Tolérance aux pannes sur quelques tuiles
        console.warn(`[Offline] Échec tuile ${url}:`, err.message)
      }

      downloaded++
      const percent = Math.min(100, Math.round((downloaded / total) * 100))
      onProgress({
        downloaded,
        total,
        percent,
        bytes: totalBytes,
        mb: (totalBytes / (1024 * 1024)).toFixed(1),
        currentZoom: current.z,
      })
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker())
  await Promise.all(workers)

  // 3. Récupération et sauvegarde des refuges contenus dans la zone
  let zoneRefuges = []
  try {
    const indexRes = await fetch('/refuges_index.json')
    if (indexRes.ok) {
      const allRefuges = await indexRes.json()
      const [west, south, east, north] = bbox
      zoneRefuges = allRefuges.filter(
        (r) => r.lat >= south && r.lat <= north && r.lng >= west && r.lng <= east,
      )
    }
  } catch (err) {
    console.warn('[Offline] Erreur chargement index refuges:', err)
  }

  // 4. Enregistrement des métadonnées de la zone
  const zoneMeta = {
    id: id || `zone-${Date.now()}`,
    name: name || `Zone Alpin (${new Date().toLocaleDateString('fr-FR')})`,
    date: new Date().toISOString(),
    bbox,
    layer,
    minZoom,
    maxZoom,
    tileCount: downloaded,
    sizeBytes: totalBytes,
    sizeMb: (totalBytes / (1024 * 1024)).toFixed(1),
    refugesCount: zoneRefuges.length,
    refuges: zoneRefuges,
    tileUrls: tilesToFetch.map((t) => t.url),
  }

  saveZoneMeta(zoneMeta)
  return zoneMeta
}

/**
 * Récupère les métadonnées de toutes les zones enregistrées
 */
export function getSavedZones() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ZONES)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Enregistre une zone dans le localStorage
 */
function saveZoneMeta(newZone) {
  const zones = getSavedZones().filter((z) => z.id !== newZone.id)
  zones.unshift(newZone)
  try {
    localStorage.setItem(STORAGE_KEY_ZONES, JSON.stringify(zones))
  } catch (e) {
    console.warn('[Offline] Erreur sauvegarde localStorage zone:', e)
  }
}

/**
 * Supprime une zone et libère les tuiles associées du cache
 */
export async function deleteZone(zoneId) {
  const zones = getSavedZones()
  const zoneToDelete = zones.find((z) => z.id === zoneId)
  if (!zoneToDelete) return

  // Nettoyage des tuiles dans le cache si présentes
  if (zoneToDelete.tileUrls && zoneToDelete.tileUrls.length > 0) {
    try {
      const cache = await caches.open(TILES_CACHE_NAME)
      await Promise.allSettled(zoneToDelete.tileUrls.map((url) => cache.delete(url)))
    } catch (err) {
      console.warn('[Offline] Erreur suppression tuiles du cache:', err)
    }
  }

  const updated = zones.filter((z) => z.id !== zoneId)
  localStorage.setItem(STORAGE_KEY_ZONES, JSON.stringify(updated))
}

/**
 * Récupère les refuges stockés hors-ligne correspondant à une bounding box
 */
export function getOfflineRefugesForBbox(bbox) {
  const [west, south, east, north] = bbox
  const zones = getSavedZones()
  const map = new Map()

  for (const zone of zones) {
    if (zone.refuges && Array.isArray(zone.refuges)) {
      for (const r of zone.refuges) {
        if (r.lat >= south && r.lat <= north && r.lng >= west && r.lng <= east) {
          map.set(r.id, r)
        }
      }
    }
  }

  return Array.from(map.values())
}

/**
 * Estimation de l'espace de stockage disponible sur le téléphone
 */
export async function getStorageInfo() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const { quota, usage } = await navigator.storage.estimate()
      const usageMb = (usage / (1024 * 1024)).toFixed(1)
      const quotaMb = (quota / (1024 * 1024)).toFixed(0)
      return { usageMb, quotaMb, supported: true }
    } catch {
      return { supported: false }
    }
  }
  return { supported: false }
}
