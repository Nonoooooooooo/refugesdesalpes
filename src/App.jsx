import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, Pane, useMap, useMapEvents } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { renderToStaticMarkup } from 'react-dom/server'
import { Loader2, TriangleAlert, ZoomIn } from 'lucide-react'
import { fetchBbox } from './lib/api'
import { typeInfo, isPointClosed, FILTERABLE } from './lib/types.jsx'
import MapControls from './components/MapControls.jsx'
import Sidebar from './components/Sidebar.jsx'
import MapControlBar from './components/MapControlBar.jsx'
import SearchBar from './components/SearchBar.jsx'
import TransportLayer from './features/transport/TransportLayer.jsx'
import TransportSidebar from './features/transport/TransportSidebar.jsx'
import OverpassLayer from './features/overpass/OverpassLayer.jsx'
import WebcamLayer from './features/webcams/WebcamLayer.jsx'
import InfoFeedbackButton from './components/InfoFeedbackButton.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { trackEvent } from './lib/analytics'
import TraceLayer from './features/trace/TraceLayer.jsx'
import AromeLayer from './features/meteo/AromeLayer.jsx'
import AromeTimelinePlayer from './features/meteo/AromeTimelinePlayer.jsx'
import { fetchAromeCapabilities } from './features/meteo/aromeService'
import FavoritesModal from './components/FavoritesModal.jsx'
import { useFavorites } from './context/FavoritesContext.jsx'
import OfflineModal from './features/offline/OfflineModal.jsx'
import { useOfflineStatus } from './features/offline/useOfflineStatus.js'
import { getOfflineRefugesForBbox, getSavedZones, getSavedZonesMaxZoom } from './features/offline/offlineService.js'

const MIN_ZOOM_FETCH = 9
const IMAGERY_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const OPENTOPO_URL = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
const IGN_URL =
  'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'
const LABELS_URL =
  'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
const TRAILS_URL = 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'
const HAS_HOVER = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches
const iconCache = new Map()
const clusterIconCache = new Map()

function pinIcon(type, selected, etat, isFav = false) {
  const { color, Icon, key } = typeInfo(type)
  const closed = isPointClosed(etat)
  const cacheKey = `${key}-${selected}-${closed ? 'closed' : 'open'}-${isFav ? 'fav' : 'norm'}`
  if (!iconCache.has(cacheKey)) {
    iconCache.set(
      cacheKey,
      L.divIcon({
        className: 'refuge-marker',
        html: renderToStaticMarkup(
          <div
            className={`refuge-pin${selected ? ' selected' : ''}${closed ? ' closed' : ''}${isFav ? ' favorite' : ''}`}
            style={{
              background: closed ? '#64748b' : color,
              position: 'relative',
            }}
          >
            <Icon size={13} strokeWidth={2.4} />
            {closed && (
              <span className="refuge-pin-closed-badge" title="Fermé / Détruit">
                ✕
              </span>
            )}
            {isFav && (
              <span className="refuge-pin-heart" style={{ color: '#fbbf24', fontSize: '10px' }}>
                ★
              </span>
            )}
          </div>,
        ),
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    )
  }
  return iconCache.get(cacheKey)
}

/** Marqueur refuge haute performance mémoïsé (zéro re-render sur survol ou pan) */
const RefugeMarker = memo(function RefugeMarker({ point, isSelected, isFavorite, onSelect }) {
  const icon = useMemo(
    () => pinIcon(point.type, isSelected, point.etat, isFavorite),
    [point.type, isSelected, point.etat, isFavorite],
  )
  const closed = isPointClosed(point.etat)
  const info = typeInfo(point.type)
  const eventHandlers = useMemo(
    () => ({
      click: () => onSelect(point),
    }),
    [point, onSelect],
  )

  return (
    <Marker position={[point.lat, point.lng]} icon={icon} eventHandlers={eventHandlers}>
      {HAS_HOVER && (
        <Tooltip direction="top" offset={[0, -14]} className="refuge-tooltip">
          <div className="refuge-tooltip-name flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 truncate">
              <span>{point.nom}</span>
              {closed && (
                <span className="rounded bg-red-600/90 px-1 py-0.2 text-[9px] font-bold text-white uppercase tracking-wider shadow-sm">
                  {point.etat || 'Fermé'}
                </span>
              )}
            </div>
            {isFavorite && <span className="text-amber-300 font-bold text-xs shrink-0">★</span>}
          </div>
          <div className="refuge-tooltip-meta">
            <span
              style={{ background: closed ? '#ef4444' : info.color }}
              className="refuge-tooltip-dot"
            />
            {point.alt != null ? `${point.alt} m` : 'Altitude inconnue'}
            <span className="opacity-60"> · {info.label}</span>
          </div>
        </Tooltip>
      )}
    </Marker>
  )
})

function clusterIcon(cluster) {
  const n = cluster.getChildCount()
  const size = n < 10 ? 30 : n < 50 ? 36 : 42
  const cacheKey = `${n}_${size}`
  let icon = clusterIconCache.get(cacheKey)
  if (!icon) {
    icon = L.divIcon({
      className: 'refuge-marker',
      html: `<div class="refuge-cluster" style="width:${size}px;height:${size}px">${n}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    })
    clusterIconCache.set(cacheKey, icon)
  }
  return icon
}

/** Écoute `moveend` et ne charge que les points de l'étendue visible. */
function BboxLoader({ onData, onStatus, reloadKey, onMapChange }) {
  const map = useMap()
  const abortRef = useRef(null)
  const timerRef = useRef(null)

  const load = useCallback(() => {
    abortRef.current?.abort()
    const b = map.getBounds()
    onMapChange?.({ bounds: b, center: map.getCenter() })

    if (map.getZoom() < MIN_ZOOM_FETCH) {
      onStatus((prev) => (prev.tooFar && !prev.loading && !prev.error ? prev : { loading: false, error: null, tooFar: true }))
      return
    }
    const ctrl = new AbortController()
    abortRef.current = ctrl
    onStatus((prev) => (prev.loading && !prev.error && !prev.tooFar ? prev : { loading: true, error: null, tooFar: false }))
    fetchBbox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], ctrl.signal)
      .then((points) => {
        onData(points)
        onStatus({ loading: false, error: null, tooFar: false })
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return
        // Fallback automatique sur les refuges de la zone hors-ligne
        const offlinePoints = getOfflineRefugesForBbox([
          b.getWest(),
          b.getSouth(),
          b.getEast(),
          b.getNorth(),
        ])
        if (offlinePoints.length > 0) {
          onData(offlinePoints)
          onStatus({ loading: false, error: null, tooFar: false })
          return
        }
        if (!navigator.onLine) {
          onStatus({ loading: false, error: null, tooFar: false })
          return
        }
        onStatus({
          loading: false,
          error: e.message,
          tooFar: false,
        })
      })
  }, [map, onData, onStatus, onMapChange])

  const schedule = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(load, 300)
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
    if (target) {
      const zoom = target.zoom || Math.max(map.getZoom(), 12)
      map.flyTo([target.lat, target.lng], zoom, { duration: 0.8 })
    }
  }, [target, map])
  return null
}

export default function App() {
  const { favorites, isFavorite, toastMessage } = useFavorites()
  const [points, setPoints] = useState([])
  const [status, setStatus] = useState({ loading: false, error: null, tooFar: false })
  const [selected, setSelected] = useState(null)
  const [activeTypes, setActiveTypes] = useState(() => new Set(FILTERABLE.map((t) => t.key)))
  const [flyTarget, setFlyTarget] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [baseLayer, setBaseLayer] = useState('ign')
  const [showTrails, setShowTrails] = useState(false)
  const [showTransports, setShowTransports] = useState(false)
  const [showParkings, setShowParkings] = useState(false)
  const [showWebcams, setShowWebcams] = useState(false)
  const [showMeteo, setShowMeteo] = useState(false)
  const [showTrace, setShowTrace] = useState(false)
  const [tracePoints, setTracePoints] = useState([])
  const [aromeLayer, setAromeLayer] = useState('TOTAL_PRECIPITATION_RATE__GROUND_OR_WATER_SURFACE')
  const [aromeTimes, setAromeTimes] = useState([])
  const [aromeTime, setAromeTime] = useState('')
  const [aromeOpacity, setAromeOpacity] = useState(0.82)
  const [aromeLoading, setAromeLoading] = useState(false)

  // Chargement des échéances temporelles AROME-PI à l'activation
  useEffect(() => {
    if (!showMeteo) return
    let active = true
    const ctrl = new AbortController()

    fetchAromeCapabilities(ctrl.signal).then((data) => {
      if (!active || !data?.times?.length) return
      setAromeTimes(data.times)
      if (!aromeTime) {
        const nowMs = Date.now()
        let closest = data.times[0]
        let minDiff = Infinity
        for (const t of data.times) {
          const diff = Math.abs(new Date(t).getTime() - nowMs)
          if (diff < minDiff) {
            minDiff = diff
            closest = t
          }
        }
        setAromeTime(closest)
      }
    })

    return () => {
      active = false
      ctrl.abort()
    }
  }, [showMeteo, aromeTime])

  const [showFavoritesModal, setShowFavoritesModal] = useState(false)
  const [filterOnlyFavorites, setFilterOnlyFavorites] = useState(false)
  const { isOnline, isInstalled, isIos, installPromptReady, promptInstall } = useOfflineStatus()
  const [showOfflineModal, setShowOfflineModal] = useState(false)
  const [offlineMapState, setOfflineMapState] = useState(null)
  const mapStateRef = useRef(null)
  const [savedZonesCount, setSavedZonesCount] = useState(() => getSavedZones().length)
  const maxSavedZoom = useMemo(() => getSavedZonesMaxZoom(savedZonesCount), [savedZonesCount])

  const handleMapChange = useCallback((state) => {
    mapStateRef.current = state
  }, [])

  const handleStatus = useCallback((next) => {
    setStatus((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next
      if (
        prev.loading === resolved.loading &&
        prev.error === resolved.error &&
        prev.tooFar === resolved.tooFar
      ) {
        return prev
      }
      return resolved
    })
  }, [])

  // Cumule les points déjà vus avec détection de changement (évite tout re-render inutile si aucun nouveau point)
  const handleData = useCallback((incoming) => {
    setPoints((prev) => {
      let hasNew = false
      const map = new Map(prev.map((p) => [p.id, p]))
      for (const p of incoming) {
        if (!map.has(p.id)) {
          hasNew = true
          map.set(p.id, p)
        }
      }
      if (!hasNew) return prev
      const all = Array.from(map.values())
      return all.length > 1500 ? all.slice(-1500) : all
    })
  }, [])

  // Filtrage selon types et option "Favoris seuls"
  const visible = useMemo(() => {
    if (filterOnlyFavorites) {
      return favorites.filter((p) => activeTypes.has(typeInfo(p.type).key))
    }
    // Quand l'utilisateur a dézoomé au-delà du seuil (< 9), on masque les points massifs
    // pour garder un dézoom 100% fluide sur mobile et cohérent avec l'alerte "Zoomez pour afficher les refuges"
    if (status.tooFar) {
      return selected ? [selected] : []
    }
    return points.filter((p) => activeTypes.has(typeInfo(p.type).key))
  }, [points, activeTypes, filterOnlyFavorites, favorites, status.tooFar, selected])

  // Centrage automatique lors de l'activation du filtre favoris
  useEffect(() => {
    if (filterOnlyFavorites && favorites.length > 0) {
      if (favorites.length === 1) {
        setFlyTarget({ lat: favorites[0].lat, lng: favorites[0].lng, zoom: 13, t: Date.now() })
      } else {
        const avgLat = favorites.reduce((acc, f) => acc + f.lat, 0) / favorites.length
        const avgLng = favorites.reduce((acc, f) => acc + f.lng, 0) / favorites.length
        setFlyTarget({ lat: avgLat, lng: avgLng, zoom: 9, t: Date.now() })
      }
    }
  }, [filterOnlyFavorites, favorites])

  const toggleType = (key) =>
    setActiveTypes((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const selectPoint = useCallback((p) => {
    setSelected(p)
    setFlyTarget({ lat: p.lat, lng: p.lng, zoom: 13, t: Date.now() })
    trackEvent('select_content', { content_type: 'refuge', item_id: p.id, item_name: p.nom })
  }, [])

  const handleSelectRefuge = useCallback((refuge) => {
    setSelected(refuge)
    setFlyTarget({ lat: refuge.lat, lng: refuge.lng, zoom: 13, t: Date.now() })
    trackEvent('select_content', { content_type: 'refuge', item_id: refuge.id, item_name: refuge.nom })
    setPoints((prev) => {
      if (prev.some((p) => p.id === refuge.id)) return prev
      return [refuge, ...prev]
    })
  }, [])

  const handleSelectTransport = useCallback((t) => {
    setShowTransports(true)
    setSelected(t)
    trackEvent('select_content', { content_type: 'transport', item_name: t?.name || t?.nom || t?.mode || 'transport' })
    if (t?.skipFlyTo) return
    const lat = t?.centerLat || t?.lat
    const lng = t?.centerLng || t?.lng
    if (lat && lng) {
      setFlyTarget({ lat, lng, zoom: t.zoom || (t.mode === 'station' ? 13 : 11), t: Date.now() })
    }
  }, [])

  const handleSelectCity = useCallback((city) => {
    setFlyTarget({ lat: city.lat, lng: city.lng, zoom: 12, t: Date.now() })
  }, [])

  const handleOpenRefugeRadar = useCallback((refugePoint) => {
    setShowMeteo(true)
    trackEvent('select_content', { content_type: 'meteo_radar', item_id: refugePoint.id, item_name: refugePoint.nom })
    if (refugePoint.lat && refugePoint.lng) {
      setFlyTarget({ lat: refugePoint.lat, lng: refugePoint.lng, zoom: 11, t: Date.now() })
    }
  }, [])

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <MapContainer
        center={[45.9237, 6.8694]}
        zoom={11}
        minZoom={6}
        maxZoom={18}
        zoomControl={false}
        preferCanvas={true}
        zoomAnimation={true}
        zoomAnimationThreshold={4}
        fadeAnimation={true}
        markerZoomAnimation={true}
        bounceAtLimits={false}
        wheelDebounceTime={40}
        className="h-full w-full"
      >
        {/* Panes: tuiles (200) < toponymie (250) < overlay (400) < marqueurs (600) */}
        <Pane name="labels" style={{ zIndex: 250, pointerEvents: 'none' }} />
        {baseLayer === 'satellite' && (
          <>
            <TileLayer
              key="sat"
              attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics"
              url={IMAGERY_URL}
              maxZoom={18}
              keepBuffer={2}
              updateWhenZooming={false}
              updateWhenIdle={true}
            />
            <TileLayer
              key="labels"
              pane="labels"
              url={LABELS_URL}
              maxZoom={18}
              opacity={0.9}
              keepBuffer={2}
              updateWhenZooming={false}
              updateWhenIdle={true}
            />
          </>
        )}
        {(baseLayer === 'opentopo' || baseLayer === 'relief') && (
          <TileLayer
            key="opentopo"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors, SRTM | Style: &copy; <a href="https://opentopomap.org" target="_blank" rel="noreferrer">OpenTopoMap</a>'
            url={OPENTOPO_URL}
            subdomains={['a', 'b', 'c']}
            maxNativeZoom={!isOnline ? (maxSavedZoom || 16) : 17}
            maxZoom={18}
            keepBuffer={2}
            updateWhenZooming={false}
            updateWhenIdle={true}
          />
        )}
        {(baseLayer === 'ign' || baseLayer === 'cyclosm') && (
          <TileLayer
            key="ign"
            attribution='&copy; <a href="https://geoservices.ign.fr/" target="_blank" rel="noreferrer">IGN - Géoplateforme</a>'
            url={IGN_URL}
            maxNativeZoom={!isOnline ? (maxSavedZoom || 16) : 18}
            maxZoom={18}
            keepBuffer={2}
            updateWhenZooming={false}
            updateWhenIdle={true}
          />
        )}
        {showTrails && (
          <TileLayer
            key="trails"
            pane="overlayPane"
            url={TRAILS_URL}
            attribution="Sentiers &copy; <a href='https://hiking.waymarkedtrails.org' target='_blank' rel='noreferrer'>Waymarked Trails</a>"
            opacity={0.85}
            maxZoom={18}
            keepBuffer={2}
            updateWhenZooming={false}
            updateWhenIdle={true}
          />
        )}
        <TransportLayer
          active={showTransports}
          onSelectTransport={handleSelectTransport}
          selectedTransport={selected?.isTransport ? selected : null}
        />
        <OverpassLayer showParkings={showParkings} />
        <WebcamLayer active={showWebcams} />
        <AromeLayer
          active={showMeteo}
          layerId={aromeLayer}
          time={aromeTime}
          opacity={aromeOpacity}
          onLoadingChange={setAromeLoading}
        />
        <BboxLoader
          onData={handleData}
          onStatus={handleStatus}
          reloadKey={reloadKey}
          onMapChange={handleMapChange}
        />
        <FlyToSelected target={flyTarget} />
        <MapControls hasSelected={Boolean(selected)} />
        <TraceLayer
          active={showTrace}
          points={tracePoints}
          onChange={setTracePoints}
          onClose={() => setShowTrace(false)}
        />
        <MarkerClusterGroup
          chunkedLoading
          chunkInterval={200}
          chunkDelay={10}
          showCoverageOnHover={false}
          maxClusterRadius={(zoom) => (zoom >= 13 ? 30 : zoom >= 11 ? 42 : 52)}
          disableClusteringAtZoom={14}
          spiderfyOnMaxZoom
          animate={HAS_HOVER}
          animateAddingMarkers={false}
          removeOutsideVisibleBounds={true}
          iconCreateFunction={clusterIcon}
        >
          {visible.map((p) => (
            <RefugeMarker
              key={p.id}
              point={p}
              isSelected={selected?.id === p.id}
              isFavorite={isFavorite(p.id)}
              onSelect={selectPoint}
            />
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      <SearchBar
        onSelectRefuge={handleSelectRefuge}
        onSelectTransport={handleSelectTransport}
        onSelectCity={handleSelectCity}
        hasSelected={Boolean(selected)}
      />

      <MapControlBar
        baseLayer={baseLayer}
        onBaseLayerChange={setBaseLayer}
        showTrails={showTrails}
        onToggleTrails={() => setShowTrails((v) => !v)}
        showTransports={showTransports}
        onToggleTransports={() => setShowTransports((v) => !v)}
        showParkings={showParkings}
        onToggleParkings={() => setShowParkings((v) => !v)}
        showWebcams={showWebcams}
        onToggleWebcams={() => setShowWebcams((v) => !v)}
        showMeteo={showMeteo}
        onToggleMeteo={() => {
          setShowMeteo((v) => {
            const next = !v
            if (next) trackEvent('toggle_layer', { layer: 'arome_meteo', state: 'on' })
            return next
          })
        }}
        showTrace={showTrace}
        onToggleTrace={() => {
          setShowTrace((v) => {
            const next = !v
            if (next) trackEvent('toggle_layer', { layer: 'trace', state: 'on' })
            return next
          })
        }}
        activeTypes={activeTypes}
        onToggleType={toggleType}
        onOpenFavorites={() => setShowFavoritesModal(true)}
        filterOnlyFavorites={filterOnlyFavorites}
        onToggleFilterOnlyFavorites={() => setFilterOnlyFavorites((v) => !v)}
        onOpenOffline={() => {
          setOfflineMapState(mapStateRef.current)
          setShowOfflineModal(true)
        }}
        isOnline={isOnline}
        savedZonesCount={savedZonesCount}
      />

      {/* Toast discret pour les favoris */}
      {toastMessage && (
        <div className="pointer-events-none fixed top-20 left-1/2 z-[1300] -translate-x-1/2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="glass flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-black/85 px-4 py-2 text-xs font-medium text-amber-200 shadow-2xl backdrop-blur-xl">
            <span className="text-amber-400 font-bold">★</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Modal des favoris */}
      <FavoritesModal
        isOpen={showFavoritesModal}
        onClose={() => setShowFavoritesModal(false)}
        onSelectRefuge={handleSelectRefuge}
        filterOnlyFavorites={filterOnlyFavorites}
        onToggleFilterOnlyFavorites={() => setFilterOnlyFavorites((v) => !v)}
      />

      {/* Modal Hors-ligne & PWA */}
      <OfflineModal
        isOpen={showOfflineModal}
        onClose={() => {
          setShowOfflineModal(false)
          setSavedZonesCount(getSavedZones().length)
        }}
        mapBounds={offlineMapState?.bounds}
        mapCenter={offlineMapState?.center}
        onFlyToZone={(target) => {
          if (Array.isArray(target) && target.length === 4) {
            const [w, s, e, n] = target
            setFlyTarget({ lat: (s + n) / 2, lng: (w + e) / 2, zoom: 12, t: Date.now() })
          } else if (target?.lat && target?.lng) {
            setFlyTarget({ lat: target.lat, lng: target.lng, zoom: target.zoom || 13, t: Date.now() })
          }
        }}
        isOnline={isOnline}
        isInstalled={isInstalled}
        isIos={isIos}
        installPromptReady={installPromptReady}
        onPromptInstall={promptInstall}
      />

      <InfoFeedbackButton hasSelected={Boolean(selected)} />

      {/* Lecteur et contrôles d'animation AROME-PI */}
      {showMeteo && (
        <AromeTimelinePlayer
          times={aromeTimes}
          selectedTime={aromeTime}
          onTimeChange={setAromeTime}
          selectedLayer={aromeLayer}
          onLayerChange={setAromeLayer}
          opacity={aromeOpacity}
          onOpacityChange={setAromeOpacity}
          onClose={() => setShowMeteo(false)}
          isLoading={aromeLoading}
          hasSelected={Boolean(selected)}
        />
      )}

      {/* Statut discret (masqué en mode tracé, dont le panneau occupe la même place) */}
      <div
        className={`pointer-events-none absolute left-1/2 z-[1000] -translate-x-1/2 transition-all duration-300 ${
          showTrace ? 'hidden' : ''
        } ${
          showMeteo
            ? 'bottom-[calc(11.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-6'
            : 'bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-6'
        }`}
      >
        {isOnline && filterOnlyFavorites && (
          <div className="glass flex items-center gap-2 rounded-full border border-amber-400/35 bg-black/80 px-4 py-2 text-xs font-medium text-amber-200 shadow-xl backdrop-blur-xl">
            <span className="text-amber-400 font-bold">★</span>
            <span>Mode favoris : {visible.length} refuge(s) affiché(s)</span>
          </div>
        )}
        {isOnline && !filterOnlyFavorites && status.loading && (
          <div className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm">
            <Loader2 size={16} className="animate-spin" /> Chargement des refuges…
          </div>
        )}
        {isOnline && !filterOnlyFavorites && status.tooFar && !status.loading && (
          <div className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm">
            <ZoomIn size={16} /> Zoomez pour afficher les refuges
          </div>
        )}
        {isOnline && status.error && !status.loading && (
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

      {selected && (
        <ErrorBoundary onReset={() => setSelected(null)}>
          {selected.isTransport ? (
            <TransportSidebar
              transport={selected}
              onClose={() => setSelected(null)}
              onSelectTransport={handleSelectTransport}
            />
          ) : (
            <Sidebar
              point={selected}
              onClose={() => setSelected(null)}
              onOpenRadar={handleOpenRefugeRadar}
            />
          )}
        </ErrorBoundary>
      )}
    </div>
  )
}
