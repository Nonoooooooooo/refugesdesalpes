import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  LayerGroup,
  Marker,
  Tooltip,
  LayersControl,
  Pane,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
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
const IMAGERY_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const TOPO_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
const LABELS_URL =
  'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
const TRAILS_URL = 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'
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
            <Icon size={13} strokeWidth={2.4} />
          </div>,
        ),
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    )
  }
  return iconCache.get(cacheKey)
}

function clusterIcon(cluster) {
  const n = cluster.getChildCount()
  const size = n < 10 ? 30 : n < 50 ? 36 : 42
  return L.divIcon({
    className: 'refuge-marker',
    html: `<div class="refuge-cluster" style="width:${size}px;height:${size}px">${n}</div>`,
    iconSize: [size, size],
  })
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

  // Survol : on attend un court instant avant d'afficher l'info-bulle
  const [hoveredId, setHoveredId] = useState(null)
  const hoverTimer = useRef(null)
  const onHoverStart = (id) => {
    clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setHoveredId(id), 350)
  }
  const onHoverEnd = () => {
    clearTimeout(hoverTimer.current)
    setHoveredId(null)
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <MapContainer
        center={[45.9237, 6.8694]}
        zoom={11}
        zoomControl={false}
        className="h-full w-full"
      >
        {/* Panes: tuiles (200) < toponymie (250) < overlay (400) < marqueurs (600) */}
        <Pane name="labels" style={{ zIndex: 250, pointerEvents: 'none' }} />
        <LayersControl position="topright" collapsed={false}>
          <LayersControl.BaseLayer checked name="Satellite">
            <LayerGroup>
              <TileLayer
                attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics"
                url={IMAGERY_URL}
                maxZoom={18}
              />
              <TileLayer pane="labels" url={LABELS_URL} maxZoom={18} opacity={0.9} />
            </LayerGroup>
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Relief">
            <TileLayer
              attribution="Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, USGS, NPS"
              url={TOPO_URL}
              maxZoom={18}
            />
          </LayersControl.BaseLayer>
          <LayersControl.Overlay name="Sentiers de randonnée" checked={false}>
            <TileLayer
              pane="overlayPane"
              url={TRAILS_URL}
              attribution="Sentiers &copy; <a href='https://hiking.waymarkedtrails.org' target='_blank' rel='noreferrer'>Waymarked Trails</a>"
              opacity={0.85}
              maxZoom={18}
            />
          </LayersControl.Overlay>
        </LayersControl>
        <BboxLoader onData={handleData} onStatus={setStatus} reloadKey={reloadKey} />
        <FlyToSelected target={flyTarget} />
        <MapControls />
        <MarkerClusterGroup
          chunkedLoading
          showCoverageOnHover={false}
          maxClusterRadius={48}
          disableClusteringAtZoom={15}
          spiderfyOnMaxZoom
          iconCreateFunction={clusterIcon}
        >
          {visible.map((p) => (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={pinIcon(p.type, selected?.id === p.id)}
              eventHandlers={{
                click: () => selectPoint(p),
                mouseover: () => onHoverStart(p.id),
                mouseout: onHoverEnd,
              }}
            >
              {hoveredId === p.id && (
                <Tooltip permanent direction="top" offset={[0, -14]} className="refuge-tooltip">
                  <div className="refuge-tooltip-name">{p.nom}</div>
                  <div className="refuge-tooltip-meta">
                    <span style={{ background: typeInfo(p.type).color }} className="refuge-tooltip-dot" />
                    {p.alt != null ? `${p.alt} m` : 'Altitude inconnue'}
                    <span className="opacity-60"> · {typeInfo(p.type).label}</span>
                  </div>
                </Tooltip>
              )}
            </Marker>
          ))}
        </MarkerClusterGroup>
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
