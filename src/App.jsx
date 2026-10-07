import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, LayersControl, Pane, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { renderToStaticMarkup } from 'react-dom/server'
import { Loader2, TriangleAlert, ZoomIn } from 'lucide-react'
import { fetchBbox } from './lib/api'
import { typeInfo, FILTERABLE } from './lib/types.jsx'
import MapControls from './components/MapControls.jsx'
import FilterPanel from './components/FilterPanel.jsx'
import Sidebar from './components/Sidebar.jsx'

const MIN_ZOOM_FETCH = 9
const CONTOURS_URL = 'https://tiles.opensnowmap.org/contours/{z}/{x}/{y}.png'
const LABELS_URL =
  'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
const iconCache = new Map()

function pinIcon(type, selected) {
  const { color, Icon, key } = typeInfo(type)
  const cacheKey = `${key}-${selected}`
  if (!iconCache.has(cacheKey)) {
    iconCache.set(
      cacheKey,
      L.divIcon({
        className: 'refuge-marker',
        html: renderToStaticMarkup(
          <div className={`refuge-pin${selected ? ' selected' : ''}`} style={{ background: color }}>
            <Icon size={18} strokeWidth={2.2} />
          </div>,
        ),
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      }),
    )
  }
  return iconCache.get(cacheKey)
}

/** Écoute `moveend` et ne charge que les points de l'étendue visible. */
function BboxLoader({ onData, onStatus, reloadKey }) {
  const map = useMap()
  const abortRef = useRef(null)
  const timerRef = useRef(null)

  const load = useCallback(() => {
    abortRef.current?.abort()
    if (map.getZoom() < MIN_ZOOM_FETCH) {
      onStatus({ loading: false, error: null, tooFar: true })
      return
    }
    const b = map.getBounds()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    onStatus({ loading: true, error: null, tooFar: false })
    fetchBbox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], ctrl.signal)
      .then((points) => {
        onData(points)
        onStatus({ loading: false, error: null, tooFar: false })
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return
        onStatus({ loading: false, error: e.message, tooFar: false })
      })
  }, [map, onData, onStatus])

  const schedule = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(load, 250)
  }, [load])

  useMapEvents({ moveend: schedule })

  useEffect(() => {
    load()
    return () => {
      clearTimeout(timerRef.current)
      abortRef.current?.abort()
    }
  }, [load, reloadKey])

  return null
}

function FlyToSelected({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 12), { duration: 0.8 })
  }, [target, map])
  return null
}

export default function App() {
  const [points, setPoints] = useState([])
  const [status, setStatus] = useState({ loading: false, error: null, tooFar: false })
  const [selected, setSelected] = useState(null)
  const [activeTypes, setActiveTypes] = useState(() => new Set(FILTERABLE.map((t) => t.key)))
  const [flyTarget, setFlyTarget] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Cumule les points déjà vus pour éviter le scintillement, borne la taille.
  const handleData = useCallback((incoming) => {
    setPoints((prev) => {
      const map = new Map(prev.slice(-1500).map((p) => [p.id, p]))
      incoming.forEach((p) => map.set(p.id, p))
      return [...map.values()]
    })
  }, [])

  const visible = useMemo(
    () => points.filter((p) => activeTypes.has(typeInfo(p.type).key)),
    [points, activeTypes],
  )

  const toggleType = (key) =>
    setActiveTypes((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const selectPoint = (p) => {
    setSelected(p)
    setFlyTarget({ lat: p.lat, lng: p.lng, t: Date.now() })
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <MapContainer
        center={[45.9237, 6.8694]}
        zoom={11}
        zoomControl={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={18}
        />
        {/* Panes: tuiles (200) < contours (240) < toponymie (250) < overlay (400) < marqueurs (600) */}
        <Pane name="contours" style={{ zIndex: 240 }} />
        <Pane name="labels" style={{ zIndex: 250, pointerEvents: 'none' }} />
        <TileLayer
          pane="labels"
          url={LABELS_URL}
          maxZoom={18}
          opacity={0.9}
          zIndex={250}
        />
        <LayersControl position="bottomright">
          <LayersControl.Overlay name="Courbes de niveau">
            <TileLayer
              pane="contours"
              url={CONTOURS_URL}
              opacity={0.6}
              maxZoom={18}
              attribution="Contours &copy; OpenSnowMap"
            />
          </LayersControl.Overlay>
        </LayersControl>
        <BboxLoader onData={handleData} onStatus={setStatus} reloadKey={reloadKey} />
        <FlyToSelected target={flyTarget} />
        <MapControls />
        {visible.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={pinIcon(p.type, selected?.id === p.id)}
            title={p.nom}
            eventHandlers={{ click: () => selectPoint(p) }}
          />
        ))}
      </MapContainer>

      <FilterPanel active={activeTypes} onToggle={toggleType} />

      {/* Statut discret */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 z-[1000] -translate-x-1/2">
        {status.loading && (
          <div className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm">
            <Loader2 size={16} className="animate-spin" /> Chargement des refuges…
          </div>
        )}
        {status.tooFar && !status.loading && (
          <div className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm">
            <ZoomIn size={16} /> Zoomez pour afficher les refuges
          </div>
        )}
        {status.error && !status.loading && (
          <div className="glass pointer-events-auto flex items-center gap-3 rounded-2xl border-red-400/50 px-4 py-2 text-sm">
            <TriangleAlert size={16} className="text-red-300" />
            <span>{status.error}</span>
            <button
              className="glass-btn rounded-full bg-white/10 px-3 py-1 text-xs font-medium"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              Réessayer
            </button>
          </div>
        )}
      </div>

      {selected && <Sidebar point={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
