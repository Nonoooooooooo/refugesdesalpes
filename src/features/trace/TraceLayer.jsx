import { useEffect, useMemo, useRef, useState } from 'react'
import { useMap, useMapEvents, Marker, Polyline, CircleMarker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { Undo2, Eraser, Move, Trash, X, ChevronDown, ChevronUp, Footprints } from 'lucide-react'
import { useTraceProfile } from './useTraceProfile'
import { useHikingPath } from './useHikingPath'
import { slopeClass, hikingTimeHours } from './profile'
import TraceProfile, { SampleReadout } from './TraceProfile.jsx'

const LONG_PRESS_MS = 450
const MOVE_TOLERANCE_PX = 10
const HAS_FINE_POINTER = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches
const ACCENT = '#ffaa00'
const NO_POINTS = []
// Tolérance autour du trait pour afficher la bulle : plus large au doigt qu'à la souris
const LINE_HOVER_PX = 12
const LINE_TAP_PX = 22

function pointIcon(index, total, selected, moving) {
  const role = index === 0 ? ' start' : index === total - 1 ? ' end' : ''
  const state = moving ? ' selected moving' : selected ? ' selected' : ''
  return L.divIcon({
    className: 'trace-marker',
    html: `<div class="trace-point${role}${state}" data-trace-idx="${index}"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

// Vrai pour la carte elle-même (tuiles, marqueurs, fond pas encore chargé), faux pour les boutons posés par-dessus
function isOnMap(target, container) {
  return target === container || Boolean(target.closest?.('.leaflet-map-pane'))
}

/**
 * Index de l'échantillon du profil le plus proche d'un point écran, s'il est à moins de `maxPx` du trait.
 * La distance est mesurée au segment, pour ne pas laisser de trous entre deux échantillons à fort zoom.
 */
function nearestSampleOnScreen(map, samples, point, maxPx) {
  let best = null
  let bestDist = maxPx
  let prev = map.latLngToContainerPoint([samples[0].lat, samples[0].lng])
  for (let i = 1; i < samples.length; i++) {
    const cur = map.latLngToContainerPoint([samples[i].lat, samples[i].lng])
    const dx = cur.x - prev.x
    const dy = cur.y - prev.y
    const len2 = dx * dx + dy * dy
    const t = len2 ? Math.max(0, Math.min(1, ((point.x - prev.x) * dx + (point.y - prev.y) * dy) / len2)) : 0
    const d = Math.hypot(point.x - (prev.x + t * dx), point.y - (prev.y + t * dy))
    if (d < bestDist) {
      bestDist = d
      best = t < 0.5 ? i - 1 : i
    }
    prev = cur
  }
  return best
}

function formatDistance(m) {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} km`
}

// Arrondi au quart d'heure, comme sur les panneaux
function formatDuration(hours) {
  const quarters = Math.max(1, Math.round(hours * 4))
  const h = Math.floor(quarters / 4)
  const min = (quarters % 4) * 15
  if (!h) return `${min} min`
  return min ? `${h} h ${String(min).padStart(2, '0')}` : `${h} h`
}

function TracePoint({ point, index, total, selected, moving, interactive, onSelect, onDragEnd, pointerTypeRef }) {
  const icon = useMemo(() => pointIcon(index, total, selected, moving), [index, total, selected, moving])
  const eventHandlers = useMemo(
    () => ({
      // Souris : un clic sélectionne le point. Au doigt, c'est l'appui long qui s'en charge.
      click: () => {
        if (pointerTypeRef.current === 'mouse') onSelect(index)
      },
      dragend: (e) => onDragEnd(index, e.target.getLatLng()),
    }),
    [index, onSelect, onDragEnd, pointerTypeRef],
  )
  return (
    <Marker
      position={[point.lat, point.lng]}
      icon={icon}
      draggable={interactive && (HAS_FINE_POINTER || moving)}
      interactive={interactive}
      keyboard={false}
      zIndexOffset={selected ? 1000 : 500}
      eventHandlers={eventHandlers}
    />
  )
}

/**
 * Tracé d'un itinéraire sur la carte.
 * PC : clic pour placer un point, clic sur un point pour le sélectionner, glisser pour le déplacer.
 * Mobile : appui long pour placer un point, appui long sur un point pour le déplacer ou le supprimer.
 */
export default function TraceLayer({ active, points, onChange, onClose }) {
  const map = useMap()
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [moving, setMoving] = useState(false)
  const [pressFx, setPressFx] = useState(null)
  const [prevActive, setPrevActive] = useState(active)
  const pointerTypeRef = useRef('mouse')
  const uiRef = useRef(null)

  // En quittant le mode tracé, on oublie la sélection en cours
  if (active !== prevActive) {
    setPrevActive(active)
    if (!active) {
      setSelectedIdx(null)
      setMoving(false)
    }
  }

  // Les points posés sont des étapes : en mode « sentiers », le tracé affiché et analysé suit les chemins entre elles
  const [snapToTrails, setSnapToTrails] = useState(true)
  const hiking = useHikingPath(points, snapToTrails)
  const routing = hiking.status === 'loading'
  const line = hiking.line
  // Le profil n'analyse que le tracé définitif, pour ne pas interroger l'IGN sur des lignes droites provisoires
  const profileState = useTraceProfile(hiking.complete ? line : NO_POINTS)
  const [showProfile, setShowProfile] = useState(true)
  // Échantillon survolé, partagé entre le trait sur la carte et la courbe du profil
  const [hoverIdx, setHoverIdx] = useState(null)
  const samples = profileState.fresh ? profileState.profile.samples : null
  const hoverSample = samples && hoverIdx != null ? (samples[hoverIdx] ?? null) : null
  const hoverFrameRef = useRef(null)

  // Tracé découpé en tronçons de même classe de pente, une fois le profil calculé pour ces points
  const slopeRuns = useMemo(() => {
    if (!profileState.fresh) return null
    const runs = []
    let run = null
    for (const s of profileState.profile.samples) {
      const color = slopeClass(s.slope)?.color ?? ACCENT
      if (run) run.positions.push([s.lat, s.lng])
      if (!run || run.color !== color) {
        run = { color, positions: [[s.lat, s.lng]] }
        runs.push(run)
      }
    }
    return runs
  }, [profileState.fresh, profileState.profile])

  // Temps de marche, seulement quand le profil (donc le dénivelé) correspond au tracé affiché
  const stats = profileState.fresh ? profileState.profile.stats : null
  const walkTime = stats && stats.minZ != null ? hikingTimeHours(stats) : null

  const distance = useMemo(() => {
    let d = 0
    for (let i = 1; i < line.length; i++) {
      d += L.latLng(line[i - 1]).distanceTo(line[i])
    }
    return d
  }, [line])

  const deselect = () => {
    setSelectedIdx(null)
    setMoving(false)
  }

  const addPoint = (latlng) => {
    const last = points[points.length - 1]
    // Évite les doublons d'un double-clic
    if (last && map.latLngToContainerPoint(last).distanceTo(map.latLngToContainerPoint(latlng)) < 4) return
    onChange([...points, { lat: latlng.lat, lng: latlng.lng }])
  }

  const movePoint = (idx, latlng) => {
    onChange(points.map((p, i) => (i === idx ? { lat: latlng.lat, lng: latlng.lng } : p)))
  }

  const removePoint = (idx) => {
    onChange(points.filter((_, i) => i !== idx))
    deselect()
  }

  const handleLongPress = (idx, latlng) => {
    if (moving && selectedIdx != null) {
      // Maintenir le doigt sur le point en cours de déplacement ne doit pas annuler le déplacement
      if (idx === selectedIdx) return
      if (idx == null) {
        movePoint(selectedIdx, latlng)
        deselect()
        return
      }
    }
    if (idx != null) {
      setSelectedIdx(idx)
      setMoving(false)
      return
    }
    addPoint(latlng)
  }

  // Les écouteurs natifs sont posés une seule fois : ils lisent la dernière version des handlers via ce ref
  const handlersRef = useRef(null)
  useEffect(() => {
    handlersRef.current = { longPress: handleLongPress }
  })

  const sampleUnder = (containerPoint, maxPx) =>
    samples ? nearestSampleOnScreen(map, samples, containerPoint, maxPx) : null

  useMapEvents({
    // Survol du trait à la souris : la bulle suit le curseur le long du tracé (une mesure par image)
    mousemove: (e) => {
      if (!samples || !isOnMap(e.originalEvent.target, map.getContainer())) return
      const point = e.containerPoint
      cancelAnimationFrame(hoverFrameRef.current)
      hoverFrameRef.current = requestAnimationFrame(() => setHoverIdx(sampleUnder(point, LINE_HOVER_PX)))
    },
    mouseout: () => {
      cancelAnimationFrame(hoverFrameRef.current)
      if (pointerTypeRef.current === 'mouse') setHoverIdx(null)
    },
    click: (e) => {
      if (!isOnMap(e.originalEvent.target, map.getContainer())) return
      // Au doigt, toucher le trait affiche la bulle ; toucher ailleurs la masque
      if (pointerTypeRef.current !== 'mouse' && !(moving && selectedIdx != null)) {
        const idx = sampleUnder(e.containerPoint, LINE_TAP_PX)
        setHoverIdx(idx)
        if (idx != null) return
      }
      if (!active) return
      if (moving && selectedIdx != null) {
        movePoint(selectedIdx, e.latlng)
        deselect()
        return
      }
      if (selectedIdx != null) {
        deselect()
        return
      }
      if (pointerTypeRef.current === 'mouse') addPoint(e.latlng)
    },
  })

  // Détection de l'appui long (doigt ou stylet) sur la carte
  useEffect(() => {
    if (!active) return
    const el = map.getContainer()
    const pointers = new Set()
    let timer = null
    let start = null

    const cancel = () => {
      clearTimeout(timer)
      timer = null
      start = null
      setPressFx(null)
    }
    const onDown = (e) => {
      pointers.add(e.pointerId)
      if (e.pointerType === 'mouse' || pointers.size > 1) return cancel()
      if (!isOnMap(e.target, el)) return
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const idxAttr = e.target.closest('[data-trace-idx]')?.dataset.traceIdx
      start = { x: e.clientX, y: e.clientY }
      setPressFx({ x, y, id: e.timeStamp })
      timer = setTimeout(() => {
        cancel()
        navigator.vibrate?.(25)
        handlersRef.current.longPress(idxAttr != null ? Number(idxAttr) : null, map.containerPointToLatLng([x, y]))
      }, LONG_PRESS_MS)
    }
    const onMove = (e) => {
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOLERANCE_PX) cancel()
    }
    const onUp = (e) => {
      pointers.delete(e.pointerId)
      cancel()
    }
    // Empêche le menu contextuel natif (et la loupe iOS) déclenchés par l'appui long
    const onContextMenu = (e) => e.preventDefault()

    el.classList.add('trace-drawing')
    map.doubleClickZoom.disable()
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('contextmenu', onContextMenu)
    map.on('movestart zoomstart', cancel)
    return () => {
      cancel()
      el.classList.remove('trace-drawing')
      map.doubleClickZoom.enable()
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('contextmenu', onContextMenu)
      map.off('movestart zoomstart', cancel)
    }
  }, [active, map])

  // Sur mobile, publie la hauteur du bandeau (--trace-band-h) pour que les boutons du bas remontent au-dessus
  useEffect(() => {
    const band = uiRef.current
    if (!active || !band) return
    const root = document.documentElement
    const mobile = window.matchMedia('(max-width: 639px)')
    const update = () => {
      // La marge de sécurité de l'iPhone est déjà ajoutée par chaque bouton : on ne la compte pas deux fois
      const safeArea = parseFloat(getComputedStyle(band.firstElementChild).paddingBottom) || 0
      root.style.setProperty('--trace-band-h', mobile.matches ? `${band.offsetHeight - safeArea}px` : '0px')
    }
    const observer = new ResizeObserver(update)
    observer.observe(band)
    mobile.addEventListener('change', update)
    update()
    return () => {
      observer.disconnect()
      mobile.removeEventListener('change', update)
      root.style.removeProperty('--trace-band-h')
    }
  }, [active])

  // Type du dernier pointeur (souris, doigt, stylet), y compris hors du mode tracé
  useEffect(() => {
    const el = map.getContainer()
    const onDown = (e) => {
      pointerTypeRef.current = e.pointerType
    }
    el.addEventListener('pointerdown', onDown, true)
    return () => el.removeEventListener('pointerdown', onDown, true)
  }, [map])

  // Raccourcis clavier : Échap pour désélectionner, Ctrl+Z pour retirer le dernier point
  useEffect(() => {
    if (!active) return
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea')) return
      if (e.key === 'Escape') {
        setSelectedIdx(null)
        setMoving(false)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && points.length) {
        e.preventDefault()
        onChange(points.slice(0, -1))
        setSelectedIdx(null)
        setMoving(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, points, onChange])

  useEffect(() => {
    if (!uiRef.current) return
    L.DomEvent.disableClickPropagation(uiRef.current)
    L.DomEvent.disableScrollPropagation(uiRef.current)
  }, [active])

  const selectPoint = (idx) => {
    setSelectedIdx((cur) => (cur === idx ? null : idx))
    setMoving(false)
  }

  const hint = moving
    ? HAS_FINE_POINTER
      ? 'Faites glisser le point, ou cliquez à l’endroit voulu'
      : 'Faites glisser le point, ou touchez l’endroit voulu'
    : HAS_FINE_POINTER
      ? 'Clic pour placer un point · clic sur un point pour le modifier'
      : 'Appui long pour placer un point · appui long sur un point pour le modifier'

  // Boutons carrés du style « instrument » (panneaux météo et soleil)
  const squareBtn =
    'flex h-8 shrink-0 items-center justify-center rounded-sm border border-[#2b2b2b] text-[#8a8a8a] transition-colors hover:border-[#444] hover:text-white active:bg-[#1a1a1a]'
  const actionBtn =
    'flex items-center gap-1.5 rounded-sm border border-[#2b2b2b] px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white transition-colors hover:border-[#444] active:bg-[#1a1a1a] disabled:pointer-events-none disabled:opacity-35'

  return (
    <>
      {points.length > 1 && (
        <>
          <Polyline
            positions={line}
            interactive={false}
            pathOptions={{ color: '#000', weight: 7, opacity: 0.45, lineCap: 'round', lineJoin: 'round' }}
          />
          {slopeRuns ? (
            slopeRuns.map((run, i) => (
              <Polyline
                key={`${i}-${run.color}`}
                positions={run.positions}
                interactive={false}
                pathOptions={{ color: run.color, weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
              />
            ))
          ) : (
            <Polyline
              positions={line}
              interactive={false}
              pathOptions={{
                color: ACCENT,
                weight: 4,
                opacity: routing ? 0.6 : 0.95,
                // Pointillé tant que le chemin sur sentier n'est pas calculé
                dashArray: routing ? '2 8' : undefined,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          )}
        </>
      )}

      {hoverSample && (
        <CircleMarker
          center={[hoverSample.lat, hoverSample.lng]}
          radius={6}
          interactive={false}
          pathOptions={{ color: '#fff', weight: 2.5, fillColor: ACCENT, fillOpacity: 1 }}
        >
          <Tooltip permanent direction="top" offset={[0, -8]} className="trace-tooltip">
            <SampleReadout sample={hoverSample} />
          </Tooltip>
        </CircleMarker>
      )}

      {points.map((p, i) => (
        <TracePoint
          // Les marqueurs sont recréés au changement de mode pour basculer leur interactivité
          key={`${i}-${active ? 'on' : 'off'}`}
          point={p}
          index={i}
          total={points.length}
          selected={active && selectedIdx === i}
          moving={active && moving && selectedIdx === i}
          interactive={active}
          onSelect={selectPoint}
          onDragEnd={(idx, latlng) => {
            movePoint(idx, latlng)
            setMoving(false)
          }}
          pointerTypeRef={pointerTypeRef}
        />
      ))}

      {active && pressFx && (
        <div key={pressFx.id} className="trace-press-ring" style={{ left: pressFx.x, top: pressFx.y }} />
      )}

      {active && (
        <div
          ref={uiRef}
          data-trace-ui
          // Mobile : bandeau collé en bas sur toute la largeur. PC : panneau centré.
          className={`pointer-events-auto absolute inset-x-0 bottom-0 z-[1000] animate-in fade-in slide-in-from-bottom-2 duration-200 sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 ${
            points.length > 1 && showProfile ? 'sm:w-[min(34rem,calc(100vw-7rem))]' : 'sm:w-[min(26rem,calc(100vw-7rem))]'
          }`}
        >
          <div className="overflow-hidden border-t border-[#2b2b2b] bg-black pb-[env(safe-area-inset-bottom,0px)] text-white shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.9)] [color-scheme:dark] sm:rounded-md sm:border sm:pb-0 sm:shadow-[0_30px_80px_-20px_rgba(0,0,0,1)]">
            {/* ─── En-tête ─── */}
            <header className="flex items-start justify-between gap-3 px-3 pt-2.5 pb-2 sm:px-3.5 sm:pt-3 sm:pb-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
                  <span className="h-3 w-[3px]" style={{ background: ACCENT }} />
                  Tracé
                </div>
                <p className="font-din mt-1.5 truncate text-[12px] uppercase tracking-[0.12em] text-[#8a8a8a]">
                  {points.length > 1 && <>{formatDistance(distance)} · </>}
                  {/* Une fois le temps de marche connu, il remplace le nombre de points, faute de place */}
                  {walkTime != null ? (
                    <span className="text-white" title="Temps de marche estimé sans pause (norme DIN 33466)">
                      ≈ {formatDuration(walkTime)}
                    </span>
                  ) : (
                    <>
                      {points.length} point{points.length > 1 ? 's' : ''}
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => setSnapToTrails((v) => !v)}
                  aria-pressed={snapToTrails}
                  aria-label="Suivre les sentiers"
                  title={snapToTrails ? 'Le tracé suit les sentiers : cliquer pour tracer en ligne droite' : 'Faire suivre les sentiers au tracé'}
                  className={`${squareBtn} min-w-8 gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider`}
                  style={snapToTrails ? { borderColor: ACCENT, color: ACCENT } : undefined}
                >
                  {routing ? (
                    <span className="h-1.5 w-1.5 animate-pulse" style={{ background: ACCENT }} />
                  ) : (
                    <Footprints size={14} className="sm:hidden" />
                  )}
                  {/* Sur mobile, l'icône seule laisse la place à la distance et au temps de marche */}
                  <span className="hidden sm:inline">Sur sentier</span>
                </button>
                {points.length > 1 && (
                  <button
                    onClick={() => setShowProfile((v) => !v)}
                    title={showProfile ? 'Masquer le profil' : 'Afficher le profil altimétrique'}
                    className={`${squareBtn} gap-1 px-2 text-[10px] font-semibold uppercase tracking-wider`}
                  >
                    {!showProfile && profileState.status === 'loading' && (
                      <span className="h-1.5 w-1.5 animate-pulse" style={{ background: ACCENT }} />
                    )}
                    Profil {showProfile ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                  </button>
                )}
                <button
                  onClick={onClose}
                  aria-label="Quitter le mode tracé"
                  title="Quitter le mode tracé (le tracé reste affiché)"
                  className={`${squareBtn} w-8`}
                >
                  <X size={16} />
                </button>
              </div>
            </header>

            {/* Sur mobile, l'aide disparaît une fois le tracé commencé pour laisser la place au profil */}
            <p
              className={`border-t border-[#262626] px-3.5 py-2 text-[11px] leading-snug text-[#8a8a8a] ${
                points.length > 1 && !moving ? 'hidden sm:block' : ''
              }`}
            >
              {hint}
            </p>

            {snapToTrails && points.length > 1 && (routing || hiking.failures.length > 0) && (
              <div className="flex items-start gap-2 border-t border-[#262626] px-3.5 py-2 text-[11px] leading-snug">
                <p className="min-w-0 flex-1 text-[#8a8a8a]">
                  {routing ? (
                    'Recherche du sentier…'
                  ) : (
                    <>
                      <span style={{ color: ACCENT }}>Ligne droite </span>
                      {hiking.failures.map((f) => `points ${f.from}–${f.to} (${f.message.toLowerCase()})`).join(' · ')}
                    </>
                  )}
                </p>
                {!routing && (
                  <button onClick={hiking.retry} className="shrink-0 uppercase tracking-wider text-white underline">
                    Réessayer
                  </button>
                )}
              </div>
            )}

            {points.length > 1 && showProfile && (
              <TraceProfile {...profileState} hoverIdx={hoverIdx} onHover={setHoverIdx} />
            )}

            {/* ─── Actions ─── */}
            {snapToTrails && points.length > 1 && (
              <p className="border-t border-[#262626] px-3.5 py-1.5 text-[9px] uppercase tracking-wider text-[#6b6b6b]">
                Chemins : IGN · BD TOPO
              </p>
            )}

            <div className="flex flex-wrap items-center gap-1.5 border-t border-[#262626] px-3 py-2 sm:px-3.5 sm:py-2.5">
              {selectedIdx != null ? (
                <>
                  <span
                    className="mr-auto text-[10px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: ACCENT }}
                  >
                    Point {selectedIdx + 1}
                  </span>
                  <button
                    onClick={() => setMoving((v) => !v)}
                    className={actionBtn}
                    style={moving ? { borderColor: ACCENT, color: ACCENT } : undefined}
                  >
                    <Move size={12} /> Déplacer
                  </button>
                  <button
                    onClick={() => removePoint(selectedIdx)}
                    className={`${actionBtn} text-[#ff5a4d] hover:border-[#ff5a4d]/60`}
                  >
                    <Trash size={12} /> Supprimer
                  </button>
                  <button onClick={deselect} aria-label="Désélectionner" className={`${actionBtn} text-[#8a8a8a]`}>
                    <X size={12} />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => onChange(points.slice(0, -1))} disabled={!points.length} className={actionBtn}>
                    <Undo2 size={12} /> Annuler
                  </button>
                  <button onClick={() => onChange([])} disabled={!points.length} className={actionBtn}>
                    <Eraser size={12} /> Effacer
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
