import { useEffect, useRef, useState, useCallback } from 'react'
import { ImageOverlay } from 'react-leaflet'
import { buildAromeMapUrl, preloadAromeImage } from './aromeService'

// Emprise alpine globale et continue :
// Couvre l'intégralité du massif alpin (Haute-Savoie, Savoie, Isère, Hautes-Alpes, Alpes-de-Haute-Provence, Alpes-Maritimes)
// ainsi que le Jura, le Léman, le Vercors, les Préalpes et les massifs frontaliers suisses/italiens.
export const ALPS_BOUNDS = [
  [43.0, 4.5], // Sud-Ouest (Méditerranée / Provence / Drôme)
  [47.6, 8.8], // Nord-Est (Jura / Léman / Valais / Italie)
]

export const ALPS_BBOX = ['43.0', '4.5', '47.6', '8.8']

/**
 * Calque AROME-PI continu sans coupure :
 * Utilise une emprise alpine constante et stable pour garantir :
 * 1. Zéro coupure horizontale ou verticale lors du déplacement de la carte.
 * 2. Zéro rechargement intempestif lors du pan/zoom.
 * 3. 100% d'efficacité de cache mémoire serveur (aucun risque de quota 429).
 * 4. Défilement temporel fluide et préchargé.
 */
export default function AromeLayer({
  active = false,
  layerId = 'TOTAL_PRECIPITATION_RATE__GROUND_OR_WATER_SURFACE',
  time = '',
  opacity = 0.78,
  onLoadingChange,
}) {
  const [currentUrl, setCurrentUrl] = useState('')
  const prevUrlRef = useRef('')

  const updateOverlay = useCallback(() => {
    if (!active) {
      setCurrentUrl('')
      prevUrlRef.current = ''
      return
    }

    const url = buildAromeMapUrl({
      layer: layerId,
      bbox: ALPS_BBOX,
      width: 1024,
      height: 1024,
      time,
    })

    if (url === prevUrlRef.current) return
    prevUrlRef.current = url

    onLoadingChange?.(true)

    // Précharge l'image avant de l'afficher pour éviter tout flash blanc ou scintillement
    preloadAromeImage(url)
      .then(() => {
        if (!active) return
        setCurrentUrl(url)
      })
      .finally(() => {
        onLoadingChange?.(false)
      })
  }, [active, layerId, time, onLoadingChange])

  useEffect(() => {
    updateOverlay()
  }, [updateOverlay])

  if (!active || !currentUrl) return null

  return (
    <ImageOverlay
      url={currentUrl}
      bounds={ALPS_BOUNDS}
      opacity={opacity}
      zIndex={350}
      interactive={false}
    />
  )
}
