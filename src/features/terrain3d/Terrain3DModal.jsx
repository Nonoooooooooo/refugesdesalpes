import React, { useState, useRef, useEffect, useMemo } from 'react'
import Map, { NavigationControl, Marker } from 'react-map-gl/maplibre'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { X, RotateCw, Mountain, Compass, Maximize2, Minimize2, Eye } from 'lucide-react'
import { typeInfo } from '../../lib/types.jsx'

export default function Terrain3DModal({ point, onClose }) {
  const mapRef = useRef(null)
  const [isRotating, setIsRotating] = useState(false)
  const [exaggeration, setExaggeration] = useState(1.5)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const modalRef = useRef(null)

  const { color, Icon, label } = typeInfo(point?.type)

  // Style JSON MapLibre configuré avec Esri Satellite + MNT Terrarium AWS
  const mapStyle = useMemo(
    () => ({
      version: 8,
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          maxzoom: 18,
          attribution: '&copy; Esri, Maxar, Earthstar Geographics',
        },
        'aws-terrarium-dem': {
          type: 'raster-dem',
          tiles: [
            'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          encoding: 'terrarium',
          maxzoom: 15,
        },
      },
      layers: [
        {
          id: 'esri-satellite-layer',
          type: 'raster',
          source: 'esri-satellite',
          minzoom: 0,
          maxzoom: 22,
        },
      ],
      terrain: {
        source: 'aws-terrarium-dem',
        exaggeration: exaggeration,
      },
    }),
    [exaggeration]
  )

  // Gestion de la touche Échap
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Mise à jour explicite du terrain lors du changement d'exagération
  useEffect(() => {
    if (mapRef.current) {
      const map = mapRef.current.getMap()
      if (map && map.loaded()) {
        try {
          map.setTerrain({ source: 'aws-terrarium-dem', exaggeration })
        } catch (e) {
          console.warn('MapLibre setTerrain error:', e)
        }
      }
    }
  }, [exaggeration])

  const handleMapLoad = useCallback((evt) => {
    const map = evt.target
    try {
      map.setTerrain({ source: 'aws-terrarium-dem', exaggeration })
    } catch (e) {
      console.warn('Error applying 3D terrain on load:', e)
    }
  }, [exaggeration])

  // Animation de rotation automatique fluide autour du sommet/refuge
  useEffect(() => {
    let animFrame
    const rotateCamera = () => {
      if (!isRotating || !mapRef.current) return
      const map = mapRef.current.getMap()
      const currentBearing = map.getBearing()
      map.setBearing((currentBearing + 0.35) % 360)
      animFrame = requestAnimationFrame(rotateCamera)
    }

    if (isRotating) {
      animFrame = requestAnimationFrame(rotateCamera)
    }
    return () => cancelAnimationFrame(animFrame)
  }, [isRotating])

  // Bascule Plein écran
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      modalRef.current?.requestFullscreen?.().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.().catch(() => {})
      setIsFullscreen(false)
    }
  }

  // Réinitialiser la vue
  const resetCamera = () => {
    if (!mapRef.current) return
    const map = mapRef.current.getMap()
    map.flyTo({
      center: [point.lng, point.lat],
      zoom: 14,
      pitch: 70,
      bearing: 45,
      essential: true,
      duration: 1200,
    })
  }

  if (!point) return null

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-neutral-900/90 shadow-2xl backdrop-blur-2xl">
        {/* ─── Header de la modale ─── */}
        <header className="absolute left-4 right-4 top-4 z-20 flex items-center justify-between pointer-events-none">
          <div className="pointer-events-auto glass flex items-center gap-3 rounded-2xl px-4 py-2.5 shadow-2xl backdrop-blur-xl">
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
                  Vue 3D
                </span>
              </div>
              <p className="text-xs text-white/70">
                {point.alt ? `${point.alt} m` : ''} {point.alt && point.type ? '·' : ''} {label || point.type}
              </p>
            </div>
          </div>

          {/* Boutons d'actions en haut à droite */}
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              title="Plein écran"
              className="glass-btn rounded-xl p-2.5 text-white/80 hover:text-white bg-black/40 backdrop-blur-xl border border-white/10"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              onClick={onClose}
              title="Fermer (Échap)"
              className="glass-btn rounded-xl p-2.5 text-white hover:bg-red-500/30 hover:border-red-400/40 bg-black/40 backdrop-blur-xl border border-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* ─── Carte 3D MapLibre ─── */}
        <div className="relative h-full w-full">
          <Map
            ref={mapRef}
            mapLib={maplibregl}
            initialViewState={{
              longitude: point.lng,
              latitude: point.lat,
              zoom: 14,
              pitch: 70,
              bearing: 45,
            }}
            maxPitch={85}
            mapStyle={mapStyle}
            terrain={{ source: 'aws-terrarium-dem', exaggeration }}
            onLoad={handleMapLoad}
            style={{ width: '100%', height: '100%' }}
            attributionControl={false}
          >
            <NavigationControl position="bottom-right" visualizePitch />

            {/* Marqueur 3D épinglé sur le relief */}
            <Marker
              longitude={point.lng}
              latitude={point.lat}
              anchor="bottom"
            >
              <div className="group relative flex flex-col items-center cursor-pointer">
                {/* Badge étiquette */}
                <div
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-white shadow-xl backdrop-blur-md border border-white/40 transform transition hover:scale-105"
                  style={{ background: color }}
                >
                  <Icon size={12} />
                  <span>{point.nom}</span>
                  {point.alt && <span className="opacity-80">({point.alt}m)</span>}
                </div>
                {/* Flèche d'ancrage */}
                <div
                  className="h-2 w-2 rotate-45 transform -mt-1 shadow-md border-r border-b border-white/30"
                  style={{ background: color }}
                />
                {/* Impulsion visuelle */}
                <span
                  className="absolute -bottom-1 h-3 w-3 animate-ping rounded-full opacity-60"
                  style={{ background: color }}
                />
              </div>
            </Marker>
          </Map>
        </div>

        {/* ─── Barre de commandes 3D en bas ─── */}
        <footer className="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-2 pointer-events-none">
          <div className="pointer-events-auto glass flex items-center gap-1.5 rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl bg-black/50 border border-white/10">
            {/* Bouton Orbite / Rotation */}
            <button
              onClick={() => setIsRotating((r) => !r)}
              title={isRotating ? 'Arrêter la rotation 360°' : 'Démarrer la rotation panoramique 360°'}
              className={`glass-btn flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                isRotating
                  ? 'border border-amber-400/60 bg-amber-500/35 text-amber-200 ring-1 ring-amber-400/30'
                  : 'bg-white/10 text-white/80 hover:text-white'
              }`}
            >
              <RotateCw size={13} className={isRotating ? 'animate-spin' : ''} />
              <span>{isRotating ? 'Pause rotation' : 'Rotation 360°'}</span>
            </button>

            {/* Bouton Réinitialiser la vue */}
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
              {[1.0, 1.5, 2.0].map((val) => (
                <button
                  key={val}
                  onClick={() => setExaggeration(val)}
                  className={`rounded-lg px-2 py-0.5 text-xs font-medium transition-colors ${
                    exaggeration === val
                      ? 'bg-white/25 text-white font-bold'
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
