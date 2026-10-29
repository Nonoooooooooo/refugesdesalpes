import { useState, useEffect, useRef, useCallback } from 'react'
import { LayerGroup, Marker, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { renderToStaticMarkup } from 'react-dom/server'
import { Camera } from 'lucide-react'

const MIN_ZOOM = 10
let cachedWebcamIcon = null

function getWebcamIcon() {
  if (!cachedWebcamIcon) {
    cachedWebcamIcon = L.divIcon({
      className: 'webcam-marker',
      html: renderToStaticMarkup(
        <div className="webcam-pin" title="Webcam">
          <Camera size={14} strokeWidth={2.2} />
        </div>,
      ),
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -13],
    })
  }
  return cachedWebcamIcon
}

export default function WebcamLayer({ active: propActive }) {
  const map = useMap()
  const [webcams, setWebcams] = useState([])
  const [isActive, setIsActive] = useState(() => Boolean(propActive))
  const isActiveRef = useRef(Boolean(propActive))
  const layerGroupRef = useRef(null)
  const abortRef = useRef(null)

  // Synchronisation si le statut actif est passé en prop
  useEffect(() => {
    if (propActive !== undefined) {
      setIsActive(propActive)
      isActiveRef.current = propActive
    }
  }, [propActive])

  // Vérifie si le calque est actuellement actif sur la carte
  const isLayerActive = useCallback(() => {
    if (propActive !== undefined) return propActive
    if (layerGroupRef.current && map.hasLayer(layerGroupRef.current)) {
      return true
    }
    return isActiveRef.current
  }, [map, propActive])

  // Logique principale : requête BBOX ou vidage immédiat de l'état
  const checkAndFetch = useCallback(() => {
    const active = isLayerActive()
    const zoom = map.getZoom()

    // Calque actif et zoom >= 10 (la clé Windy est ajoutée côté serveur par /api/webcams)
    if (active && zoom >= MIN_ZOOM) {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      const b = map.getBounds()
      const south = b.getSouth().toFixed(5)
      const west = b.getWest().toFixed(5)
      const north = b.getNorth().toFixed(5)
      const east = b.getEast().toFixed(5)

      // L'API Windy v3 attend la bbox au format [nord, est, sud, ouest]
      const urlPrimary = `/api/webcams?bbox=${north},${east},${south},${west}`
      const urlFallback = `/api/webcams?bbox=${south},${west},${north},${east}`

      fetch(urlPrimary, { signal: ctrl.signal })
        .then((res) => {
          if (!res.ok && res.status !== 429 && res.status !== 503) {
            return fetch(urlFallback, { signal: ctrl.signal })
          }
          return res
        })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Erreur API Windy Webcams: ${res.status} ${res.statusText}`)
          }
          return res.json()
        })
        .then((data) => {
          if (ctrl.signal.aborted) return
          const list = Array.isArray(data?.webcams) ? data.webcams : []
          const valid = list.filter((w) => {
            const lat = w.location?.latitude ?? w.latitude
            const lng = w.location?.longitude ?? w.longitude
            return typeof lat === 'number' && typeof lng === 'number'
          })
          setWebcams(valid)
        })
        .catch((err) => {
          if (ctrl.signal.aborted) return
          console.warn('Erreur lors du chargement des webcams Windy:', err)
          setWebcams([])
        })
    } else {
      // Dans le cas contraire, vide immédiatement l'état contenant les webcams
      abortRef.current?.abort()
      setWebcams([])
    }
  }, [map, isLayerActive])

  // Écoute les événements du calque et l'événement moveend de la carte
  useMapEvents({
    overlayadd: (e) => {
      if (e.name === 'Webcams') {
        isActiveRef.current = true
        setIsActive(true)
      }
    },
    overlayremove: (e) => {
      if (e.name === 'Webcams') {
        isActiveRef.current = false
        setIsActive(false)
        abortRef.current?.abort()
        setWebcams([])
      }
    },
    moveend: () => {
      checkAndFetch()
    },
  })

  // Synchronisation lors de l'activation/désactivation du calque
  useEffect(() => {
    isActiveRef.current = isActive
    checkAndFetch()

    return () => {
      abortRef.current?.abort()
    }
  }, [isActive, checkAndFetch])

  return (
    <LayerGroup ref={layerGroupRef}>
      {webcams.map((webcam) => {
        const lat = webcam.location?.latitude ?? webcam.latitude
        const lng = webcam.location?.longitude ?? webcam.longitude
        const id = webcam.webcamId ?? webcam.id
        const title = webcam.title || 'Webcam'
        const embedUrl =
          (typeof webcam.player?.day === 'string' ? webcam.player.day : webcam.player?.day?.embed) ||
          (typeof webcam.player?.lifetime === 'string' ? webcam.player.lifetime : webcam.player?.lifetime?.embed) ||
          webcam.player?.day?.embed ||
          webcam.player?.lifetime?.embed

        return (
          <Marker
            key={id}
            position={[lat, lng]}
            icon={getWebcamIcon()}
            zIndexOffset={250}
          >
            <Tooltip direction="top" offset={[0, -10]} className="refuge-tooltip">
              <div className="font-semibold text-xs flex items-center gap-1.5">
                <Camera size={12} className="text-sky-400" />
                <span>{title}</span>
              </div>
            </Tooltip>

            <Popup maxWidth={360} minWidth={280} className="webcam-popup" offset={[0, -8]}>
              <div className="p-2 text-slate-100 flex flex-col gap-2 min-w-[260px]">
                <div className="flex items-center gap-2 font-bold text-sm text-white">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/30 text-sky-300 shrink-0">
                    <Camera size={14} />
                  </span>
                  <span className="line-clamp-2 leading-tight">{title}</span>
                </div>

                {embedUrl ? (
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black/60 shadow-inner">
                    <iframe
                      src={embedUrl}
                      title={title}
                      className="w-full h-full border-0"
                      allow="autoplay; fullscreen"
                      allowFullScreen
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic py-2 text-center">
                    Lecteur vidéo non disponible
                  </div>
                )}

                {webcam.location && (webcam.location.city || webcam.location.country) && (
                  <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-white/10">
                    <span>
                      📍 {[webcam.location.city, webcam.location.country].filter(Boolean).join(', ')}
                    </span>
                    {webcam.status && (
                      <span className="capitalize text-emerald-400 text-[10px] font-medium">
                        {webcam.status}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )
      })}
    </LayerGroup>
  )
}
