import { useState, useEffect, useRef, useMemo } from 'react'
import { useMap, useMapEvents, Marker, Circle } from 'react-leaflet'
import L from 'leaflet'
import {
  Plus,
  Minus,
  LocateFixed,
  Navigation,
  Loader2,
  Mountain,
  AlertCircle,
  X,
} from 'lucide-react'

export default function MapControls({ hasSelected = false }) {
  const map = useMap()
  const [trackingState, setTrackingState] = useState('idle') // 'idle' | 'searching' | 'active'
  const [userLocation, setUserLocation] = useState(null)
  const [followUser, setFollowUser] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)
  const watchIdRef = useRef(null)

  // Détection du déplacement manuel de la carte : on désactive le centrage forcé
  useMapEvents({
    dragstart: () => {
      if (trackingState === 'active') {
        setFollowUser(false)
      }
    },
  })

  // Démarrer le suivi GPS Satellite
  const startTracking = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setErrorMsg("La géolocalisation n'est pas supportée sur cet appareil.")
      return
    }

    setErrorMsg(null)
    setTrackingState('searching')
    setFollowUser(true)

    // Haute précision indispensable en montagne pour activer la vraie puce satellite GPS (sans réseau cellulaire)
    const options = {
      enableHighAccuracy: true,
      maximumAge: 2500,
      timeout: 15000,
    }

    const successHandler = (pos) => {
      const { latitude, longitude, altitude, accuracy, heading, speed } = pos.coords
      const loc = {
        lat: latitude,
        lng: longitude,
        altitude,
        accuracy: Math.max(accuracy || 5, 3),
        heading,
        speed,
        timestamp: pos.timestamp,
      }

      setUserLocation(loc)
      setTrackingState('active')

      if (followUser) {
        map.flyTo([latitude, longitude], Math.max(map.getZoom(), 14), { duration: 0.6 })
      }
    }

    const errorHandler = (err) => {
      console.warn('[GPS] Erreur localisation:', err)
      if (err.code === 1) {
        // PERMISSION_DENIED
        setErrorMsg('Accès GPS refusé : veuillez autoriser la localisation dans les réglages de votre navigateur.')
        stopTracking()
      } else if (err.code === 3) {
        // TIMEOUT
        setErrorMsg('Recherche des satellites GPS en cours... (assurez-vous d’être à ciel ouvert)')
      } else {
        setErrorMsg('Signal GPS temporairement indisponible.')
      }
    }

    // 1. Position initiale immédiate
    navigator.geolocation.getCurrentPosition(successHandler, errorHandler, options)

    // 2. Écoute continue en temps réel pour suivre la marche du randonneur
    try {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      watchIdRef.current = navigator.geolocation.watchPosition(
        successHandler,
        errorHandler,
        options,
      )
    } catch (e) {
      console.warn('[GPS] watchPosition failed:', e)
    }
  }

  // Arrêter le suivi GPS
  const stopTracking = () => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setTrackingState('idle')
    setUserLocation(null)
    setFollowUser(false)
  }

  // Gestion du clic sur le bouton de géolocalisation
  const handleToggleLocate = () => {
    if (trackingState === 'idle') {
      startTracking()
    } else if (trackingState === 'searching') {
      stopTracking()
    } else if (trackingState === 'active') {
      if (!followUser && userLocation) {
        // Si l'utilisateur avait navigué sur la carte, on le recentre
        setFollowUser(true)
        map.flyTo([userLocation.lat, userLocation.lng], Math.max(map.getZoom(), 15), {
          duration: 0.6,
        })
      } else {
        // Si déjà centré, un nouveau clic coupe le GPS pour économiser la batterie
        stopTracking()
      }
    }
  }

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  // Création du marqueur visuel avec faisceau d'orientation et pulsation radar
  const userMarkerIcon = useMemo(() => {
    const heading = userLocation?.heading
    const hasHeading = heading != null && !isNaN(heading) && heading >= 0
    const headingStyle = hasHeading
      ? `transform: rotate(${heading}deg);`
      : 'display: none;'

    return L.divIcon({
      className: 'user-location-marker',
      html: `
        <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
          <!-- Faisceau de direction de marche -->
          <div style="position: absolute; top: -14px; left: 5px; width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-bottom: 16px solid rgba(37, 99, 235, 0.8); transform-origin: 7px 26px; ${headingStyle}"></div>
          <!-- Onde radar animée -->
          <div class="radar-pulse" style="position: absolute; width: 42px; height: 42px; border-radius: 50%; background: rgba(59, 130, 246, 0.35);"></div>
          <!-- Point central bleu électrique et anneau blanc -->
          <div style="position: relative; width: 18px; height: 18px; border-radius: 50%; background: #2563eb; border: 3px solid #ffffff; box-shadow: 0 2px 10px rgba(0,0,0,0.5); z-index: 2;"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    })
  }, [userLocation?.heading])

  const btn = 'glass-btn flex h-10 w-10 items-center justify-center'

  return (
    <>
      {/* ─── ÉLÉMENTS CARTE : Marqueur position & Cercle de précision ─── */}
      {userLocation && (
        <>
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={userLocation.accuracy}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.12,
              weight: 1.5,
              dashArray: '4 4',
            }}
          />
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={userMarkerIcon}
            zIndexOffset={1000}
          />
        </>
      )}

      {/* ─── HUD FLOTTANT GPS MONTAGNE (Altitude + Précision en temps réel) ─── */}
      {userLocation && (
        <div
          className={`pointer-events-auto absolute bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px)+var(--trace-band-h,0px))] sm:bottom-20 z-[1000] transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
            hasSelected ? 'left-3 sm:left-[444px]' : 'left-3 sm:left-4'
          }`}
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <div className="glass flex items-center gap-2.5 rounded-2xl border border-blue-400/35 bg-slate-950/85 px-3 py-1.5 text-xs shadow-2xl backdrop-blur-xl">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>

            <div className="flex items-center gap-2 font-medium">
              {userLocation.altitude != null && (
                <span className="font-semibold text-white flex items-center gap-1">
                  <Mountain size={13} className="text-amber-400" />
                  {Math.round(userLocation.altitude)} m
                </span>
              )}
              {userLocation.accuracy != null && (
                <span className="text-[11px] text-slate-400">
                  ±{Math.round(userLocation.accuracy)}m
                </span>
              )}
            </div>

            {!followUser && (
              <button
                onClick={() => {
                  setFollowUser(true)
                  map.flyTo([userLocation.lat, userLocation.lng], Math.max(map.getZoom(), 15), {
                    duration: 0.6,
                  })
                }}
                className="ml-1 rounded-lg bg-blue-500/25 px-2 py-0.5 text-[10px] font-semibold text-blue-300 hover:bg-blue-500/40 transition"
              >
                Recentrer
              </button>
            )}

            <button
              onClick={stopTracking}
              className="text-slate-500 hover:text-slate-300 transition p-0.5 ml-0.5"
              title="Arrêter le suivi GPS"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ─── MESSAGE D'AVERTISSEMENT OU D'AIDE GPS ─── */}
      {errorMsg && (
        <div
          className={`pointer-events-auto absolute bottom-[calc(7.75rem+env(safe-area-inset-bottom,0px)+var(--trace-band-h,0px))] sm:bottom-28 z-[1000] max-w-xs transition-all duration-300 animate-in fade-in duration-200 ${
            hasSelected ? 'left-3 sm:left-[444px]' : 'left-3 sm:left-4'
          }`}
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <div className="glass flex items-start gap-2 rounded-2xl border border-amber-400/40 bg-black/90 p-2.5 text-xs text-amber-200 shadow-2xl">
            <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-[11px] leading-tight">{errorMsg}</div>
            <button onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-white">
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ─── CONTRÔLES DROITE : Zoom & Bouton GPS Haute Précision ─── */}
      <div
        className="absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px)+var(--trace-band-h,0px))] sm:bottom-8 right-3 sm:right-4 z-[1000] flex flex-col gap-2 transition-[bottom] duration-200"
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div className="glass flex flex-col overflow-hidden rounded-2xl">
          <button aria-label="Zoom avant" className={btn} onClick={() => map.zoomIn()}>
            <Plus size={18} />
          </button>
          <div className="h-px bg-white/15" />
          <button aria-label="Zoom arrière" className={btn} onClick={() => map.zoomOut()}>
            <Minus size={18} />
          </button>
        </div>

        {/* Bouton GPS Haute Précision Satellite */}
        <button
          aria-label={
            trackingState === 'active'
              ? followUser
                ? 'Suivi GPS actif (cliquer pour arrêter)'
                : 'Recentrer sur ma position GPS'
              : 'Activer la localisation GPS satellite'
          }
          title={
            trackingState === 'active'
              ? followUser
                ? 'Suivi GPS actif (cliquer pour arrêter)'
                : 'Recentrer sur ma position GPS'
              : 'Activer la localisation GPS satellite (100% hors-ligne)'
          }
          className={`${btn} glass rounded-2xl relative transition-all ${
            trackingState === 'active'
              ? 'border-blue-400/80 bg-blue-500/25 text-blue-300 ring-2 ring-blue-400/50 shadow-lg shadow-blue-500/20'
              : trackingState === 'searching'
                ? 'border-amber-400/60 bg-amber-500/20 text-amber-300'
                : 'text-slate-300 hover:text-white'
          }`}
          onClick={handleToggleLocate}
        >
          {trackingState === 'searching' ? (
            <Loader2 size={18} className="animate-spin text-amber-400" />
          ) : trackingState === 'active' ? (
            followUser ? (
              <Navigation size={18} className="text-blue-400 fill-blue-400" />
            ) : (
              <LocateFixed size={18} className="text-blue-400" />
            )
          ) : (
            <LocateFixed size={18} />
          )}

          {trackingState === 'active' && followUser && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
            </span>
          )}
        </button>
      </div>
    </>
  )
}
