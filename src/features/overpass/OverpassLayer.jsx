import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useMap, useMapEvents, Marker, Tooltip, Popup } from 'react-leaflet'
import L from 'leaflet'
import { Loader2, ZoomIn, Navigation } from 'lucide-react'
import { fetchOverpassParkings } from '../../lib/overpass'

const MIN_ZOOM = 12
const iconCache = new Map()

// Icône Parking "P" sobre et visible
function getParkingIcon() {
  if (!iconCache.has('parking')) {
    iconCache.set(
      'parking',
      L.divIcon({
        className: 'overpass-marker',
        html: `<div class="parking-pin" title="Parking">P</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })
    )
  }
  return iconCache.get('parking')
}

export default function OverpassLayer({ showParkings }) {
  const map = useMap()
  const [parkings, setParkings] = useState([])
  const [loading, setLoading] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(() => map.getZoom())

  const abortRef = useRef(null)
  const timerRef = useRef(null)
  const prevShowParkingsRef = useRef(showParkings)

  // Zoom automatique fluide vers le niveau minimal si l'utilisateur active les parkings depuis un dézoom (< 12)
  useEffect(() => {
    if (showParkings && !prevShowParkingsRef.current) {
      if (map.getZoom() < MIN_ZOOM) {
        map.flyTo(map.getCenter(), MIN_ZOOM, { duration: 0.8 })
      }
    }
    prevShowParkingsRef.current = showParkings
  }, [showParkings, map])

  // Nettoyage ciblé lors de la désactivation
  useEffect(() => {
    if (!showParkings) {
      setParkings([])
    }
  }, [showParkings])

  const fetchLayers = useCallback(() => {
    const currentZoom = map.getZoom()
    setZoomLevel(currentZoom)

    if (!showParkings) {
      setLoading(false)
      return
    }

    if (currentZoom < MIN_ZOOM) {
      setLoading(false)
      return
    }

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)

    const b = map.getBounds()
    const bounds = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]

    fetchOverpassParkings(bounds, ctrl.signal)
      .then((incoming) => {
        if (ctrl.signal.aborted) return
        setParkings((prev) => {
          const mapById = new Map(prev.slice(-1500).map((item) => [item.id, item]))
          incoming.forEach((item) => mapById.set(item.id, item))
          return [...mapById.values()]
        })
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) console.warn('Erreur chargement Overpass parkings:', e)
      })
      .finally(() => {
        if (!ctrl.signal.aborted) {
          setLoading(false)
        }
      })
  }, [map, showParkings])

  // Débouncé à 400ms pour laisser l'utilisateur terminer son mouvement de carte
  const schedule = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(fetchLayers, 400)
  }, [fetchLayers])

  useMapEvents({
    moveend: schedule,
    zoomend: schedule,
  })

  useEffect(() => {
    fetchLayers()
    return () => {
      clearTimeout(timerRef.current)
      abortRef.current?.abort()
    }
  }, [fetchLayers])

  const handleZoomIn = () => {
    map.flyTo(map.getCenter(), MIN_ZOOM, { duration: 0.6 })
  }

  const isTooFar = showParkings && zoomLevel < MIN_ZOOM

  return (
    <>
      {/* ─── Notification d'aide au zoom ou de chargement ─── */}
      {showParkings && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-[1000] -translate-x-1/2">
          {loading && (
            <div className="glass flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-white/90 shadow-xl backdrop-blur-md animate-pulse">
              <Loader2 size={13} className="animate-spin text-blue-400" />
              <span>Chargement des parkings…</span>
            </div>
          )}
          {isTooFar && !loading && parkings.length === 0 && (
            <div className="pointer-events-auto glass flex items-center gap-2.5 rounded-2xl border border-blue-400/30 px-3.5 py-2 text-xs text-white/90 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2">
              <ZoomIn size={14} className="text-blue-400" />
              <span>Zoomez davantage pour afficher les parkings</span>
              <button
                onClick={handleZoomIn}
                className="glass-btn flex items-center gap-1 rounded-xl bg-blue-500/30 px-2.5 py-1 font-semibold text-blue-200 hover:bg-blue-500/50 hover:text-white"
              >
                Zoomer
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Calque Parkings (Marqueurs directs fiables à tout niveau de zoom >= 12) ─── */}
      {showParkings &&
        parkings.map((p) => {
          const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`
          return (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={getParkingIcon()}
              zIndexOffset={300}
            >
              <Tooltip direction="top" offset={[0, -10]} className="refuge-tooltip">
                <div className="font-semibold text-xs flex items-center gap-1.5">
                  <span className="text-blue-400 font-bold">🅿</span>
                  <span>{p.name}</span>
                </div>
                {(p.fee || p.capacity) && (
                  <div className="text-[11px] text-white/75 mt-0.5">
                    {p.fee && <span>{p.fee}</span>}
                    {p.fee && p.capacity && <span> · </span>}
                    {p.capacity && <span>{p.capacity} places</span>}
                  </div>
                )}
              </Tooltip>
              <Popup className="glass-popup" offset={[0, -8]}>
                <div className="p-2.5 text-slate-100 min-w-[190px]">
                  <div className="flex items-center gap-2 font-bold text-sm text-white">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-xs font-black text-white shadow-sm">P</span>
                    <span className="truncate">{p.name}</span>
                  </div>

                  <div className="my-2.5 space-y-1.5 text-xs text-slate-300 border-y border-white/10 py-2">
                    {p.fee && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Tarif :</span>
                        <span className={`font-medium px-1.5 py-0.5 rounded text-[11px] ${p.fee === 'Gratuit' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{p.fee}</span>
                      </div>
                    )}
                    {p.capacity && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Capacité :</span>
                        <span className="font-medium text-white">{p.capacity} places</span>
                      </div>
                    )}
                    {p.surface && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Revêtement :</span>
                        <span className="font-medium capitalize text-slate-200">{p.surface}</span>
                      </div>
                    )}
                    {p.parkingType && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Type :</span>
                        <span className="font-medium capitalize text-slate-200">{p.parkingType}</span>
                      </div>
                    )}
                  </div>

                  <a
                    href={gmapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600/90 hover:bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition shadow-sm"
                  >
                    <Navigation size={12} />
                    <span>Y aller (GPS)</span>
                  </a>
                </div>
              </Popup>
            </Marker>
          )
        })}
    </>
  )
}
