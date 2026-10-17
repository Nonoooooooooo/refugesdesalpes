import { useState, useEffect, useRef } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Radio,
  SlidersHorizontal,
  X,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
} from 'lucide-react'
import { AROME_LAYERS, formatAromeTime, preloadAromeImage } from './aromeService'

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
      { label: '20 dBZ (Bruine)', color: '#38bdf8' },
      { label: '35 dBZ (Pluie)', color: '#22c55e' },
      { label: '45 dBZ (Averses)', color: '#eab308' },
      { label: '> 50 dBZ (Orage/Grêle)', color: '#ef4444' },
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
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(900) // ms par frame
  const [showOpacity, setShowOpacity] = useState(false)
  const [showLayerMenu, setShowLayerMenu] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const playTimerRef = useRef(null)

  const activeLayerObj =
    AROME_LAYERS.find((l) => l.id === selectedLayer) || AROME_LAYERS[0]
  const currentLegend = LEGENDS[selectedLayer] || LEGENDS.TOTAL_PRECIPITATION_RATE__GROUND_OR_WATER_SURFACE

  const currentIndex = Math.max(0, times.indexOf(selectedTime))
  const formattedCurrent = formatAromeTime(selectedTime)

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
    <aside aria-label="Contrôle radar AROME" className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 z-[1050] w-[95vw] max-w-xl transition-all duration-300">
      <div className="glass glass-panel rounded-3xl p-3 sm:p-4 shadow-2xl border border-sky-400/30 backdrop-blur-2xl">
        {/* ─── En-tête : Titre, Couche active & Boutons ─── */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-500/25 border border-sky-400/40 text-sm shadow-inner shrink-0">
              {activeLayerObj.icon}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-white tracking-wide truncate">
                  Radar AROME-PI
                </span>
                <span className="rounded-full bg-sky-500/20 border border-sky-400/40 px-1.5 py-0.2 text-[9px] font-semibold text-sky-200">
                  Météo-France 0.01°
                </span>
                {isLoading && (
                  <span className="flex h-2 w-2 rounded-full bg-sky-400 animate-ping" title="Chargement du calque…" />
                )}
              </div>
              <p className="text-[11px] text-white/60 truncate">
                {activeLayerObj.label}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Bouton sélecteur de couches */}
            <div className="relative">
              <button
                onClick={() => setShowLayerMenu((v) => !v)}
                title="Changer de calque météo"
                className="glass-btn flex items-center gap-1 rounded-xl bg-white/10 px-2 py-1 text-xs text-white/85 hover:text-white"
              >
                <Layers size={13} className="text-sky-300" />
                <span className="hidden sm:inline">{activeLayerObj.shortLabel}</span>
                <ChevronDown size={12} />
              </button>

              {showLayerMenu && (
                <div className="absolute right-0 bottom-full mb-2 w-56 rounded-2xl border border-white/15 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Données AROME-PI
                  </div>
                  {AROME_LAYERS.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => {
                        onLayerChange(l.id)
                        setShowLayerMenu(false)
                      }}
                      className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-left transition-colors ${
                        selectedLayer === l.id
                          ? 'bg-sky-500/25 text-sky-200 font-semibold'
                          : 'text-white/75 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="text-sm">{l.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{l.label}</div>
                        <div className="text-[10px] text-white/50">{l.unit}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bouton Opacité */}
            <div className="relative">
              <button
                onClick={() => setShowOpacity((v) => !v)}
                title="Régler l'opacité"
                className={`glass-btn rounded-xl p-1.5 text-xs transition-colors ${
                  showOpacity ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:text-white'
                }`}
              >
                <SlidersHorizontal size={14} />
              </button>

              {showOpacity && (
                <div className="absolute right-0 bottom-full mb-2 w-48 rounded-2xl border border-white/15 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-xl z-50">
                  <div className="flex items-center justify-between text-xs text-white/70 mb-2">
                    <span>Opacité calque</span>
                    <span className="font-bold text-sky-300">{Math.round(opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="1"
                    step="0.05"
                    value={opacity}
                    onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-white/40 mt-1">
                    <span>Translucide</span>
                    <span>Opaque</span>
                  </div>
                </div>
              )}
            </div>

            {/* Réduire / Fermer */}
            <button
              onClick={() => setIsMinimized((v) => !v)}
              title={isMinimized ? 'Agrandir le lecteur' : 'Minimiser'}
              className="glass-btn rounded-xl p-1.5 text-white/60 hover:text-white"
            >
              {isMinimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            <button
              onClick={onClose}
              title="Fermer le calque météo"
              className="glass-btn rounded-xl p-1.5 text-white/60 hover:text-red-300 hover:bg-red-500/20"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ─── Corps : Commandes temporelles & Timeline ─── */}
        {!isMinimized && (
          <div className="pt-2.5 flex flex-col gap-2">
            {/* Ligne Échéance & Badge Direct */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                {formattedCurrent.isLive ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    EN DIRECT
                  </span>
                ) : formattedCurrent.isForecast ? (
                  <span className="flex items-center gap-1 rounded-full bg-sky-500/20 border border-sky-400/40 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                    <Sparkles size={11} />
                    PRÉVISION
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-500/20 border border-slate-400/40 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                    PASSÉ
                  </span>
                )}
                <span className="text-sm font-semibold text-white tracking-wide">
                  {formattedCurrent.label}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={jumpToLive}
                  title="Revenir au direct"
                  className="glass-btn flex items-center gap-1 rounded-xl bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80 hover:text-white"
                >
                  <Radio size={12} className="text-emerald-400" />
                  <span>Direct</span>
                </button>
              </div>
            </div>

            {/* Slider temporel */}
            <div className="relative pt-1">
              <input
                type="range"
                min="0"
                max={Math.max(0, times.length - 1)}
                value={currentIndex}
                onChange={(e) => {
                  setIsPlaying(false)
                  const idx = parseInt(e.target.value, 10)
                  if (times[idx]) onTimeChange(times[idx])
                }}
                className="w-full accent-sky-400 cursor-pointer h-2 bg-white/10 rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[10px] text-white/50 px-0.5 mt-0.5">
                <span>{times[0] ? formatAromeTime(times[0]).timeStr : ''}</span>
                <span className="text-sky-300 font-semibold">{formattedCurrent.timeStr}</span>
                <span>{times.length > 0 ? formatAromeTime(times[times.length - 1]).timeStr : ''}</span>
              </div>
            </div>

            {/* Barre de transport Play/Pause & Pas à pas */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={stepBack}
                  title="15 min en arrière"
                  className="glass-btn rounded-xl p-1.5 text-white/70 hover:text-white"
                >
                  <SkipBack size={15} />
                </button>

                <button
                  onClick={() => setIsPlaying((p) => !p)}
                  title={isPlaying ? 'Pause' : 'Lecture animation radar'}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold shadow-lg shadow-sky-500/30 transition-transform active:scale-95"
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                </button>

                <button
                  onClick={stepForward}
                  title="15 min en avant"
                  className="glass-btn rounded-xl p-1.5 text-white/70 hover:text-white"
                >
                  <SkipForward size={15} />
                </button>

                <span className="hidden sm:inline text-[10px] text-white/40 ml-1">
                  Pas de 15 min
                </span>
              </div>

              {/* Échelle / Légende dynamique */}
              {currentLegend && (
                <div className="flex items-center gap-1 sm:gap-1.5 bg-black/30 rounded-xl px-2 py-1 border border-white/5">
                  <span className="hidden md:inline text-[10px] text-white/50">
                    {currentLegend.title} :
                  </span>
                  <div className="flex items-center gap-0.5">
                    {currentLegend.items.map((it, idx) => (
                      <div key={idx} className="flex items-center gap-1 px-1">
                        <span
                          className="h-2 w-3 rounded-xs shadow-xs"
                          style={{ background: it.color }}
                        />
                        <span className="text-[9px] text-white/70 font-mono hidden sm:inline">
                          {it.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
