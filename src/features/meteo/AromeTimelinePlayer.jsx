import { useState, useEffect, useRef } from 'react'
import { Play, Pause, SkipBack, SkipForward, Radio, X } from 'lucide-react'
import { AROME_LAYERS, formatAromeTime } from './aromeService'

// Palette "instrument clair" : fond menthe grisé, encre quasi noire, accent orange
const BG = '#eaf4f4'
const INK = '#0d1b17'
const INK_SOFT = '#3f5a53'
const RULE = 'rgba(13, 27, 23, 0.22)'
const ACCENT = '#ffaa00'

/**
 * Légendes d'intensité adaptées à chaque couche AROME
 */
const LEGENDS = {
  TOTAL_PRECIPITATION_RATE__GROUND_OR_WATER_SURFACE: {
    title: 'Précipitations (mm/h)',
    items: [
      { label: '< 1', color: '#60a5fa' },
      { label: '1 - 3', color: '#0284c7' },
      { label: '3 - 8', color: '#10b981' },
      { label: '8 - 20', color: '#f59e0b' },
      { label: '> 20', color: '#ef4444' },
    ],
  },
  TOTAL_SNOW_PRECIPITATION__GROUND_OR_WATER_SURFACE: {
    title: 'Neige cumulée (kg/m² ~ cm)',
    items: [
      { label: 'Traces', color: '#bfdbfe' },
      { label: '1 - 5', color: '#60a5fa' },
      { label: '5 - 15', color: '#3b82f6' },
      { label: '> 15', color: '#1d4ed8' },
    ],
  },
  REFLECTIVITY_MAX_DBZ__GROUND_OR_WATER_SURFACE: {
    title: 'Réflectivité Radar (dBZ)',
    items: [
      { label: '20 · bruine', color: '#38bdf8' },
      { label: '35 · pluie', color: '#22c55e' },
      { label: '45 · averses', color: '#eab308' },
      { label: '> 50 · orage / grêle', color: '#ef4444' },
    ],
  },
  WIND_SPEED_GUST_15MIN__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND: {
    title: 'Rafales de vent (km/h)',
    items: [
      { label: '< 30', color: '#38bdf8' },
      { label: '30 - 60', color: '#a855f7' },
      { label: '60 - 90', color: '#f97316' },
      { label: '> 90', color: '#ef4444' },
    ],
  },
}

function Label({ children, className = '' }) {
  return (
    <div className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${className}`} style={{ color: INK_SOFT }}>
      {children}
    </div>
  )
}

/** Bouton carré de la barre de transport */
function SquareButton({ children, title, onClick, solid = false }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex h-9 w-9 items-center justify-center rounded-sm border transition-colors active:opacity-70"
      style={solid ? { background: INK, borderColor: INK, color: BG } : { borderColor: 'rgba(13, 27, 23, 0.4)', color: INK }}
    >
      {children}
    </button>
  )
}

export default function AromeTimelinePlayer({
  times = [],
  selectedTime = '',
  onTimeChange,
  selectedLayer = 'TOTAL_PRECIPITATION_RATE__GROUND_OR_WATER_SURFACE',
  onLayerChange,
  opacity = 0.82,
  onOpacityChange,
  onClose,
  isLoading = false,
  hasSelected = false, // une fiche (refuge / transport) occupe déjà la colonne de gauche
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed] = useState(900) // ms par frame
  const playTimerRef = useRef(null)

  const activeLayerObj = AROME_LAYERS.find((l) => l.id === selectedLayer) || AROME_LAYERS[0]
  const currentLegend = LEGENDS[selectedLayer] || LEGENDS.TOTAL_PRECIPITATION_RATE__GROUND_OR_WATER_SURFACE

  const currentIndex = Math.max(0, times.indexOf(selectedTime))
  const formattedCurrent = formatAromeTime(selectedTime) || {}
  const timeStr = formattedCurrent.timeStr || '--:--'
  const offsetText = formattedCurrent.isLive
    ? 'Temps réel'
    : formattedCurrent.label
      ? formattedCurrent.label.replace(formattedCurrent.timeStr, '').replace(/[()]/g, '').trim()
      : ''

  // Boucle de lecture automatique
  useEffect(() => {
    if (!isPlaying || times.length <= 1) {
      clearInterval(playTimerRef.current)
      return
    }

    playTimerRef.current = setInterval(() => {
      onTimeChange((prev) => {
        const idx = times.indexOf(prev)
        const nextIdx = idx >= times.length - 1 ? 0 : idx + 1
        return times[nextIdx]
      })
    }, speed)

    return () => clearInterval(playTimerRef.current)
  }, [isPlaying, times, speed, onTimeChange])

  // Navigation dans la timeline
  const stepBack = () => {
    setIsPlaying(false)
    const nextIdx = currentIndex <= 0 ? times.length - 1 : currentIndex - 1
    onTimeChange(times[nextIdx])
  }

  const stepForward = () => {
    setIsPlaying(false)
    const nextIdx = currentIndex >= times.length - 1 ? 0 : currentIndex + 1
    onTimeChange(times[nextIdx])
  }

  const jumpToLive = () => {
    setIsPlaying(false)
    // Trouver le point le plus proche de maintenant
    const nowMs = Date.now()
    let closestTime = times[0]
    let minDiff = Infinity
    for (const t of times) {
      const diff = Math.abs(new Date(t).getTime() - nowMs)
      if (diff < minDiff) {
        minDiff = diff
        closestTime = t
      }
    }
    if (closestTime) {
      onTimeChange(closestTime)
    }
  }

  return (
    <aside
      aria-label="Radar météo"
      className={`sidebar-enter pointer-events-auto fixed inset-x-2 bottom-2 z-[1120] flex max-h-[72vh] flex-col overflow-y-auto rounded-md border shadow-[0_18px_50px_-12px_rgba(0,0,0,0.65)] [scrollbar-color:rgba(13,27,23,0.4)_transparent] [scrollbar-width:thin] sm:absolute sm:inset-x-auto sm:bottom-auto sm:w-[420px] ${
        // Sans fiche ouverte : colonne de gauche, sous la recherche.
        // Avec une fiche : à sa droite, sous les deux lignes de boutons de la carte.
        hasSelected ? 'sm:left-[444px] sm:top-[7rem] sm:max-h-[calc(100%-11.75rem)]' : 'sm:left-4 sm:top-[4.75rem] sm:max-h-[calc(100%-9.5rem)]'
      }`}
      style={{ background: BG, color: INK, borderColor: 'rgba(13, 27, 23, 0.35)' }}
    >
      {/* ─── En-tête ─── */}
      <header className="flex items-start justify-between gap-3 px-4 pt-3 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em]">
            <span className="h-3 w-[3px]" style={{ background: ACCENT }} />
            Radar météo
            {isLoading && <span className="h-1.5 w-1.5 animate-pulse" style={{ background: INK }} title="Chargement du calque…" />}
          </div>
          <p className="font-din mt-1.5 text-[12px] uppercase tracking-[0.12em]" style={{ color: INK_SOFT }}>
            Météo-France · AROME-PI · Alpes
          </p>
        </div>

        <button
          onClick={onClose}
          title="Fermer le radar météo"
          aria-label="Fermer le radar météo"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border transition-colors hover:bg-[rgba(13,27,23,0.1)] active:opacity-70"
          style={{ borderColor: 'rgba(13, 27, 23, 0.4)' }}
        >
          <X size={16} />
        </button>
      </header>

      {/* ─── Choix de la couche ─── */}
      <div role="tablist" aria-label="Couche affichée" className="grid grid-cols-2 gap-px border-y" style={{ background: RULE, borderColor: RULE }}>
        {AROME_LAYERS.map((l) => {
          const active = l.id === selectedLayer
          return (
            <button
              key={l.id}
              role="tab"
              aria-selected={active}
              onClick={() => onLayerChange(l.id)}
              className="px-3 py-2 text-left transition-colors"
              style={active ? { background: INK, color: BG } : { background: BG, color: INK }}
            >
              <div className="font-din text-[17px] leading-tight font-semibold uppercase tracking-[0.08em]">{l.shortLabel}</div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: active ? 'rgba(234, 244, 244, 0.7)' : INK_SOFT }}>
                {l.unit}
              </div>
            </button>
          )
        })}
      </div>
      <p className="px-4 py-2 text-[11px] leading-snug" style={{ color: INK_SOFT }}>
        {activeLayerObj.description}
      </p>

      {/* ─── Échéance ─── */}
      <div className="flex items-end justify-between gap-3 border-t px-4 py-3" style={{ borderColor: RULE }}>
        <div>
          <Label>Échéance</Label>
          <div className="font-din mt-1 text-[54px] leading-[0.9] font-semibold">{timeStr.replace(':', 'H')}</div>
          <div className="font-din mt-1.5 text-[13px] uppercase tracking-wider" style={{ color: INK_SOFT }}>
            {offsetText}
          </div>
        </div>

        {formattedCurrent.isLive ? (
          <span className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: ACCENT, color: INK }}>
            <span className="h-1.5 w-1.5" style={{ background: INK }} />
            En direct
          </span>
        ) : formattedCurrent.isForecast ? (
          <span className="rounded-sm border px-2 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ borderColor: INK }}>
            Prévision
          </span>
        ) : (
          <span className="rounded-sm border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ borderColor: RULE, color: INK_SOFT }}>
            Passé
          </span>
        )}
      </div>

      {/* ─── Timeline ─── */}
      <div className="px-4 pb-1">
        <input
          type="range"
          aria-label="Échéance du radar"
          className="radar-range"
          min="0"
          max={Math.max(0, times.length - 1)}
          value={currentIndex}
          onChange={(e) => {
            setIsPlaying(false)
            const idx = parseInt(e.target.value, 10)
            if (times[idx]) onTimeChange(times[idx])
          }}
        />
        <div className="font-din flex justify-between text-[12px] tracking-wider" style={{ color: INK_SOFT }}>
          <span>{times[0] ? formatAromeTime(times[0]).timeStr : ''}</span>
          <span className="font-semibold" style={{ color: INK }}>
            {timeStr}
          </span>
          <span>{times.length > 0 ? formatAromeTime(times[times.length - 1]).timeStr : ''}</span>
        </div>
      </div>

      {/* ─── Barre de transport ─── */}
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <SquareButton title="15 min en arrière" onClick={stepBack}>
            <SkipBack size={15} />
          </SquareButton>
          <SquareButton title={isPlaying ? 'Pause' : 'Lecture de l’animation'} onClick={() => setIsPlaying((p) => !p)} solid>
            {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </SquareButton>
          <SquareButton title="15 min en avant" onClick={stepForward}>
            <SkipForward size={15} />
          </SquareButton>
          <span className="font-din ml-1 text-[12px] uppercase tracking-wider" style={{ color: INK_SOFT }}>
            Pas de 15 min
          </span>
        </div>

        <button
          onClick={jumpToLive}
          title="Revenir au direct"
          className="font-din flex h-9 items-center gap-1.5 rounded-sm border px-2.5 text-[13px] font-semibold uppercase tracking-wider transition-colors hover:bg-[rgba(13,27,23,0.08)] active:opacity-70"
          style={{ borderColor: 'rgba(13, 27, 23, 0.4)' }}
        >
          <Radio size={13} />
          Direct
        </button>
      </div>

      {/* ─── Opacité du calque ─── */}
      <div className="border-t px-4 py-3" style={{ borderColor: RULE }}>
        <div className="flex items-center justify-between">
          <Label>Opacité du calque</Label>
          <span className="font-din text-[15px] font-semibold">{Math.round(opacity * 100)}%</span>
        </div>
        <input
          type="range"
          aria-label="Opacité du calque"
          className="radar-range mt-1"
          min="0.2"
          max="1"
          step="0.05"
          value={opacity}
          onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
        />
      </div>

      {/* ─── Légende ─── */}
      {currentLegend && (
        <div className="border-t px-4 py-3" style={{ borderColor: RULE }}>
          <Label>{currentLegend.title}</Label>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {currentLegend.items.map((it) => (
              <div key={it.label} className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 border" style={{ background: it.color, borderColor: 'rgba(13, 27, 23, 0.3)' }} />
                <span className="font-din text-[13px] font-medium tracking-wide">{it.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Pied de page ─── */}
      <footer className="mt-auto flex items-center justify-between gap-2 border-t px-4 py-2.5 text-[10px] uppercase tracking-wider" style={{ borderColor: RULE, color: INK_SOFT }}>
        <span>Source : Météo-France</span>
        <span>1 km · pas de 15 min</span>
      </footer>
    </aside>
  )
}
