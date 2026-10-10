import { useState } from 'react'
import {
  Satellite,
  Mountain,
  Footprints,
  TrainFront,
  SquareParking,
  MountainSnow,
  Camera,
  Filter,
  ChevronDown,
  ChevronUp,
  CheckCheck,
  RotateCcw,
} from 'lucide-react'
import { FILTERABLE } from '../lib/types.jsx'

/**
 * Barre de contrôle unifiée :
 * Ligne 1 : Fond de carte (Satellite/Relief/CyclOSM) | Sentiers | Transports | Webcams | Filtres
 * Ligne 2 : Bulle ajustée des filtres d'hébergements & parkings
 */
export default function MapControlBar({
  baseLayer,
  onBaseLayerChange,
  showTrails,
  onToggleTrails,
  showTransports,
  onToggleTransports,
  showParkings,
  onToggleParkings,
  showWebcams,
  onToggleWebcams,
  activeTypes,
  onToggleType,
}) {
  const [showFilters, setShowFilters] = useState(true)
  const activeCount = FILTERABLE.filter((t) => activeTypes.has(t.key)).length
  const allActive = activeCount === FILTERABLE.length

  const handleToggleAll = () => {
    if (allActive) {
      FILTERABLE.forEach((t) => {
        if (t.key !== 'garde' && activeTypes.has(t.key)) {
          onToggleType(t.key)
        }
      })
    } else {
      FILTERABLE.forEach((t) => {
        if (!activeTypes.has(t.key)) {
          onToggleType(t.key)
        }
      })
    }
  }

  const baseLayers = [
    { key: 'satellite', label: 'Satellite', Icon: Satellite },
    { key: 'relief', label: 'Relief', Icon: Mountain },
    { key: 'cyclosm', label: 'Montagne', Icon: MountainSnow },
  ]

  const activeBaseIdx = baseLayers.findIndex((b) => b.key === baseLayer)

  return (
    <div className="pointer-events-none absolute right-2.5 top-2.5 sm:right-4 sm:top-4 z-[1000] flex flex-col items-end gap-1.5 sm:gap-2 max-w-[calc(100vw-3.75rem)] sm:max-w-none">
      {/* ─── LIGNE 1 : Fond de carte & Calques majeurs ─── */}
      <div className="pointer-events-auto glass flex flex-nowrap items-center gap-0.5 sm:gap-1 rounded-2xl p-1 sm:p-1.5 shadow-2xl backdrop-blur-xl border border-white/10">
        {/* Sélecteur Satellite / Relief / CyclOSM */}
        <div className="relative flex rounded-xl bg-black/40 p-0.5">
          <span
            aria-hidden
            className="absolute bottom-0.5 top-0.5 w-[calc(33.33%-2px)] rounded-lg bg-white/20 shadow-sm transition-transform duration-300 ease-out"
            style={{
              transform: `translateX(${activeBaseIdx * 100}%)`,
              left: 2,
            }}
          />
          {baseLayers.map(({ key, label, Icon }) => {
            const isActive = baseLayer === key
            return (
              <button
                key={key}
                onClick={() => onBaseLayerChange(key)}
                title={label}
                className={`relative z-10 flex items-center gap-1 sm:gap-1.5 rounded-lg px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs font-medium transition-colors ${
                  isActive ? 'text-white font-semibold' : 'text-white/60 hover:text-white'
                }`}
              >
                <Icon size={13} />
                <span className="hidden md:inline">{label}</span>
              </button>
            )
          })}
        </div>

        <div className="mx-0.5 h-4 sm:h-5 w-px bg-white/15" />

        {/* Bouton Sentiers */}
        <button
          onClick={onToggleTrails}
          title="Afficher/masquer les sentiers de randonnée (Waymarked Trails)"
          className={`glass-btn flex items-center gap-1 sm:gap-1.5 rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs font-medium transition-all ${
            showTrails
              ? 'border border-emerald-400/50 bg-emerald-500/35 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.35)] font-semibold'
              : 'bg-white/5 text-white/65 hover:text-white hover:bg-white/10'
          }`}
        >
          <Footprints size={14} className={showTrails ? 'text-emerald-300' : ''} />
          <span className="hidden sm:inline">Sentiers</span>
        </button>

        {/* Bouton Transports */}
        <button
          onClick={onToggleTransports}
          title="Afficher/masquer le réseau de transports alpins"
          className={`glass-btn flex items-center gap-1 sm:gap-1.5 rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs font-medium transition-all ${
            showTransports
              ? 'border border-indigo-400/50 bg-indigo-500/35 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.35)] ring-1 ring-indigo-400/30 font-semibold'
              : 'bg-white/5 text-white/65 hover:text-white hover:bg-white/10'
          }`}
        >
          <TrainFront size={14} className={showTransports ? 'text-indigo-300 animate-pulse' : ''} />
          <span className="hidden sm:inline">Transports</span>
        </button>

        {/* Bouton Webcams (Windy v3) */}
        <button
          onClick={onToggleWebcams}
          title="Afficher/masquer les webcams Windy en direct (zoom >= 10)"
          className={`glass-btn flex items-center gap-1 sm:gap-1.5 rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs font-medium transition-all ${
            showWebcams
              ? 'border border-sky-400/50 bg-sky-500/35 text-sky-200 shadow-[0_0_12px_rgba(14,165,233,0.35)] ring-1 ring-sky-400/30 font-semibold'
              : 'bg-white/5 text-white/65 hover:text-white hover:bg-white/10'
          }`}
        >
          <Camera size={14} className={showWebcams ? 'text-sky-300' : ''} />
          <span className="hidden sm:inline">Webcams</span>
        </button>

        <div className="mx-0.5 h-4 sm:h-5 w-px bg-white/15" />

        {/* Bouton Filtres hébergements */}
        <button
          onClick={() => setShowFilters((prev) => !prev)}
          title="Afficher/masquer les filtres"
          className={`glass-btn flex items-center gap-1 sm:gap-1.5 rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs font-medium transition-all ${
            showFilters
              ? 'bg-white/20 text-white font-semibold'
              : 'bg-white/5 text-white/70 hover:text-white'
          }`}
        >
          <Filter size={13} className="text-white/80" />
          <span className="hidden md:inline">Filtres</span>
          <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-bold">
            {activeCount}/{FILTERABLE.length}
          </span>
          {showFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* ─── LIGNE 2 : Bulle ajustée des filtres d'hébergements & Parkings ─── */}
      {showFilters && (
        <div className="pointer-events-auto glass flex w-fit max-w-[280px] sm:max-w-none flex-wrap sm:flex-nowrap items-center justify-center sm:justify-end gap-1 sm:gap-1.5 rounded-2xl p-1 sm:p-1.5 shadow-2xl backdrop-blur-xl border border-white/10 animate-in fade-in slide-in-from-top-1 duration-200">
          {FILTERABLE.map(({ key, label, shortLabel, color, Icon }) => {
            const on = activeTypes.has(key)
            return (
              <button
                key={key}
                onClick={() => onToggleType(key)}
                aria-pressed={on}
                title={`${on ? 'Masquer' : 'Afficher'} : ${label}`}
                className={`glass-btn flex items-center gap-1 sm:gap-1.5 rounded-xl px-2 py-1 sm:px-2.5 sm:py-1 text-xs font-medium transition-all ${
                  on
                    ? 'bg-white/18 text-white shadow-sm ring-1 ring-white/15'
                    : 'bg-white/5 opacity-40 text-white/60 hover:opacity-75'
                }`}
              >
                <span
                  className="flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center rounded-full shadow-sm shrink-0"
                  style={{ background: color }}
                >
                  <Icon size={10} className="text-white" />
                </span>
                <span className="text-[11px] whitespace-nowrap">
                  <span className="sm:hidden">{shortLabel || label}</span>
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </button>
            )
          })}

          <div className="hidden sm:block mx-0.5 h-3.5 sm:h-4 w-px bg-white/15" />

          {/* Bouton Tout cocher / Décocher */}
          <button
            onClick={handleToggleAll}
            title={allActive ? 'N’afficher que les refuges gardés' : 'Tout afficher'}
            className="glass-btn flex items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-medium text-white/60 hover:text-white hover:bg-white/10"
          >
            {allActive ? <RotateCcw size={11} /> : <CheckCheck size={11} />}
            <span className="whitespace-nowrap">{allActive ? 'Filtrer' : 'Tous'}</span>
          </button>

          <div className="hidden sm:block mx-0.5 h-3.5 sm:h-4 w-px bg-white/15" />

          {/* Bouton Parkings (Overpass) placé dans la section filtres */}
          <button
            onClick={onToggleParkings}
            title="Afficher/masquer les parkings (zoom >= 12)"
            className={`glass-btn flex items-center gap-1 sm:gap-1.5 rounded-xl px-2 py-1 sm:px-2.5 sm:py-1 text-xs font-medium transition-all ${
              showParkings
                ? 'border border-blue-400/60 bg-blue-500/40 text-blue-100 shadow-[0_0_12px_rgba(59,130,246,0.4)] ring-1 ring-blue-400/40 font-semibold'
                : 'bg-white/5 opacity-50 text-white/70 hover:opacity-100 hover:text-white'
            }`}
          >
            <SquareParking size={13} className={showParkings ? 'text-blue-300' : 'text-blue-400'} />
            <span className="text-[11px] whitespace-nowrap">Parkings</span>
          </button>
        </div>
      )}
    </div>
  )
}
