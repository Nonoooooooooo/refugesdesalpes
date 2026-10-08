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

export default function WebcamLayer() {
  const map = useMap()
  const [webcams, setWebcams] = useState([])
  const [isActive, setIsActive] = useState(false)
  const isActiveRef = useRef(false)
  const layerGroupRef = useRef(null)
  const abortRef = useRef(null)

  // Vérifie si le calque est actuellement actif sur la carte
  const isLayerActive = useCallback(() => {
    if (layerGroupRef.current && map.hasLayer(layerGroupRef.current)) {
      return true
    }
    return isActiveRef.current
  }, [map])

  // Logique principale : requête BBOX ou vidage immédiat de l'état
  const checkAndFetch = useCallback(() => {
    const active = isLayerActive()
    const apiKey = import.meta.env.VITE_WINDY_API_KEY
    const isKeyValid = Boolean(
      apiKey &&
        typeof apiKey === 'string' &&
        apiKey.trim() !== '' &&
        apiKey !== 'ta_cle_api_ici',
    )
    const zoom = map.getZoom()

    // Condition 4 : calque actif, clé valide et zoom >= 10
    if (active && isKeyValid && zoom >= MIN_ZOOM) {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      const b = map.getBounds()
      const south = b.getSouth()
      const west = b.getWest()
      const north = b.getNorth()
      const east = b.getEast()

      const url = `https://api.windy.com/webcams/api/v3/webcams?bbox=${south},${west},${north},${east}&include=location,player`

      fetch(url, {
        method: 'GET',
        headers: {
          'x-windy-key': apiKey.trim(),
        },
        signal: ctrl.signal,
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

      // Sécurité anti-crash : avertissement console si le calque est actif mais clé manquante ou par défaut
      if (active && !isKeyValid) {
        console.warn(
          'Clé API Windy Webcams (VITE_WINDY_API_KEY) indéfinie, vide ou égale à la valeur par défaut. Veuillez configurer votre clé dans le fichier .env.',
        )
      }
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
        const embedUrl = webcam.player?.day?.embed || webcam.player?.lifetime?.embed

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
