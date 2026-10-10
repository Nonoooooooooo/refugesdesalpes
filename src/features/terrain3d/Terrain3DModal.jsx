import React, { useState, useRef, useEffect, useCallback } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import {
  X,
  RotateCw,
  Mountain,
  Compass,
  Maximize2,
  Minimize2,
  Loader2,
  Satellite,
  Map as MapIcon,
  Eye,
  Globe2,
  ArrowUp,
  ArrowDown,
  Maximize,
} from 'lucide-react'
import { typeInfo } from '../../lib/types.jsx'

// Configuration obligatoire pour Vite : injecter l'URL du Web Worker MapLibre
if (maplibregl.setWorkerUrl) {
  maplibregl.setWorkerUrl(workerUrl)
}

function getCardinalLabel(deg) {
  const normalized = ((deg % 360) + 360) % 360
  const cardinals = [
    { label: 'N (Nord)', short: 'N' },
    { label: 'NE (Nord-Est)', short: 'NE' },
    { label: 'E (Est)', short: 'E' },
    { label: 'SE (Sud-Est)', short: 'SE' },
    { label: 'S (Sud)', short: 'S' },
    { label: 'SO (Sud-Ouest)', short: 'SO' },
    { label: 'O (Ouest)', short: 'O' },
    { label: 'NO (Nord-Ouest)', short: 'NO' },
  ]
  const idx = Math.round(normalized / 45) % 8
  return cardinals[idx]
}

export default function Terrain3DModal({ point, onClose }) {
  const containerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('orbit') // 'orbit' | 'pov'
  const [isRotating, setIsRotating] = useState(false)
  const [exaggeration, setExaggeration] = useState(1.5)
  const [base3d, setBase3d] = useState('outdoor') // 'outdoor' | 'satellite'
  const [isFullscreen, setIsFullscreen] = useState(false)

  // POV Mode State
  const [povBearing, setPovBearing] = useState(45)
  const [povPitch, setPovPitch] = useState(83)
  const [eyeHeight, setEyeHeight] = useState(8) // en mètres au-dessus du sol
  const [povFov, setPovFov] = useState(75) // Champ de vision large (75° par défaut au lieu des 36° standards)

  // Refs pour interactions fluides sans re-render React à chaque pixel
  const povBearingRef = useRef(45)
  const povPitchRef = useRef(83)
  const eyeHeightRef = useRef(8)
  const povFovRef = useRef(75)
  const cachedAltitudeRef = useRef(null)

  // Drag souris / tactile incrémental fluide
  const isDraggingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })
  const pendingRafRef = useRef(null)

  const modalRef = useRef(null)
  const animFrameRef = useRef(null)

  const { color, Icon, label } = typeInfo(point?.type)

  // Récupère ou met en cache l'altitude du refuge
  const getRefugeAltitude = useCallback(() => {
    if (cachedAltitudeRef.current != null) return cachedAltitudeRef.current
    let alt = Number(point?.alt)
    if (!alt || isNaN(alt)) {
      const map = mapInstanceRef.current
      if (map) {
        try {
          const terrainAlt = map.queryTerrainElevation?.([point.lng, point.lat])
          if (terrainAlt != null && !isNaN(terrainAlt)) {
            alt = terrainAlt / (exaggeration || 1)
          }
        } catch {}
      }
    }
    if (!alt || isNaN(alt)) alt = 2000
    cachedAltitudeRef.current = alt
    return alt
  }, [point, exaggeration])

  // Calcule la configuration de caméra stable pour le mode POV
  // Utilise un point cible géométrique sur l'horizon à distance fixe pour éliminer les sauts de raycast
  const getCameraOptionsForPOV = useCallback(
    (bearing, pitch, customHeight) => {
      const map = mapInstanceRef.current
      if (!map || !point) return null
      const baseAlt = getRefugeAltitude()
      const height = customHeight ?? eyeHeightRef.current
      const cameraAlt = baseAlt * (exaggeration || 1) + height

      // Distance cible fixe sur l'horizon (2500m) pour une géométrie de vue parfaitement stable
      const targetDist = 2500
      const bearingRad = (bearing * Math.PI) / 180
      const pitchRad = (pitch * Math.PI) / 180
      const latRad = (point.lat * Math.PI) / 180

      const dLng = (targetDist * Math.sin(bearingRad)) / (111320 * Math.cos(latRad))
      const dLat = (targetDist * Math.cos(bearingRad)) / 110540
      const toLng = point.lng + dLng
      const toLat = point.lat + dLat

      // Inclinaison : altitude cible calculée trigonométriquement
      const tanP = Math.tan(pitchRad)
      const toAlt = cameraAlt - (tanP > 0 ? targetDist / tanP : 0)

      try {
        if (typeof map.calculateCameraOptionsFromTo === 'function') {
          return map.calculateCameraOptionsFromTo(
            [point.lng, point.lat],
            cameraAlt,
            [toLng, toLat],
            toAlt
          )
        }
      } catch (err) {
        console.warn('calculateCameraOptionsFromTo error:', err)
      }

      // Fallback
      return {
        center: [toLng, toLat],
        zoom: 14.5,
        pitch,
        bearing,
      }
    },
    [getRefugeAltitude, point, exaggeration]
  )

  // Applique la caméra POV
  const applyPOVCamera = useCallback(
    (bearing, pitch, customHeight, animate = false) => {
      const map = mapInstanceRef.current
      if (!map) return
      const opts = getCameraOptionsForPOV(bearing, pitch, customHeight)
      if (!opts) return
      if (animate) {
        map.easeTo({ ...opts, duration: 600, essential: true })
      } else {
        map.jumpTo(opts)
      }
    },
    [getCameraOptionsForPOV]
  )

  // Applique le champ de vision (Field of View)
  const applyFOV = useCallback((fovValue) => {
    const map = mapInstanceRef.current
    if (!map) return
    try {
      if (typeof map.setVerticalFieldOfView === 'function') {
        map.setVerticalFieldOfView(fovValue)
      }
    } catch (e) {
      console.warn('setVerticalFieldOfView error:', e)
    }
  }, [])

  // Initialisation de la carte MapLibre 3D avec Mapterhorn DEM
  useEffect(() => {
    if (!containerRef.current || !point) return

    const style = {
      version: 8,
      sources: {
        'mapterhorn-dem': {
          type: 'raster-dem',
          tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
          encoding: 'terrarium',
          tileSize: 512,
          maxzoom: 16,
          attribution: '&copy; Mapterhorn',
        },
        'mapterhorn-hillshade': {
          type: 'raster-dem',
          tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
          encoding: 'terrarium',
          tileSize: 512,
          maxzoom: 16,
        },
        'esri-satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          maxzoom: 18,
          attribution: '&copy; Esri',
        },
        'osm-outdoor': {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          maxzoom: 19,
          attribution: '&copy; OpenStreetMap Contributors | Mapterhorn',
        },
      },
      layers: [
        {
          id: 'satellite-layer',
          type: 'raster',
          source: 'esri-satellite',
          layout: {
            visibility: 'none',
          },
        },
        {
          id: 'outdoor-layer',
          type: 'raster',
          source: 'osm-outdoor',
          layout: {
            visibility: 'visible',
          },
        },
        {
          id: 'hillshade-layer',
          type: 'hillshade',
          source: 'mapterhorn-hillshade',
          paint: {
            'hillshade-shadow-color': '#1e293b',
            'hillshade-highlight-color': '#ffffff',
            'hillshade-exaggeration': 0.45,
          },
          layout: {
            visibility: 'visible',
          },
        },
      ],
      terrain: {
        source: 'mapterhorn-dem',
        exaggeration: 1.5,
      },
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [point.lng, point.lat],
      zoom: 13.5,
      pitch: 72,
      bearing: 45,
      maxPitch: 85,
      attributionControl: false,
    })

    mapInstanceRef.current = map
    window.__map3d = map

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')

    const done = () => setLoading(false)
    map.once('load', done)
    map.once('render', done)
    map.once('idle', done)

    const safetyTimer = setTimeout(done, 500)

    map.on('load', () => {
      done()
      try {
        map.setTerrain({ source: 'mapterhorn-dem', exaggeration: 1.5 })
      } catch (err) {
        console.warn('setTerrain error:', err)
      }

      // Marqueur HTML 3D du refuge
      try {
        const el = document.createElement('div')
        el.className = 'group relative flex flex-col items-center cursor-pointer pointer-events-auto'
        const badge = document.createElement('div')
        badge.style.background = color
        badge.className = 'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-2xl border-2 border-white/90 backdrop-blur-md'

        const nameSpan = document.createElement('span')
        nameSpan.textContent = point.nom || 'Point'
        badge.appendChild(nameSpan)

        if (point.alt) {
          const altSpan = document.createElement('span')
          altSpan.className = 'opacity-90 font-normal'
          altSpan.textContent = ` (${point.alt}m)`
          badge.appendChild(altSpan)
        }

        const arrow = document.createElement('div')
        arrow.style.background = color
        arrow.className = 'h-2.5 w-2.5 rotate-45 transform -mt-1.5 shadow-md border-r-2 border-b-2 border-white/80'

        const dot = document.createElement('div')
        dot.style.background = color
        dot.className = 'h-2 w-2 rounded-full mt-0.5 opacity-80 ring-2 ring-white'

        el.appendChild(badge)
        el.appendChild(arrow)
        el.appendChild(dot)

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([point.lng, point.lat])
          .addTo(map)

        markerRef.current = marker
      } catch (e) {
        console.warn('Marker creation error:', e)
      }
    })

    return () => {
      clearTimeout(safetyTimer)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (pendingRafRef.current) cancelAnimationFrame(pendingRafRef.current)
      map.remove()
      mapInstanceRef.current = null
    }
  }, [point, color])

  // Bascule Mode Orbite / Mode POV
  const handleSwitchMode = (mode) => {
    if (mode === viewMode) return
    const map = mapInstanceRef.current
    if (!map) return

    if (mode === 'pov') {
      setViewMode('pov')
      // Désactiver les contrôles par défaut pouvant interférer avec la rotation de tête
      map.dragPan.disable()
      map.dragRotate.disable()
      map.touchZoomRotate.disable()
      map.touchPitch.disable()
      map.doubleClickZoom.disable()

      // Élargir le champ de vision (FOV) pour une vue panoramique immersive
      applyFOV(povFovRef.current)

      // Masquer le marqueur à la position de la caméra pour ne pas obstruer la vue
      if (markerRef.current) {
        const el = markerRef.current.getElement()
        if (el) el.style.display = 'none'
      }

      const currentBearing = Math.round(map.getBearing() || 45)
      povBearingRef.current = currentBearing
      setPovBearing(currentBearing)

      const camOpts = getCameraOptionsForPOV(currentBearing, povPitchRef.current)
      if (camOpts) {
        map.flyTo({
          ...camOpts,
          duration: 1800,
          essential: true,
        })
      }
    } else {
      setViewMode('orbit')
      // Réactiver les contrôles par défaut
      map.dragPan.enable()
      map.dragRotate.enable()
      map.touchZoomRotate.enable()
      map.touchPitch.enable()
      map.doubleClickZoom.enable()

      // Rétablir le FOV standard pour la vue aérienne
      applyFOV(36.87)

      // Réafficher le marqueur
      if (markerRef.current) {
        const el = markerRef.current.getElement()
        if (el) el.style.display = 'flex'
      }

      map.flyTo({
        center: [point.lng, point.lat],
        zoom: 13.5,
        pitch: 72,
        bearing: povBearingRef.current || 45,
        duration: 1400,
        essential: true,
      })
    }
  }

  // Changement de fond de carte
  const handleBaseChange = (mode) => {
    setBase3d(mode)
    const map = mapInstanceRef.current
    if (!map) return

    if (mode === 'satellite') {
      if (map.getLayer('satellite-layer')) map.setLayoutProperty('satellite-layer', 'visibility', 'visible')
      if (map.getLayer('outdoor-layer')) map.setLayoutProperty('outdoor-layer', 'visibility', 'none')
      if (map.getLayer('hillshade-layer')) map.setLayoutProperty('hillshade-layer', 'visibility', 'none')
    } else {
      if (map.getLayer('satellite-layer')) map.setLayoutProperty('satellite-layer', 'visibility', 'none')
      if (map.getLayer('outdoor-layer')) map.setLayoutProperty('outdoor-layer', 'visibility', 'none')
      if (map.getLayer('outdoor-layer')) map.setLayoutProperty('outdoor-layer', 'visibility', 'visible')
      if (map.getLayer('hillshade-layer')) map.setLayoutProperty('hillshade-layer', 'visibility', 'visible')
    }
  }

  // Ajustement du relief
  const handleExaggerationChange = (val) => {
    setExaggeration(val)
    cachedAltitudeRef.current = null
    const map = mapInstanceRef.current
    if (map) {
      try {
        map.setTerrain({ source: 'mapterhorn-dem', exaggeration: val })
      } catch (err) {
        console.warn('setTerrain error:', err)
      }
      if (viewMode === 'pov') {
        applyPOVCamera(povBearingRef.current, povPitchRef.current, eyeHeightRef.current, true)
      }
    }
  }

  // Hauteur de vue POV (terrasse, balcon, promontoire)
  const handleEyeHeightChange = (h) => {
    setEyeHeight(h)
    eyeHeightRef.current = h
    if (viewMode === 'pov') {
      applyPOVCamera(povBearingRef.current, povPitchRef.current, h, true)
    }
  }

  // Changement du champ de vision (FOV) en mode POV
  const handleFovChange = (val) => {
    setPovFov(val)
    povFovRef.current = val
    if (viewMode === 'pov') {
      applyFOV(val)
    }
  }

  // Orientation rapide cardinale POV (N, E, S, O)
  const handleLookDirection = (targetBearing) => {
    povBearingRef.current = targetBearing
    setPovBearing(targetBearing)
    if (viewMode === 'pov') {
      applyPOVCamera(targetBearing, povPitchRef.current, eyeHeightRef.current, true)
    } else {
      const map = mapInstanceRef.current
      if (map) map.easeTo({ bearing: targetBearing, duration: 800 })
    }
  }

  // Ajustement de l'inclinaison du regard POV (vers les sommets ou la vallée)
  const handlePitchAdjust = useCallback(
    (delta) => {
      const nextPitch = Math.min(85, Math.max(68, povPitchRef.current + delta))
      povPitchRef.current = nextPitch
      setPovPitch(Math.round(nextPitch))
      if (viewMode === 'pov') {
        applyPOVCamera(povBearingRef.current, nextPitch, eyeHeightRef.current, true)
      }
    },
    [viewMode, applyPOVCamera]
  )

  // Animation de rotation (Orbite ou Panorama POV à 360°)
  useEffect(() => {
    const rotate = () => {
      const map = mapInstanceRef.current
      if (!isRotating || !map) return

      if (viewMode === 'orbit') {
        const currentBearing = map.getBearing()
        map.setBearing((currentBearing + 0.25) % 360)
      } else {
        // En mode POV : rotation panoramique sur soi-même depuis le refuge
        const nextBearing = (povBearingRef.current + 0.18) % 360
        povBearingRef.current = nextBearing
        applyPOVCamera(nextBearing, povPitchRef.current, eyeHeightRef.current, false)
        // Mettre à jour l'affichage de la boussole de temps à autre
        if (Math.round(nextBearing) % 2 === 0) {
          setPovBearing(Math.round(nextBearing))
        }
      }

      animFrameRef.current = requestAnimationFrame(rotate)
    }

    if (isRotating) {
      animFrameRef.current = requestAnimationFrame(rotate)
    } else if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [isRotating, viewMode, applyPOVCamera])

  // Drag souris / tactile incrémental ultra-fluide avec RequestAnimationFrame
  const handlePointerDown = (e) => {
    if (viewMode !== 'pov') return
    if (e.target.closest('button, input, a, [role="button"]')) return

    isDraggingRef.current = true
    lastPosRef.current = { x: e.clientX, y: e.clientY }
    setIsRotating(false)
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {}
  }

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current || viewMode !== 'pov') return

    const dx = e.clientX - lastPosRef.current.x
    const dy = e.clientY - lastPosRef.current.y
    lastPosRef.current = { x: e.clientX, y: e.clientY }

    // Déplacement relatif incrémental doux (0.2° par pixel)
    const nextBearing = ((povBearingRef.current - dx * 0.2) % 360 + 360) % 360
    const nextPitch = Math.min(85, Math.max(68, povPitchRef.current + dy * 0.1))

    povBearingRef.current = nextBearing
    povPitchRef.current = nextPitch

    // Rendu sur le cycle RequestAnimationFrame pour une fluidité 60-120fps sans freeze
    if (!pendingRafRef.current) {
      pendingRafRef.current = requestAnimationFrame(() => {
        pendingRafRef.current = null
        applyPOVCamera(povBearingRef.current, povPitchRef.current, eyeHeightRef.current, false)
      })
    }
  }

  const handlePointerUp = (e) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false
      try {
        e.currentTarget.releasePointerCapture?.(e.pointerId)
      } catch {}
      // Synchronisation du state React à la fin du geste
      setPovBearing(Math.round(povBearingRef.current))
      setPovPitch(Math.round(povPitchRef.current))
    }
  }

  // Raccourcis clavier (Échap pour fermer, Flèches pour tourner la tête en mode POV)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (viewMode === 'pov') {
        if (e.key === 'ArrowLeft') {
          const next = ((povBearingRef.current - 4) % 360 + 360) % 360
          povBearingRef.current = next
          setPovBearing(Math.round(next))
          applyPOVCamera(next, povPitchRef.current, eyeHeightRef.current, false)
        } else if (e.key === 'ArrowRight') {
          const next = (povBearingRef.current + 4) % 360
          povBearingRef.current = next
          setPovBearing(Math.round(next))
          applyPOVCamera(next, povPitchRef.current, eyeHeightRef.current, false)
        } else if (e.key === 'ArrowUp') {
          handlePitchAdjust(1.5)
        } else if (e.key === 'ArrowDown') {
          handlePitchAdjust(-1.5)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, viewMode, applyPOVCamera, handlePitchAdjust])

  // Recentrer la vue
  const resetCamera = () => {
    const map = mapInstanceRef.current
    if (!map) return
    if (viewMode === 'pov') {
      povBearingRef.current = 45
      povPitchRef.current = 83
      setPovBearing(45)
      setPovPitch(83)
      applyPOVCamera(45, 83, eyeHeightRef.current, true)
    } else {
      map.flyTo({
        center: [point.lng, point.lat],
        zoom: 13.5,
        pitch: 72,
        bearing: 45,
        essential: true,
        duration: 1200,
      })
    }
  }

  // Bascule plein écran
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      modalRef.current?.requestFullscreen?.().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.().catch(() => {})
      setIsFullscreen(false)
    }
  }

  if (!point) return null

  const currentDir = getCardinalLabel(povBearing)

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-neutral-950 shadow-2xl backdrop-blur-2xl">
        {/* ─── Header de la modale ─── */}
        <header className="absolute left-4 right-4 top-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
          {/* Info point & badge sobre */}
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl px-3.5 py-2 shadow-xl backdrop-blur-xl bg-black/60 border border-white/10">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm"
              style={{ background: color }}
            >
              <Icon size={16} className="text-white" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white tracking-wide">
                  {point.nom || 'Point 3D'}
                </h2>
                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/70 border border-white/10">
                  Relief 3D
                </span>
              </div>
              <p className="text-[11px] text-white/60">
                {point.alt ? `${point.alt} m` : ''} {point.alt && point.type ? '·' : ''} {label || point.type}
              </p>
            </div>
          </div>

          {/* Sélecteur de mode : Orbite aérienne vs Vue POV depuis le refuge */}
          <div className="pointer-events-auto flex rounded-xl bg-black/60 p-1 border border-white/10 backdrop-blur-xl shadow-xl">
            <button
              onClick={() => handleSwitchMode('orbit')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                viewMode === 'orbit'
                  ? 'bg-white/20 text-white font-semibold shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Globe2 size={13} />
              <span>Vue Aérienne</span>
            </button>
            <button
              onClick={() => handleSwitchMode('pov')}
              title="Visualiser le panorama depuis le refuge, à hauteur d'homme avec grand angle"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                viewMode === 'pov'
                  ? 'bg-white/20 text-white font-semibold shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Eye size={13} />
              <span>POV Refuge</span>
            </button>
          </div>

          {/* Actions : Carte/Satellite, Plein écran & Fermer */}
          <div className="pointer-events-auto flex items-center gap-1.5">
            {/* Bascule Carte Topo / Satellite */}
            <div className="flex rounded-xl bg-black/60 p-1 border border-white/10 backdrop-blur-xl">
              <button
                onClick={() => handleBaseChange('outdoor')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  base3d === 'outdoor'
                    ? 'bg-white/20 text-white font-semibold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <MapIcon size={12} />
                <span className="hidden sm:inline">Topo</span>
              </button>
              <button
                onClick={() => handleBaseChange('satellite')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  base3d === 'satellite'
                    ? 'bg-white/20 text-white font-semibold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Satellite size={12} />
                <span className="hidden sm:inline">Satellite</span>
              </button>
            </div>

            <button
              onClick={toggleFullscreen}
              title="Plein écran"
              className="rounded-xl p-2 text-white/70 hover:text-white bg-black/60 backdrop-blur-xl border border-white/10 transition-colors"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={onClose}
              title="Fermer (Échap)"
              className="rounded-xl p-2 text-white/70 hover:text-white hover:bg-red-500/20 hover:border-red-500/30 bg-black/60 backdrop-blur-xl border border-white/10 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* ─── Conteneur MapLibre WebGL avec support drag POV ─── */}
        <div
          className={`relative h-full w-full bg-neutral-950 ${
            viewMode === 'pov' ? 'cursor-grab active:cursor-grabbing select-none' : ''
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div ref={containerRef} className="h-full w-full" />

          {/* Indication et boussole flottante en mode POV */}
          {viewMode === 'pov' && (
            <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 rounded-full bg-black/65 px-3.5 py-1 text-xs text-white/90 backdrop-blur-md border border-white/10 shadow-lg">
                <Compass size={13} className="text-white/70" />
                <span className="font-semibold">{currentDir.label}</span>
                <span className="text-white/40">·</span>
                <span className="text-white/70">Hauteur : +{eyeHeight}m</span>
                <span className="text-white/40">·</span>
                <span className="text-white/70">Angle : {povPitch}°</span>
              </div>
              <div className="hidden sm:block text-[10px] text-white/60 bg-black/40 px-2.5 py-0.5 rounded-full border border-white/5 backdrop-blur-sm">
                Faites glisser pour regarder à 360° ou utilisez ← →
              </div>
            </div>
          )}

          {loading && (
            <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full bg-black/60 px-3.5 py-1.5 text-xs text-white/80 backdrop-blur-md border border-white/10">
              <Loader2 size={13} className="animate-spin text-white/80" />
              <span>Chargement du relief 3D…</span>
            </div>
          )}
        </div>

        {/* ─── Barre de commandes 3D en bas ─── */}
        <footer className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl bg-black/65 border border-white/10">
            {/* Bouton Orbite / Panorama 360° */}
            <button
              onClick={() => setIsRotating((r) => !r)}
              title={
                isRotating
                  ? 'Arrêter la rotation 360°'
                  : viewMode === 'pov'
                  ? 'Lancer le panorama 360° depuis le refuge'
                  : 'Lancer la rotation 360°'
              }
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                isRotating
                  ? 'border border-amber-400/50 bg-amber-500/25 text-amber-200'
                  : 'bg-white/10 text-white/80 hover:text-white hover:bg-white/15'
              }`}
            >
              <RotateCw size={13} className={isRotating ? 'animate-spin' : ''} />
              <span>
                {isRotating
                  ? 'Pause 360°'
                  : viewMode === 'pov'
                  ? 'Panorama 360°'
                  : 'Rotation 360°'}
              </span>
            </button>

            {/* Bouton Recentrer */}
            <button
              onClick={resetCamera}
              title="Recentrer et réinitialiser l'angle"
              className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-medium text-white/80 hover:text-white transition-colors"
            >
              <Compass size={13} />
              <span className="hidden sm:inline">Recentrer</span>
            </button>

            <div className="mx-1 h-4 w-px bg-white/15" />

            {/* Commandes spécifiques au mode POV */}
            {viewMode === 'pov' ? (
              <>
                {/* Orientations cardinales rapides */}
                <div className="flex items-center gap-1 text-[11px] text-white/70 px-1">
                  <span className="hidden md:inline text-white/50">Regard :</span>
                  {[
                    { label: 'N', deg: 0 },
                    { label: 'E', deg: 90 },
                    { label: 'S', deg: 180 },
                    { label: 'O', deg: 270 },
                  ].map((dir) => (
                    <button
                      key={dir.label}
                      onClick={() => handleLookDirection(dir.deg)}
                      title={`Regarder vers le ${dir.label}`}
                      className="rounded-lg px-2 py-0.5 text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      {dir.label}
                    </button>
                  ))}
                </div>

                <div className="mx-1 h-4 w-px bg-white/15" />

                {/* Champ de vision (FOV / Grand angle) */}
                <div className="flex items-center gap-1 text-[11px] text-white/70 px-1">
                  <Maximize size={12} className="text-white/50" />
                  <span className="hidden lg:inline text-white/50">Vision :</span>
                  {[
                    { val: 60, label: '60°' },
                    { val: 75, label: '75° Large' },
                    { val: 85, label: '85° Maxi' },
                  ].map((f) => (
                    <button
                      key={f.val}
                      onClick={() => handleFovChange(f.val)}
                      title={`Champ de vision ${f.label}`}
                      className={`rounded-lg px-2 py-0.5 text-xs font-medium transition-colors ${
                        povFov === f.val
                          ? 'bg-white/20 text-white font-semibold'
                          : 'text-white/50 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="mx-1 h-4 w-px bg-white/15" />

                {/* Inclinaison du regard (Sommets / Vallée) */}
                <div className="flex items-center gap-0.5 text-[11px] text-white/70 px-1">
                  <span className="hidden md:inline text-white/50 mr-1">Angle :</span>
                  <button
                    onClick={() => handlePitchAdjust(2)}
                    title="Lever les yeux vers les sommets"
                    className="flex items-center gap-0.5 rounded-lg px-1.5 py-0.5 text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <ArrowUp size={11} />
                    <span className="hidden lg:inline">Haut</span>
                  </button>
                  <button
                    onClick={() => handlePitchAdjust(-2)}
                    title="Baisser les yeux vers la vallée"
                    className="flex items-center gap-0.5 rounded-lg px-1.5 py-0.5 text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <ArrowDown size={11} />
                    <span className="hidden lg:inline">Bas</span>
                  </button>
                </div>

                <div className="mx-1 h-4 w-px bg-white/15" />

                {/* Hauteur du point de vue */}
                <div className="flex items-center gap-1 text-[11px] text-white/70 px-1">
                  <span className="hidden lg:inline text-white/50">Hauteur :</span>
                  {[
                    { val: 3, label: '3m' },
                    { val: 8, label: '8m' },
                    { val: 25, label: '25m' },
                  ].map((h) => (
                    <button
                      key={h.val}
                      onClick={() => handleEyeHeightChange(h.val)}
                      title={`Hauteur de vue +${h.val}m au-dessus du refuge`}
                      className={`rounded-lg px-2 py-0.5 text-xs font-medium transition-colors ${
                        eyeHeight === h.val
                          ? 'bg-white/20 text-white font-semibold'
                          : 'text-white/50 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      +{h.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              /* Commandes spécifiques au mode Orbite : Facteur de relief */
              <div className="flex items-center gap-1 text-[11px] text-white/70 px-1">
                <Mountain size={12} className="text-white/50" />
                <span className="hidden md:inline text-white/50">Relief :</span>
                {[1.0, 1.5, 2.0, 2.5].map((val) => (
                  <button
                    key={val}
                    onClick={() => handleExaggerationChange(val)}
                    className={`rounded-lg px-2 py-0.5 text-xs font-medium transition-colors ${
                      exaggeration === val
                        ? 'bg-white/20 text-white font-semibold'
                        : 'text-white/50 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {val}x
                  </button>
                ))}
              </div>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
