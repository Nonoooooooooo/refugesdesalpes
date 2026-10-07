import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useMap, useMapEvents, Marker, Tooltip, Popup } from 'react-leaflet'
import L from 'leaflet'
import { Loader2, ZoomIn, Navigation, SquareParking } from 'lucide-react'
import { fetchOverpassParkings, fetchOverpassPeaksAndPasses } from '../../lib/overpass'

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

// Icône Sommet / Col avec texte direct sur la carte
function getPeakLabelIcon(label, isPeak) {
  const symbol = isPeak ? '▲' : '≍'
  return L.divIcon({
    className: 'overpass-marker overpass-label-marker',
    html: `
      <div class="peak-label-container">
        <span class="peak-symbol ${isPeak ? 'is-peak' : 'is-pass'}">${symbol}</span>
        <span class="peak-text">${label}</span>
      </div>
    `,
    iconSize: [140, 20],
    iconAnchor: [10, 10],
  })
}

export default function OverpassLayer({ showParkings, showPeaks }) {
  const map = useMap()
  const [parkings, setParkings] = useState([])
  const [peaks, setPeaks] = useState([])
  const [loading, setLoading] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(() => map.getZoom())
  const abortRef = useRef(null)
  const timerRef = useRef(null)

  const fetchLayers = useCallback(() => {
    abortRef.current?.abort()

    const currentZoom = map.getZoom()
    setZoomLevel(currentZoom)

    // Si aucun calque actif
    if (!showParkings && !showPeaks) {
      setParkings([])
      setPeaks([])
      setLoading(false)
      return
    }

    // Si zoom trop faible
    if (currentZoom < MIN_ZOOM) {
      setParkings([])
      setPeaks([])
      setLoading(false)
      return
    }

    const b = map.getBounds()
    const bounds = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)

    const promises = []

    // 1. Requête Parkings si actif
    if (showParkings) {
      const p1 = fetchOverpassParkings(bounds, ctrl.signal)
        .then((incoming) => {
          setParkings((prev) => {
            const mapById = new Map(prev.slice(-800).map((item) => [item.id, item]))
            incoming.forEach((item) => mapById.set(item.id, item))
            return [...mapById.values()]
          })
        })
        .catch((e) => {
          if (!ctrl.signal.aborted) console.warn('Overpass parkings error:', e)
        })
      promises.push(p1)
    } else {
      setParkings([])
    }

    // 2. Requête Sommets & Cols si actif
    if (showPeaks) {
      const p2 = fetchOverpassPeaksAndPasses(bounds, ctrl.signal)
        .then((incoming) => {
          setPeaks((prev) => {
            const mapById = new Map(prev.slice(-600).map((item) => [item.id, item]))
            incoming.forEach((item) => mapById.set(item.id, item))
            return [...mapById.values()]
          })
        })
        .catch((e) => {
          if (!ctrl.signal.aborted) console.warn('Overpass peaks error:', e)
        })
      promises.push(p2)
    } else {
      setPeaks([])
    }

    Promise.allSettled(promises).finally(() => {
      if (!ctrl.signal.aborted) {
        setLoading(false)
      }
    })
  }, [map, showParkings, showPeaks])

  // Écoute des déplacements de carte avec debounce
  const schedule = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(fetchLayers, 280)
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
    map.setZoom(13)
  }

  const isTooFar = (showParkings || showPeaks) && zoomLevel < MIN_ZOOM

  return (
    <>
      {/* ─── Notification d'aide au zoom ou de chargement ─── */}
      {(showParkings || showPeaks) && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-[1000] -translate-x-1/2">
          {loading && (
            <div className="glass flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-white/90 shadow-xl backdrop-blur-md animate-pulse">
              <Loader2 size={13} className="animate-spin text-blue-400" />
              <span>Chargement {showParkings ? 'des parkings' : ''}{showParkings && showPeaks ? ' & ' : ''}{showPeaks ? 'des sommets' : ''}…</span>
            </div>
          )}
          {isTooFar && !loading && (
            <div className="pointer-events-auto glass flex items-center gap-2.5 rounded-2xl border border-blue-400/30 px-3.5 py-2 text-xs text-white/90 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2">
              <ZoomIn size={14} className="text-blue-400" />
              <span>Zoomez davantage pour afficher {showParkings ? 'les parkings' : ''}{showParkings && showPeaks ? ' et ' : ''}{showPeaks ? 'les sommets' : ''}</span>
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

      {/* ─── Calque Parkings ─── */}
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
                <div className="font-semibold text-xs flex items-center gap-1">
                  <span className="text-blue-400 font-bold">🅿</span> {p.name}
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
                <div className="p-2 text-slate-100 min-w-[180px]">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-white">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-xs text-white">P</span>
                    <span>{p.name}</span>
                  </div>

                  <div className="my-2 space-y-1 text-xs text-slate-300">
                    {p.fee && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Tarif :</span>
                        <span className="font-medium text-white">{p.fee}</span>
                      </div>
                    )}
                    {p.capacity && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Capacité :</span>
                        <span className="font-medium text-white">{p.capacity} places</span>
                      </div>
                    )}
                    {p.surface && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Revêtement :</span>
                        <span className="font-medium capitalize text-slate-200">{p.surface}</span>
                      </div>
                    )}
                  </div>

                  <a
                    href={gmapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600/80 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-600"
                  >
                    <Navigation size={12} />
                    <span>Y aller (GPS)</span>
                  </a>
                </div>
              </Popup>
            </Marker>
          )
        })}

      {/* ─── Calque Sommets & Cols ─── */}
      {showPeaks &&
        peaks.map((pk) => (
          <Marker
            key={pk.id}
            position={[pk.lat, pk.lng]}
            icon={getPeakLabelIcon(pk.label, pk.isPeak)}
            zIndexOffset={350}
            interactive={false}
          />
        ))}
    </>
  )
}

