import { useEffect, useRef, useState, useCallback } from 'react'
import { useMap, ImageOverlay } from 'react-leaflet'
import L from 'leaflet'
import { buildAromeMapUrl, preloadAromeImage } from './aromeService'

/**
 * Calque cartographique AROME-PI haute performance.
 * Utilise une projection ImageOverlay dynamique par emprise (BBOX) avec double tampon
 * pour des transitions fluides sans scintillement lors de l'animation temporelle.
 */
export default function AromeLayer({
  active = false,
  layerId = 'TOTAL_PRECIPITATION_RATE__GROUND_OR_WATER_SURFACE',
  time = '',
  opacity = 0.82,
  onLoadingChange,
}) {
  const map = useMap()
  const [currentOverlay, setCurrentOverlay] = useState(null)
  const timerRef = useRef(null)
  const abortCtrlRef = useRef(null)
  const prevKeyRef = useRef('')

  const updateOverlay = useCallback(() => {
    if (!active || !map) {
      setCurrentOverlay(null)
      return
    }

    const bounds = map.getBounds()
    const size = map.getSize()

    // Bounding box avec légère marge (buffer 8%)
    const latSpan = bounds.getNorth() - bounds.getSouth()
    const lngSpan = bounds.getEast() - bounds.getWest()
    const minLat = Math.max(38.0, bounds.getSouth() - latSpan * 0.08)
    const maxLat = Math.min(55.0, bounds.getNorth() + latSpan * 0.08)
    const minLng = Math.max(-11.5, bounds.getWest() - lngSpan * 0.08)
    const maxLng = Math.min(15.5, bounds.getEast() + lngSpan * 0.08)

    const w = Math.min(1280, Math.max(320, Math.round(size.x * 1.15)))
    const h = Math.min(1280, Math.max(320, Math.round(size.y * 1.15)))

    const bbox = [
      minLat.toFixed(4),
      minLng.toFixed(4),
      maxLat.toFixed(4),
      maxLng.toFixed(4),
    ]

    const url = buildAromeMapUrl({
      layer: layerId,
      bbox,
      width: w,
      height: h,
      time,
    })

    const requestKey = `${layerId}-${bbox.join(',')}-${time}`
    if (requestKey === prevKeyRef.current) return
    prevKeyRef.current = requestKey

    onLoadingChange?.(true)

    // Préchargement de l'image pour affichage instantané et sans saut
    preloadAromeImage(url)
      .then(() => {
        if (!active) return
        setCurrentOverlay({
          url,
          bounds: [
            [minLat, minLng],
            [maxLat, maxLng],
          ],
        })
      })
      .finally(() => {
        onLoadingChange?.(false)
      })
  }, [active, map, layerId, time, onLoadingChange])

  // Écoute les mouvements de la carte avec débounce pour économiser les requêtes
  useEffect(() => {
    if (!active) {
      setCurrentOverlay(null)
      return
    }

    const onMove = () => {
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(updateOverlay, 300)
    }

    map.on('moveend', onMove)
    map.on('zoomend', onMove)

    // Mise à jour immédiate à l'activation ou au changement de paramètre
    updateOverlay()

    return () => {
      clearTimeout(timerRef.current)
      map.off('moveend', onMove)
      map.off('zoomend', onMove)
    }
  }, [active, map, updateOverlay])

  if (!active || !currentOverlay) return null

  return (
    <ImageOverlay
      url={currentOverlay.url}
      bounds={currentOverlay.bounds}
      opacity={opacity}
      zIndex={350}
      interactive={false}
    />
  )
}
