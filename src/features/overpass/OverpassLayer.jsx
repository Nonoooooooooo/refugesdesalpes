import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useMap, useMapEvents, Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { fetchOverpassParkings, fetchOverpassPeaksAndPasses } from '../../lib/overpass'

const MIN_ZOOM = 13
const iconCache = new Map()

// Icône Parking "P" sobre
function getParkingIcon() {
  if (!iconCache.has('parking')) {
    iconCache.set(
      'parking',
      L.divIcon({
        className: 'overpass-marker',
        html: `<div class="parking-pin">P</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
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
  const abortRef = useRef(null)
  const timerRef = useRef(null)

  const fetchLayers = useCallback(() => {
    abortRef.current?.abort()

    const zoom = map.getZoom()
    // Si zoom < 13 ou aucun calque actif, on vide l'état et on n'envoie aucune requête
    if (zoom < MIN_ZOOM || (!showParkings && !showPeaks)) {
      setParkings([])
      setPeaks([])
      return
    }

    const b = map.getBounds()
    const bounds = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]
    const ctrl = new AbortController()
    abortRef.current = ctrl

    // 1. Requête Parkings si actif
    if (showParkings) {
      fetchOverpassParkings(bounds, ctrl.signal)
        .then((data) => setParkings(data))
        .catch((e) => {
          if (!ctrl.signal.aborted) console.warn('Overpass parkings error:', e)
        })
    } else {
      setParkings([])
    }

    // 2. Requête Sommets & Cols si actif
    if (showPeaks) {
      fetchOverpassPeaksAndPasses(bounds, ctrl.signal)
        .then((data) => setPeaks(data))
        .catch((e) => {
          if (!ctrl.signal.aborted) console.warn('Overpass peaks error:', e)
        })
    } else {
      setPeaks([])
    }
  }, [map, showParkings, showPeaks])

  // Écoute de l'événement moveend avec debouncing
  const schedule = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(fetchLayers, 300)
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

  return (
    <>
      {/* ─── Calque Parkings ─── */}
      {showParkings &&
        parkings.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={getParkingIcon()}
            zIndexOffset={300}
          >
            <Tooltip direction="top" offset={[0, -10]} className="refuge-tooltip">
              <div className="font-semibold text-xs">{p.name}</div>
              {(p.fee || p.capacity) && (
                <div className="text-[11px] text-white/70">
                  {p.fee && <span>{p.fee}</span>}
                  {p.fee && p.capacity && <span> · </span>}
                  {p.capacity && <span>{p.capacity} places</span>}
                </div>
              )}
            </Tooltip>
          </Marker>
        ))}

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
