import React, { useState, useRef, useEffect } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { X, RotateCw, Mountain, Compass, Maximize2, Minimize2, Loader2, Satellite, Map as MapIcon } from 'lucide-react'
import { typeInfo } from '../../lib/types.jsx'

export default function Terrain3DModal({ point, onClose }) {
  const containerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [isRotating, setIsRotating] = useState(false)
  const [exaggeration, setExaggeration] = useState(1.5)
  const [base3d, setBase3d] = useState('outdoor') // 'outdoor' ou 'satellite'
  const [isFullscreen, setIsFullscreen] = useState(false)
  const modalRef = useRef(null)
  const animFrameRef = useRef(null)

  const { color, Icon, label } = typeInfo(point?.type)

  // Initialisation de la carte MapLibre 3D avec Mapterhorn DEM
  useEffect(() => {
    if (!containerRef.current || !point) return

    // Style MapLibre utilisant Mapterhorn (DEM Terrarium haute fidélité pour les Alpes)
    const style = {
      version: 8,
      sources: {
        'mapterhorn-dem': {
          type: 'raster-dem',
          url: 'https://tiles.mapterhorn.com/tilejson.json',
          tileSize: 512,
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
          tiles: [
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          ],
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
          source: 'mapterhorn-dem',
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

    // Contrôles de navigation (boussole, inclinaison, zoom)
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

      // Marqueur HTML 3D personnalisé avec ancre
      try {
        const el = document.createElement('div')
        el.className = 'group relative flex flex-col items-center cursor-pointer pointer-events-auto'
        el.innerHTML = `
          <div style="background: ${color}" class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-2xl border-2 border-white/90 backdrop-blur-md">
            <span>${point.nom || 'Point'}</span>
            ${point.alt ? `<span class="opacity-90 font-normal">(${point.alt}m)</span>` : ''}
          </div>
          <div style="background: ${color}" class="h-2.5 w-2.5 rotate-45 transform -mt-1.5 shadow-md border-r-2 border-b-2 border-white/80"></div>
          <div style="background: ${color}" class="h-2 w-2 rounded-full mt-0.5 opacity-80 ring-2 ring-white"></div>
        `

        new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([point.lng, point.lat])
          .addTo(map)
      } catch (e) {
        console.warn('Marker creation error:', e)
      }
    })

    return () => {
      clearTimeout(safetyTimer)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      map.remove()
      mapInstanceRef.current = null
    }
  }, [point, color])

  // Changement de fond de carte (Satellite vs Carte Topo OSM)
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
      if (map.getLayer('outdoor-layer')) map.setLayoutProperty('outdoor-layer', 'visibility', 'visible')
      if (map.getLayer('hillshade-layer')) map.setLayoutProperty('hillshade-layer', 'visibility', 'visible')
    }
  }

  // Ajustement dynamique de l'exagération du relief
  const handleExaggerationChange = (val) => {
    setExaggeration(val)
    const map = mapInstanceRef.current
    if (map) {
      try {
        map.setTerrain({ source: 'mapterhorn-dem', exaggeration: val })
      } catch (err) {
        console.warn('setTerrain error:', err)
      }
    }
  }

  // Animation de rotation 360° fluide
  useEffect(() => {
    const rotate = () => {
      const map = mapInstanceRef.current
      if (!isRotating || !map) return
      const currentBearing = map.getBearing()
      map.setBearing((currentBearing + 0.3) % 360)
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
  }, [isRotating])

  // Gestion de la touche Échap
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Recentrer la vue
  const resetCamera = () => {
    const map = mapInstanceRef.current
    if (!map) return
    map.flyTo({
      center: [point.lng, point.lat],
      zoom: 13.5,
      pitch: 72,
      bearing: 45,
      essential: true,
      duration: 1200,
    })
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

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-neutral-950 shadow-2xl backdrop-blur-2xl">
        {/* ─── Header de la modale ─── */}
        <header className="absolute left-4 right-4 top-4 z-20 flex items-center justify-between pointer-events-none">
          <div className="pointer-events-auto glass flex items-center gap-3 rounded-2xl px-4 py-2.5 shadow-2xl backdrop-blur-xl bg-black/55 border border-white/10">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-md"
              style={{ background: color }}
            >
              <Icon size={18} className="text-white" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  {point.nom || 'Point 3D'}
                </h2>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                  Vue 3D Mapterhorn
                </span>
              </div>
              <p className="text-xs text-white/70">
                {point.alt ? `${point.alt} m` : ''} {point.alt && point.type ? '·' : ''} {label || point.type}
              </p>
            </div>
          </div>

          {/* Actions : Bascule Carte/Satellite, Plein écran & Fermer */}
          <div className="pointer-events-auto flex items-center gap-2">
            {/* Sélecteur Carte / Satellite 3D */}
            <div className="flex rounded-xl bg-black/50 p-1 border border-white/10 backdrop-blur-xl">
              <button
                onClick={() => handleBaseChange('outdoor')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  base3d === 'outdoor'
                    ? 'bg-white/20 text-white font-semibold shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <MapIcon size={13} />
                <span className="hidden sm:inline">Carte Topo</span>
              </button>
              <button
                onClick={() => handleBaseChange('satellite')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  base3d === 'satellite'
                    ? 'bg-white/20 text-white font-semibold shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Satellite size={13} />
                <span className="hidden sm:inline">Satellite</span>
              </button>
            </div>

            <button
              onClick={toggleFullscreen}
              title="Plein écran"
              className="glass-btn rounded-xl p-2.5 text-white/80 hover:text-white bg-black/50 backdrop-blur-xl border border-white/10"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              onClick={onClose}
              title="Fermer (Échap)"
              className="glass-btn rounded-xl p-2.5 text-white hover:bg-red-500/30 hover:border-red-400/40 bg-black/50 backdrop-blur-xl border border-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* ─── Conteneur MapLibre WebGL ─── */}
        <div className="relative h-full w-full bg-neutral-950">
          <div ref={containerRef} className="h-full w-full" />

          {loading && (
            <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full bg-black/60 px-3.5 py-1.5 text-xs text-white/80 backdrop-blur-md border border-white/10">
              <Loader2 size={13} className="animate-spin text-emerald-400" />
              <span>Chargement du relief 3D…</span>
            </div>
          )}
        </div>

        {/* ─── Barre de commandes 3D en bas ─── */}
        <footer className="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-2 pointer-events-none">
          <div className="pointer-events-auto glass flex items-center gap-1.5 rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl bg-black/60 border border-white/10">
            {/* Bouton Orbite / Rotation */}
            <button
              onClick={() => setIsRotating((r) => !r)}
              title={isRotating ? 'Arrêter la rotation 360°' : 'Démarrer la rotation panoramique 360°'}
              className={`glass-btn flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                isRotating
                  ? 'border border-amber-400/60 bg-amber-500/35 text-amber-200 ring-1 ring-amber-400/30 font-semibold'
                  : 'bg-white/10 text-white/80 hover:text-white'
              }`}
            >
              <RotateCw size={13} className={isRotating ? 'animate-spin' : ''} />
              <span>{isRotating ? 'Pause rotation' : 'Rotation 360°'}</span>
            </button>

            {/* Bouton Recentrer */}
            <button
              onClick={resetCamera}
              title="Recentrer et réinitialiser l'angle de vue"
              className="glass-btn flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 hover:text-white"
            >
              <Compass size={13} />
              <span className="hidden sm:inline">Recentrer</span>
            </button>

            <div className="mx-1 h-4 w-px bg-white/15" />

            {/* Sélecteur de relief / exagération */}
            <div className="flex items-center gap-1 text-[11px] text-white/70 px-1">
              <Mountain size={12} className="text-white/60" />
              <span className="hidden md:inline">Relief :</span>
              {[1.0, 1.5, 2.0, 2.5].map((val) => (
                <button
                  key={val}
                  onClick={() => handleExaggerationChange(val)}
                  className={`rounded-lg px-2 py-0.5 text-xs font-medium transition-colors ${
                    exaggeration === val
                      ? 'bg-white/25 text-white font-bold ring-1 ring-white/20'
                      : 'text-white/50 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {val}x
                </button>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
