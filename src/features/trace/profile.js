import { fetchElevations } from './altimetrieService'

const EARTH_RADIUS_M = 6371008.8
const M_PER_DEG_LAT = 111320
const SAMPLE_STEP_M = 20
// 5 coordonnées par échantillon : jusqu'à 900 échantillons tiennent dans une seule requête (4 500 < 5 000 points)
const MAX_SAMPLES = 900
// Pente mesurée sur une base de 2 × 10 m autour de chaque échantillon
const SLOPE_HALF_BASE_M = 10
// Seuil anti-bruit pour le cumul du dénivelé
const ELEVATION_HYSTERESIS_M = 3

// Classes de pente usuelles en prévention avalanche (du plus raide au moins raide)
export const SLOPE_CLASSES = [
  { key: 'p45', min: 45, color: '#c026d3', label: '≥ 45°' },
  { key: 'p40', min: 40, color: '#dc2626', label: '40–45°' },
  { key: 'p35', min: 35, color: '#f97316', label: '35–40°' },
  { key: 'p30', min: 30, color: '#facc15', label: '30–35°' },
  { key: 'p0', min: 0, color: '#f8fafc', label: '< 30°' },
]

const ASPECTS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']

export function slopeClass(slope) {
  if (slope == null) return null
  return SLOPE_CLASSES.find((c) => slope >= c.min)
}

export function aspectLabel(deg) {
  if (deg == null) return ''
  return ASPECTS[Math.round(deg / 45) % 8]
}

function distanceM(a, b) {
  const toRad = Math.PI / 180
  const dLat = (b.lat - a.lat) * toRad
  const dLng = (b.lng - a.lng) * toRad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

/**
 * Échantillonne le tracé tous les `step` mètres. Chaque segment est découpé à partir de son propre départ :
 * déplacer un point ne change que les deux segments voisins, le reste reste en cache.
 */
function densify(points, step) {
  const samples = [{ lat: points[0].lat, lng: points[0].lng, dist: 0 }]
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const len = distanceM(a, b)
    const n = Math.max(1, Math.round(len / step))
    for (let k = 1; k <= n; k++) {
      const t = k / n
      samples.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t, dist: total + len * t })
    }
    total += len
  }
  return samples
}

// Centre puis voisins Est, Ouest, Nord, Sud, au format [lng, lat]
function stencil({ lat, lng }) {
  const dLat = SLOPE_HALF_BASE_M / M_PER_DEG_LAT
  const dLng = SLOPE_HALF_BASE_M / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180))
  return [
    [lng, lat],
    [lng + dLng, lat],
    [lng - dLng, lat],
    [lng, lat + dLat],
    [lng, lat - dLat],
  ]
}

/**
 * Profil altimétrique d'un tracé, avec pour chaque échantillon la pente du terrain (ligne de plus grande pente,
 * pas la pente le long du tracé) et son orientation, comme pour la lecture d'un bulletin d'avalanche.
 */
export async function computeTraceProfile(points, signal) {
  let length = 0
  for (let i = 1; i < points.length; i++) length += distanceM(points[i - 1], points[i])
  // Pas multiple de 20 m pour que le cache reste valable quand le tracé s'allonge un peu
  const step = SAMPLE_STEP_M * Math.max(1, Math.ceil(length / (MAX_SAMPLES * SAMPLE_STEP_M)))
  const samples = densify(points, step)
  const elevations = await fetchElevations(samples.flatMap(stencil), signal)

  samples.forEach((s, i) => {
    const [c, e, w, n, so] = elevations.slice(i * 5, i * 5 + 5)
    s.z = c
    s.slope = null
    s.aspect = null
    if (e != null && w != null && n != null && so != null) {
      const dzdx = (e - w) / (2 * SLOPE_HALF_BASE_M)
      const dzdy = (n - so) / (2 * SLOPE_HALF_BASE_M)
      s.slope = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI
      // Orientation = direction vers laquelle le versant descend, en degrés depuis le nord
      s.aspect = ((Math.atan2(-dzdx, -dzdy) * 180) / Math.PI + 360) % 360
    }
  })

  return { points, samples, step, stats: computeStats(samples, length) }
}

function computeStats(samples, length) {
  let gain = 0
  let loss = 0
  let ref = null
  let minZ = Infinity
  let maxZ = -Infinity
  let steepest = null
  let lengthAbove30 = 0
  let missing = 0

  samples.forEach((s, i) => {
    if (s.z == null) {
      missing++
    } else {
      minZ = Math.min(minZ, s.z)
      maxZ = Math.max(maxZ, s.z)
      if (ref == null) ref = s.z
      const diff = s.z - ref
      if (diff >= ELEVATION_HYSTERESIS_M) {
        gain += diff
        ref = s.z
      } else if (diff <= -ELEVATION_HYSTERESIS_M) {
        loss -= diff
        ref = s.z
      }
    }
    if (s.slope != null) {
      if (!steepest || s.slope > steepest.slope) steepest = s
      const next = samples[i + 1]
      if (s.slope >= 30 && next) lengthAbove30 += next.dist - s.dist
    }
  })

  return {
    length,
    gain,
    loss,
    minZ: missing === samples.length ? null : minZ,
    maxZ: missing === samples.length ? null : maxZ,
    steepest,
    lengthAbove30,
    missing,
  }
}
