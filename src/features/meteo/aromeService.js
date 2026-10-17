// Service client pour Météo-France AROME-PI (Prévision Immédiate haute résolution)

export const AROME_LAYERS = [
  {
    id: 'TOTAL_PRECIPITATION_RATE__GROUND_OR_WATER_SURFACE',
    label: 'Précipitations (Pluie)',
    shortLabel: 'Pluie',
    unit: 'mm/h',
    icon: '🌧️',
    color: '#38bdf8',
    description: 'Intensité des précipitations en temps réel et prévision à court terme (AROME 0.01°)',
  },
  {
    id: 'TOTAL_SNOW_PRECIPITATION__GROUND_OR_WATER_SURFACE',
    label: 'Chutes de neige',
    shortLabel: 'Neige',
    unit: 'kg/m²',
    icon: '❄️',
    color: '#93c5fd',
    description: 'Quantité de précipitations sous forme de neige cumulée',
  },
  {
    id: 'REFLECTIVITY_MAX_DBZ__GROUND_OR_WATER_SURFACE',
    label: 'Réflectivité Radar',
    shortLabel: 'Radar dBZ',
    unit: 'dBZ',
    icon: '⚡',
    color: '#f59e0b',
    description: 'Écho radar composite max : détection des cellules orageuses et grains',
  },
  {
    id: 'WIND_SPEED_GUST_15MIN__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND',
    label: 'Rafales de vent',
    shortLabel: 'Vent',
    unit: 'm/s',
    icon: '💨',
    color: '#c084fc',
    description: 'Rafales de vent maximales sur 15 minutes en altitude',
  },
  {
    id: 'TEMPERATURE__GROUND_OR_WATER_SURFACE',
    label: 'Température au sol',
    shortLabel: 'Température',
    unit: '°C',
    icon: '🌡️',
    color: '#f43f5e',
    description: 'Température au niveau du sol calculée par le modèle AROME',
  },
]

let cachedCapabilities = null
let cachedCapTime = 0
const CLIENT_CAP_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Récupère les métadonnées et échéances disponibles pour AROME-PI
 */
export async function fetchAromeCapabilities(signal) {
  const now = Date.now()
  if (cachedCapabilities && now - cachedCapTime < CLIENT_CAP_TTL) {
    return cachedCapabilities
  }

  try {
    const res = await fetch('/api/arome?action=capabilities', { signal })
    if (!res.ok) {
      throw new Error(`Erreur serveur AROME (${res.status})`)
    }
    const data = await res.json()
    cachedCapabilities = data
    cachedCapTime = now
    return data
  } catch (err) {
    if (signal?.aborted) throw err
    console.warn('Erreur chargement capacités AROME:', err)
    // Fallback avec timeline synthétique relative à l'heure actuelle
    return generateFallbackCapabilities()
  }
}

/**
 * Génère une timeline de secours si l'API est temporairement en mise à jour
 */
function generateFallbackCapabilities() {
  const now = new Date()
  const baseMinutes = Math.floor(now.getMinutes() / 15) * 15
  now.setMinutes(baseMinutes, 0, 0)

  const times = []
  // De -45min à +3h par pas de 15 min
  for (let step = -3; step <= 12; step++) {
    const t = new Date(now.getTime() + step * 15 * 60 * 1000)
    times.push(t.toISOString().replace(/\.\d{3}Z$/, 'Z'))
  }

  return {
    layers: AROME_LAYERS,
    times,
    isFallback: true,
  }
}

/**
 * Construit l'URL GetMap pour une couche, bbox et échéance données
 */
export function buildAromeMapUrl({ layer, bbox, width = 512, height = 512, time, crs = 'EPSG:4326' }) {
  const params = new URLSearchParams({
    layers: layer,
    bbox: Array.isArray(bbox) ? bbox.join(',') : bbox,
    width: String(Math.round(width)),
    height: String(Math.round(height)),
    crs,
  })

  if (time) {
    params.set('time', time)
  }

  return `/api/arome?${params.toString()}`
}

/**
 * Formate un timestamp ISO pour affichage utilisateur convivial
 * Ex: "11:30 (En direct)", "+30 min (12:00)", "-30 min (11:00)"
 */
export function formatAromeTime(isoString) {
  if (!isoString) return ''
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffMinutes = Math.round((date.getTime() - now.getTime()) / (60 * 1000))

    const timeStr = date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })

    if (Math.abs(diffMinutes) <= 8) {
      return {
        label: `${timeStr} (En direct)`,
        timeStr,
        isLive: true,
        isForecast: false,
        diffMinutes,
      }
    }

    if (diffMinutes > 0) {
      const hours = Math.floor(diffMinutes / 60)
      const mins = diffMinutes % 60
      let offsetStr = ''
      if (hours > 0 && mins === 0) offsetStr = `+${hours}h`
      else if (hours > 0) offsetStr = `+${hours}h${mins > 9 ? mins : '0' + mins}`
      else offsetStr = `+${mins} min`

      return {
        label: `${offsetStr} (${timeStr})`,
        timeStr,
        offsetStr,
        isLive: false,
        isForecast: true,
        diffMinutes,
      }
    }

    const pastMins = Math.abs(diffMinutes)
    return {
      label: `-${pastMins} min (${timeStr})`,
      timeStr,
      offsetStr: `-${pastMins} min`,
      isLive: false,
      isForecast: false,
      diffMinutes,
    }
  } catch {
    return { label: isoString, timeStr: isoString, isLive: false, isForecast: false, diffMinutes: 0 }
  }
}

/**
 * Précharge une image dans le cache du navigateur pour une transition instantanée
 */
const preloadedUrls = new Set()
export function preloadAromeImage(url) {
  if (!url || preloadedUrls.has(url)) return Promise.resolve()
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      preloadedUrls.add(url)
      resolve()
    }
    img.onerror = () => resolve()
    img.src = url
  })
}
