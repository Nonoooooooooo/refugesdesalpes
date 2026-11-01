/**
 * Service de stockage et d'export pour les traces GPS
 * Refuges des Alpes
 * 100% hors-ligne (IndexedDB + fallback localStorage)
 */

const DB_NAME = 'refuges_gps_tracks_db'
const DB_VERSION = 1
const STORE_TRACKS = 'tracks'
const STORE_DRAFT = 'draft'
const LOCAL_STORAGE_BACKUP_KEY = 'refuge2_saved_tracks_v1'
const LOCAL_STORAGE_DRAFT_KEY = 'refuge2_active_track_draft_v1'

let dbPromise = null

function getDB() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null)
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION)
        req.onupgradeneeded = (e) => {
          const db = e.target.result
          if (!db.objectStoreNames.contains(STORE_TRACKS)) {
            const store = db.createObjectStore(STORE_TRACKS, { keyPath: 'id' })
            store.createIndex('startTime', 'startTime', { unique: false })
          }
          if (!db.objectStoreNames.contains(STORE_DRAFT)) {
            db.createObjectStore(STORE_DRAFT, { keyPath: 'key' })
          }
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = (err) => {
          console.warn('[TrackStorage] IndexedDB non disponible, fallback localStorage:', err)
          resolve(null)
        }
      } catch (err) {
        console.warn('[TrackStorage] Exception IndexedDB:', err)
        resolve(null)
      }
    })
  }
  return dbPromise
}

// ==========================================
// 1. GESTION DES TRACES SAUVEGARDÉES
// ==========================================

export async function getAllTracks() {
  const db = await getDB()
  if (db) {
    try {
      return await new Promise((resolve) => {
        const tx = db.transaction(STORE_TRACKS, 'readonly')
        const store = tx.objectStore(STORE_TRACKS)
        const req = store.getAll()
        req.onsuccess = () => {
          const res = req.result || []
          // Tri par date de début décroissante (plus récente en premier)
          res.sort((a, b) => (b.startTime || 0) - (a.startTime || 0))
          resolve(res)
        }
        req.onerror = () => resolve(getLocalStorageTracks())
      })
    } catch {
      return getLocalStorageTracks()
    }
  }
  return getLocalStorageTracks()
}

export async function saveTrack(track) {
  if (!track || !track.id) return false
  const db = await getDB()
  if (db) {
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_TRACKS, 'readwrite')
        const store = tx.objectStore(STORE_TRACKS)
        const req = store.put(track)
        req.onsuccess = () => resolve()
        req.onerror = (e) => reject(e)
      })
    } catch (e) {
      console.warn('[TrackStorage] Erreur sauvegarde IndexedDB, fallback localStorage:', e)
    }
  }
  // Double sauvegarde miroir dans localStorage pour sécurité maximale
  saveLocalStorageTrack(track)
  return true
}

export async function deleteTrack(trackId) {
  if (!trackId) return false
  const db = await getDB()
  if (db) {
    try {
      await new Promise((resolve) => {
        const tx = db.transaction(STORE_TRACKS, 'readwrite')
        const store = tx.objectStore(STORE_TRACKS)
        const req = store.delete(trackId)
        req.onsuccess = () => resolve()
        req.onerror = () => resolve()
      })
    } catch (e) {
      console.warn('[TrackStorage] Erreur suppression IndexedDB:', e)
    }
  }
  deleteLocalStorageTrack(trackId)
  return true
}

export async function updateTrack(trackId, updates) {
  const all = await getAllTracks()
  const track = all.find((t) => t.id === trackId)
  if (!track) return false
  const updated = { ...track, ...updates, updatedAt: Date.now() }
  await saveTrack(updated)
  return updated
}

// Fallback localStorage
function getLocalStorageTracks() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BACKUP_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.sort((a, b) => (b.startTime || 0) - (a.startTime || 0))
      : []
  } catch {
    return []
  }
}

function saveLocalStorageTrack(track) {
  try {
    const tracks = getLocalStorageTracks()
    const idx = tracks.findIndex((t) => t.id === track.id)
    if (idx >= 0) {
      tracks[idx] = track
    } else {
      tracks.unshift(track)
    }
    localStorage.setItem(LOCAL_STORAGE_BACKUP_KEY, JSON.stringify(tracks))
  } catch (e) {
    console.warn('[TrackStorage] localStorage plein ou indisponible:', e)
  }
}

function deleteLocalStorageTrack(trackId) {
  try {
    const tracks = getLocalStorageTracks().filter((t) => t.id !== trackId)
    localStorage.setItem(LOCAL_STORAGE_BACKUP_KEY, JSON.stringify(tracks))
  } catch (e) {
    console.warn('[TrackStorage] localStorage delete error:', e)
  }
}

// ==========================================
// 2. GESTION DU BROUILLON D'ENREGISTREMENT ACTIF (CRASH-RESISTANT)
// ==========================================

export async function saveActiveDraft(draft) {
  if (!draft) return
  const db = await getDB()
  const record = { key: 'current_active_recording', ...draft, updatedAt: Date.now() }
  if (db) {
    try {
      const tx = db.transaction(STORE_DRAFT, 'readwrite')
      tx.objectStore(STORE_DRAFT).put(record)
    } catch {
      // Ignorer si échec
    }
  }
  try {
    localStorage.setItem(LOCAL_STORAGE_DRAFT_KEY, JSON.stringify(record))
  } catch {
    // LocalStorage overflow possible si points très nombreux, IndexedDB gère le gros volume
  }
}

export async function getActiveDraft() {
  const db = await getDB()
  if (db) {
    try {
      const draft = await new Promise((resolve) => {
        const tx = db.transaction(STORE_DRAFT, 'readonly')
        const req = tx.objectStore(STORE_DRAFT).get('current_active_recording')
        req.onsuccess = () => resolve(req.result || null)
        req.onerror = () => resolve(null)
      })
      if (draft && draft.points && draft.points.length > 0) return draft
    } catch {
      // fallback ci-dessous
    }
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function clearActiveDraft() {
  const db = await getDB()
  if (db) {
    try {
      const tx = db.transaction(STORE_DRAFT, 'readwrite')
      tx.objectStore(STORE_DRAFT).delete('current_active_recording')
    } catch {
      // Ignorer
    }
  }
  try {
    localStorage.removeItem(LOCAL_STORAGE_DRAFT_KEY)
  } catch {
    // Ignorer
  }
}

// ==========================================
// 3. EXPORT & TÉLÉCHARGEMENT GPX (STANDARD GPX 1.1)
// ==========================================

export function exportToGPX(track) {
  if (!track || !track.points || track.points.length === 0) return ''

  const safeName = (track.name || 'Trace Randonnée').replace(/[<>&"]/g, '')
  const startTimeISO = track.startTime
    ? new Date(track.startTime).toISOString()
    : new Date().toISOString()

  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Refuges des Alpes (PWA)" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${safeName}</name>
    <desc>Enregistré sur Refuges des Alpes - Distance: ${(track.distance / 1000).toFixed(2)} km, D+: ${Math.round(track.elevationGain || 0)} m, D-: ${Math.round(track.elevationLoss || 0)} m</desc>
    <time>${startTimeISO}</time>
  </metadata>
  <trk>
    <name>${safeName}</name>
    <type>Hiking</type>
    <trkseg>
`

  for (const pt of track.points) {
    const lat = pt.lat.toFixed(6)
    const lon = pt.lng.toFixed(6)
    gpx += `      <trkpt lat="${lat}" lon="${lon}">\n`
    if (pt.alt != null && !isNaN(pt.alt)) {
      gpx += `        <ele>${Number(pt.alt).toFixed(1)}</ele>\n`
    }
    if (pt.time) {
      gpx += `        <time>${new Date(pt.time).toISOString()}</time>\n`
    }
    gpx += `      </trkpt>\n`
  }

  gpx += `    </trkseg>
  </trk>
</gpx>`

  return gpx
}

export function downloadGPXFile(track) {
  const gpxContent = exportToGPX(track)
  if (!gpxContent) return false

  const blob = new Blob([gpxContent], { type: 'application/gpx+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const cleanName = (track.name || 'trace_gps')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
  a.href = url
  a.download = `${cleanName}.gpx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return true
}

// ==========================================
// 4. PARSER GPX (IMPORT DE FICHIERS GPX EXTERNES)
// ==========================================

export function parseGPX(xmlText, fileName = 'Trace importée') {
  try {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml')

    const parseError = xmlDoc.getElementsByTagName('parsererror')
    if (parseError.length > 0) {
      throw new Error('Fichier XML/GPX invalide ou corrompu.')
    }

    const trkptEls = xmlDoc.getElementsByTagName('trkpt')
    if (!trkptEls || trkptEls.length === 0) {
      // Peut être un rtept (route)
      const rteptEls = xmlDoc.getElementsByTagName('rtept')
      if (!rteptEls || rteptEls.length === 0) {
        throw new Error('Aucun point GPS trouvé dans ce fichier GPX.')
      }
    }

    const nameEl = xmlDoc.querySelector('trk > name') || xmlDoc.querySelector('metadata > name')
    const trackName = nameEl ? nameEl.textContent.trim() : fileName.replace(/\.[^/.]+$/, '')

    const elements = trkptEls.length > 0 ? trkptEls : xmlDoc.getElementsByTagName('rtept')
    const points = []
    let totalDist = 0
    let elevationGain = 0
    let elevationLoss = 0
    let minAlt = Infinity
    let maxAlt = -Infinity

    let prevPt = null
    let prevValidAlt = null

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i]
      const lat = parseFloat(el.getAttribute('lat'))
      const lon = parseFloat(el.getAttribute('lon'))
      if (isNaN(lat) || isNaN(lon)) continue

      const eleEl = el.getElementsByTagName('ele')[0]
      const alt = eleEl ? parseFloat(eleEl.textContent) : null

      const timeEl = el.getElementsByTagName('time')[0]
      const time = timeEl ? new Date(timeEl.textContent).getTime() : null

      if (alt != null && !isNaN(alt)) {
        if (alt < minAlt) minAlt = alt
        if (alt > maxAlt) maxAlt = alt
      }

      if (prevPt) {
        // Distance Haversine
        const d = haversineDistance(prevPt.lat, prevPt.lng, lat, lon)
        totalDist += d

        if (alt != null && prevValidAlt != null) {
          const dAlt = alt - prevValidAlt
          // Filtrage hysteresis léger pour éliminer le bruit altimétrique
          if (Math.abs(dAlt) >= 2) {
            if (dAlt > 0) elevationGain += dAlt
            else elevationLoss += Math.abs(dAlt)
            prevValidAlt = alt
          }
        } else if (alt != null) {
          prevValidAlt = alt
        }
      } else {
        if (alt != null) prevValidAlt = alt
      }

      const point = {
        lat,
        lng: lon,
        alt: alt != null && !isNaN(alt) ? Math.round(alt) : null,
        time: time || Date.now() + i * 1000,
        cumDist: Math.round(totalDist),
      }
      points.push(point)
      prevPt = point
    }

    if (points.length < 2) {
      throw new Error('Le fichier GPX contient moins de 2 points valides.')
    }

    const startTime = points[0].time || Date.now()
    const endTime = points[points.length - 1].time || startTime + 3600000
    const duration = Math.max(1, Math.round((endTime - startTime) / 1000))

    return {
      id: `imported_gpx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: trackName,
      startTime,
      endTime,
      duration,
      distance: Math.round(totalDist),
      elevationGain: Math.round(elevationGain),
      elevationLoss: Math.round(elevationLoss),
      maxAltitude: maxAlt !== -Infinity ? Math.round(maxAlt) : null,
      minAltitude: minAlt !== Infinity ? Math.round(minAlt) : null,
      points,
      isImported: true,
      createdAt: Date.now(),
    }
  } catch (err) {
    console.error('[TrackStorage] Erreur parsing GPX:', err)
    throw err
  }
}

// Distance en mètres entre 2 coordonnées WGS84
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000 // Rayon Terre en mètres
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
