import { useState, useEffect, useRef, useCallback } from 'react'
import {
  saveTrack,
  saveActiveDraft,
  getActiveDraft,
  clearActiveDraft,
  haversineDistance,
} from './trackStorage'

// Seuil d'hystérésis en mètres pour le cumul D+ / D- (évite le bruit altimétrique GPS à l'arrêt)
const ELEVATION_HYSTERESIS_METERS = 3.0
// Distance minimale en mètres entre deux points successifs (évite le sautillement GPS stationnaire)
const MIN_DISTANCE_DELTA_METERS = 3.5
// Précision maximale tolérée pour enregistrer un point (35m)
const MAX_ACCURACY_THRESHOLD = 35.0

export function useTrackRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [points, setPoints] = useState([])
  const [currentLocation, setCurrentLocation] = useState(null)
  const [stats, setStats] = useState({
    distance: 0, // mètres
    elevationGain: 0, // D+ mètres
    elevationLoss: 0, // D- mètres
    currentAltitude: null,
    minAltitude: null,
    maxAltitude: null,
    duration: 0, // secondes actives
    currentSpeed: 0, // km/h
    avgSpeed: 0, // km/h
  })

  // Mode Fil d'Ariane / Retour sur ses pas
  const [isBacktrackMode, setIsBacktrackMode] = useState(false)

  // Brouillon disponible détecté au démarrage
  const [hasRecoverableDraft, setHasRecoverableDraft] = useState(false)
  const [recoverableDraftData, setRecoverableDraftData] = useState(null)

  // Références mutables
  const watchIdRef = useRef(null)
  const wakeLockRef = useRef(null)
  const timerIntervalRef = useRef(null)
  const lastValidAltRef = useRef(null)
  const pointsRef = useRef([])
  const statsRef = useRef(stats)
  const startTimeRef = useRef(null)
  const pausedTimeAccumulatedRef = useRef(0)
  const lastPauseStartRef = useRef(null)

  // Garder les refs synchronisées avec l'état
  useEffect(() => {
    pointsRef.current = points
    statsRef.current = stats
  }, [points, stats])

  // Gestion du Screen Wake Lock pour garder l'écran allumé sous la neige/gants
  const requestWakeLock = useCallback(async () => {
    if (typeof window !== 'undefined' && 'wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      } catch (err) {
        console.debug('[WakeLock] Non disponible ou refusé:', err)
      }
    }
  }, [])

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      try {
        wakeLockRef.current.release()
      } catch {
        // ignore
      }
      wakeLockRef.current = null
    }
  }, [])

  // Chronomètre de durée active
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerIntervalRef.current = setInterval(() => {
        setStats((prev) => {
          const newDuration = prev.duration + 1
          const avgSpeed =
            newDuration > 5 && prev.distance > 0
              ? (prev.distance / 1000 / (newDuration / 3600)).toFixed(1)
              : 0
          return {
            ...prev,
            duration: newDuration,
            avgSpeed: Number(avgSpeed),
          }
        })
      }, 1000)
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }, [isRecording, isPaused])

  // Détection d'un brouillon existant au montage
  useEffect(() => {
    getActiveDraft().then((draft) => {
      if (draft && draft.points && draft.points.length > 1) {
        setHasRecoverableDraft(true)
        setRecoverableDraftData(draft)
      }
    })
  }, [])

  // Sauvegarde automatique du brouillon à chaque nouveau point
  useEffect(() => {
    if (isRecording && points.length > 0) {
      saveActiveDraft({
        startTime: startTimeRef.current || Date.now(),
        points,
        stats,
        isPaused,
        lastUpdated: Date.now(),
      })
    }
  }, [points, isRecording, isPaused, stats])

  // Calcul du Fil d'Ariane / Retour sur ses pas
  const backtrackGuidance = useMemo(() => {
    if (!isBacktrackMode || points.length === 0 || !currentLocation) {
      return null
    }

    // Trouver le point du tracé le plus proche de la position actuelle
    let minDist = Infinity
    let closestIndex = 0

    for (let i = 0; i < points.length; i++) {
      const d = haversineDistance(
        currentLocation.lat,
        currentLocation.lng,
        points[i].lat,
        points[i].lng,
      )
      if (d < minDist) {
        minDist = d
        closestIndex = i
      }
    }

    // Distance restante en suivant les points en sens inverse jusqu'au point de départ (index 0)
    let remainingTrackDist = minDist
    for (let i = closestIndex; i > 0; i--) {
      remainingTrackDist += haversineDistance(
        points[i].lat,
        points[i].lng,
        points[i - 1].lat,
        points[i - 1].lng,
      )
    }

    // Cap / relèvement vers le point précédent pour guider dans le brouillard
    const targetPoint = closestIndex > 0 ? points[closestIndex - 1] : points[0]
    const bearing = calculateBearing(
      currentLocation.lat,
      currentLocation.lng,
      targetPoint.lat,
      targetPoint.lng,
    )

    return {
      closestIndex,
      distanceToTrack: Math.round(minDist),
      remainingDistToStart: Math.round(remainingTrackDist),
      startPoint: points[0],
      nextWayPoint: targetPoint,
      bearingToNext: Math.round(bearing),
    }
  }, [isBacktrackMode, points, currentLocation])

  // Traitement d'un point GPS entrant
  const handlePositionUpdate = useCallback(
    (pos) => {
      const { latitude, longitude, altitude, accuracy, speed, heading } = pos.coords
      const now = pos.timestamp || Date.now()

      const loc = {
        lat: latitude,
        lng: longitude,
        alt: altitude != null && !isNaN(altitude) ? Math.round(altitude) : null,
        accuracy: accuracy || 10,
        speed: speed != null && !isNaN(speed) && speed >= 0 ? Number((speed * 3.6).toFixed(1)) : 0,
        heading: heading != null && !isNaN(heading) && heading >= 0 ? Math.round(heading) : null,
        time: now,
      }

      setCurrentLocation(loc)

      // Si pas en enregistrement actif ou en pause, on ne stocke pas le tracé
      if (!isRecording || isPaused) {
        return
      }

      // Filtrer les points avec mauvaise précision GPS
      if (accuracy > MAX_ACCURACY_THRESHOLD && pointsRef.current.length > 0) {
        return
      }

      const prevPoints = pointsRef.current
      const prevPoint = prevPoints.length > 0 ? prevPoints[prevPoints.length - 1] : null

      let deltaDist = 0
      if (prevPoint) {
        deltaDist = haversineDistance(prevPoint.lat, prevPoint.lng, latitude, longitude)
        // Ignorer si déplacement insignifiant (bruit de stationnement)
        if (deltaDist < MIN_DISTANCE_DELTA_METERS) {
          return
        }
      }

      // Mise à jour de l'altitude et des dénivelés cumulés D+ et D-
      let dPlus = 0
      let dMinus = 0
      const currentAlt = loc.alt

      if (currentAlt != null) {
        if (lastValidAltRef.current != null) {
          const deltaAlt = currentAlt - lastValidAltRef.current
          if (Math.abs(deltaAlt) >= ELEVATION_HYSTERESIS_METERS) {
            if (deltaAlt > 0) {
              dPlus = deltaAlt
            } else {
              dMinus = Math.abs(deltaAlt)
            }
            lastValidAltRef.current = currentAlt
          }
        } else {
          lastValidAltRef.current = currentAlt
        }
      }

      const totalDist = (statsRef.current.distance || 0) + deltaDist
      const newDPlus = (statsRef.current.elevationGain || 0) + dPlus
      const newDMinus = (statsRef.current.elevationLoss || 0) + dMinus

      const pointRecord = {
        lat: latitude,
        lng: longitude,
        alt: currentAlt,
        time: now,
        cumDist: Math.round(totalDist),
        accuracy: Math.round(loc.accuracy),
      }

      setPoints((prev) => [...prev, pointRecord])

      setStats((prev) => {
        const nextMin =
          currentAlt != null
            ? prev.minAltitude == null
              ? currentAlt
              : Math.min(prev.minAltitude, currentAlt)
            : prev.minAltitude
        const nextMax =
          currentAlt != null
            ? prev.maxAltitude == null
              ? currentAlt
              : Math.max(prev.maxAltitude, currentAlt)
            : prev.maxAltitude

        return {
          ...prev,
          distance: Math.round(totalDist),
          elevationGain: Math.round(newDPlus),
          elevationLoss: Math.round(newDMinus),
          currentAltitude: currentAlt ?? prev.currentAltitude,
          minAltitude: nextMin,
          maxAltitude: nextMax,
          currentSpeed: loc.speed,
        }
      })
    },
    [isRecording, isPaused],
  )

  // Démarrer l'enregistrement
  const startRecording = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée sur cet appareil.")
      return
    }

    try {
      if (navigator.vibrate) navigator.vibrate([40, 60, 40])
    } catch {
      // ignore
    }

    requestWakeLock()
    startTimeRef.current = Date.now()
    lastValidAltRef.current = null
    pausedTimeAccumulatedRef.current = 0
    setIsRecording(true)
    setIsPaused(false)
    setIsBacktrackMode(false)

    // Si on commence de zéro
    if (pointsRef.current.length === 0) {
      setStats({
        distance: 0,
        elevationGain: 0,
        elevationLoss: 0,
        currentAltitude: null,
        minAltitude: null,
        maxAltitude: null,
        duration: 0,
        currentSpeed: 0,
        avgSpeed: 0,
      })
    }

    const options = {
      enableHighAccuracy: true,
      maximumAge: 1500,
      timeout: 12000,
    }

    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      (err) => console.warn('[TrackRecorder] GPS error:', err),
      options,
    )
  }, [handlePositionUpdate, requestWakeLock])

  // Mettre en pause l'enregistrement
  const pauseRecording = useCallback(() => {
    setIsPaused(true)
    lastPauseStartRef.current = Date.now()
    try {
      if (navigator.vibrate) navigator.vibrate(50)
    } catch {
      // ignore
    }
  }, [])

  // Reprendre l'enregistrement
  const resumeRecording = useCallback(() => {
    setIsPaused(false)
    if (lastPauseStartRef.current) {
      pausedTimeAccumulatedRef.current += Date.now() - lastPauseStartRef.current
      lastPauseStartRef.current = null
    }
    try {
      if (navigator.vibrate) navigator.vibrate([30, 30])
    } catch {
      // ignore
    }
  }, [])

  // Arrêter et sauvegarder la trace
  const stopAndSaveRecording = useCallback(
    async (customName = null) => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      releaseWakeLock()

      const currentPoints = pointsRef.current
      const currentStats = statsRef.current

      if (currentPoints.length < 2) {
        // Pas assez de points pour une trace valable
        setIsRecording(false)
        setIsPaused(false)
        setPoints([])
        await clearActiveDraft()
        return null
      }

      const defaultDateStr = new Date(startTimeRef.current || Date.now()).toLocaleDateString(
        'fr-FR',
        {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        },
      )
      const trackName =
        customName && customName.trim() ? customName.trim() : `Randonnée du ${defaultDateStr}`

      const newTrack = {
        id: `track_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: trackName,
        startTime: startTimeRef.current || Date.now(),
        endTime: Date.now(),
        duration: currentStats.duration,
        distance: currentStats.distance,
        elevationGain: currentStats.elevationGain,
        elevationLoss: currentStats.elevationLoss,
        maxAltitude: currentStats.maxAltitude,
        minAltitude: currentStats.minAltitude,
        avgSpeed: currentStats.avgSpeed,
        points: currentPoints,
        createdAt: Date.now(),
      }

      await saveTrack(newTrack)
      await clearActiveDraft()

      try {
        if (navigator.vibrate) navigator.vibrate([100, 50, 100])
      } catch {
        // ignore
      }

      setIsRecording(false)
      setIsPaused(false)
      setIsBacktrackMode(false)
      setPoints([])
      setStats({
        distance: 0,
        elevationGain: 0,
        elevationLoss: 0,
        currentAltitude: null,
        minAltitude: null,
        maxAltitude: null,
        duration: 0,
        currentSpeed: 0,
        avgSpeed: 0,
      })

      return newTrack
    },
    [releaseWakeLock],
  )

  // Abandonner l'enregistrement en cours
  const discardRecording = useCallback(async () => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    releaseWakeLock()
    await clearActiveDraft()

    setIsRecording(false)
    setIsPaused(false)
    setIsBacktrackMode(false)
    setPoints([])
    setStats({
      distance: 0,
      elevationGain: 0,
      elevationLoss: 0,
      currentAltitude: null,
      minAltitude: null,
      maxAltitude: null,
      duration: 0,
      currentSpeed: 0,
      avgSpeed: 0,
    })
  }, [releaseWakeLock])

  // Reprendre un brouillon restauré suite à un rechargement de page
  const resumeDraft = useCallback(() => {
    if (!recoverableDraftData) return
    setPoints(recoverableDraftData.points || [])
    if (recoverableDraftData.stats) {
      setStats(recoverableDraftData.stats)
    }
    startTimeRef.current = recoverableDraftData.startTime || Date.now()
    setHasRecoverableDraft(false)
    setRecoverableDraftData(null)
    startRecording()
  }, [recoverableDraftData, startRecording])

  const discardDraft = useCallback(async () => {
    await clearActiveDraft()
    setHasRecoverableDraft(false)
    setRecoverableDraftData(null)
  }, [])

  // Basculer le mode Fil d'Ariane
  const toggleBacktrackMode = useCallback(() => {
    setIsBacktrackMode((prev) => !prev)
    try {
      if (navigator.vibrate) navigator.vibrate(40)
    } catch {
      // ignore
    }
  }, [])

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      releaseWakeLock()
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }, [releaseWakeLock])

  return {
    isRecording,
    isPaused,
    points,
    currentLocation,
    stats,
    isBacktrackMode,
    backtrackGuidance,
    hasRecoverableDraft,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopAndSaveRecording,
    discardRecording,
    toggleBacktrackMode,
    resumeDraft,
    discardDraft,
  }
}

// Calcul de gisement / cap (azimuth en degrés 0-360) entre 2 points
function calculateBearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180)
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180)
  const deg = (Math.atan2(y, x) * 180) / Math.PI
  return (deg + 360) % 360
}
