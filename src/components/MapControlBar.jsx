import React, { useState } from 'react'
import {
  Satellite,
  Mountain,
  Footprints,
  TrainFront,
  Filter,
  ChevronDown,
  ChevronUp,
  CheckCheck,
  RotateCcw
} from 'lucide-react'
import { FILTERABLE } from '../lib/types.jsx'

/**
 * Barre de contrôle unifiée en haut à droite :
 * Ligne 1 : Fond de carte (Satellite/Relief) | Sentiers | Transports | Bouton Filtres
 * Ligne 2 : Panneau de filtres des hébergements (parfaitement empilé sans chevauchement)
 */
export default function MapControlBar({
  baseLayer,
  onBaseLayerChange,
  showTrails,
  onToggleTrails,
  showTransports,
  onToggleTransports,
  activeTypes,
  onToggleType,
}) {
  const [showFilters, setShowFilters] = useState(true)
  const isSatellite = baseLayer === 'satellite'
  const activeCount = FILTERABLE.filter((t) => activeTypes.has(t.key)).length
  const allActive = activeCount === FILTERABLE.length

  const handleToggleAll = () => {
    if (allActive) {
      // Garder uniquement les refuges gardés si on désactive tout
      FILTERABLE.forEach((t) => {
        if (t.key !== 'garde' && activeTypes.has(t.key)) {
          onToggleType(t.key)
        }
      })
    } else {
      // Tout réactiver
      FILTERABLE.forEach((t) => {
        if (!activeTypes.has(t.key)) {
          onToggleType(t.key)
        }
      })
    }
  }

  return (
    <div className="pointer-events-none absolute right-4 top-4 z-[1000] flex flex-col items-end gap-2">
      {/* ─── LIGNE 1 : Fond de carte & Calques majeurs ─── */}
      <div className="pointer-events-auto glass flex items-center gap-1 rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl">
        {/* Sélecteur Satellite / Relief */}
        <div className="relative flex rounded-xl bg-black/40 p-0.5">
          <span
            aria-hidden
            className="absolute bottom-0.5 top-0.5 w-[calc(50%-2px)] rounded-lg bg-white/20 shadow-sm transition-transform duration-300 ease-out"
            style={{ transform: `translateX(${isSatellite ? 0 : 100}%)`, left: 2 }}
          />
          <button
            onClick={() => onBaseLayerChange('satellite')}
            className={`relative z-10 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              isSatellite ? 'text-white font-semibold' : 'text-white/60 hover:text-white'
            }`}
          >
            <Satellite size={13} />
            <span className="hidden sm:inline">Satellite</span>
          </button>
          <button
            onClick={() => onBaseLayerChange('relief')}
            className={`relative z-10 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              !isSatellite ? 'text-white font-semibold' : 'text-white/60 hover:text-white'
            }`}
          >
            <Mountain size={13} />
            <span className="hidden sm:inline">Relief</span>
          </button>
        </div>

        <div className="mx-0.5 h-5 w-px bg-white/15" />

        {/* Bouton Sentiers */}
        <button
          onClick={onToggleTrails}
          title="Afficher/masquer les sentiers de randonnée (GR, PR)"
          className={`glass-btn flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all ${
            showTrails
              ? 'border border-emerald-400/50 bg-emerald-500/35 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
              : 'bg-white/5 text-white/65 hover:text-white hover:bg-white/10'
          }`}
        >
          <Footprints size={14} className={showTrails ? 'text-emerald-300' : ''} />
          <span>Sentiers</span>
        </button>

        {/* Bouton Transports */}
        <button
          onClick={onToggleTransports}
          title="Afficher/masquer le réseau de transports alpins (trains, cars, navettes)"
          className={`glass-btn flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all ${
            showTransports
              ? 'border border-indigo-400/50 bg-indigo-500/35 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.35)] ring-1 ring-indigo-400/30'
              : 'bg-white/5 text-white/65 hover:text-white hover:bg-white/10'
          }`}
        >
          <TrainFront size={14} className={showTransports ? 'text-indigo-300 animate-pulse' : ''} />
          <span>Transports</span>
        </button>

        <div className="mx-0.5 h-5 w-px bg-white/15" />

        {/* Bouton pour basculer la visibilité des filtres */}
        <button
          onClick={() => setShowFilters((prev) => !prev)}
          title="Afficher/masquer les filtres des types d'hébergement"
          className={`glass-btn flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all ${
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

      {/* ─── LIGNE 2 : Filtres des hébergements (alignés sous la ligne 1, zéro chevauchement) ─── */}
      {showFilters && (
        <div className="pointer-events-auto glass flex max-w-[calc(100vw-2rem)] sm:max-w-2xl flex-wrap items-center justify-end gap-1.5 rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-200">
          {FILTERABLE.map(({ key, label, color, Icon }) => {
            const on = activeTypes.has(key)
            return (
              <button
                key={key}
                onClick={() => onToggleType(key)}
                aria-pressed={on}
                title={`${on ? 'Masquer' : 'Afficher'} : ${label}`}
                className={`glass-btn flex items-center gap-1.5 rounded-xl px-2 py-1 text-xs font-medium transition-all ${
                  on
                    ? 'bg-white/18 text-white shadow-sm ring-1 ring-white/15'
                    : 'bg-white/5 opacity-40 text-white/60 hover:opacity-75'
                }`}
              >
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-full shadow-sm"
                  style={{ background: color }}
                >
                  <Icon size={10} className="text-white" />
                </span>
                <span className="text-[11px] whitespace-nowrap">{label}</span>
              </button>
            )
          })}

          <div className="mx-0.5 h-4 w-px bg-white/15" />

          {/* Bouton Tout cocher / Décocher */}
          <button
            onClick={handleToggleAll}
            title={allActive ? 'N’afficher que les refuges gardés' : 'Tout afficher'}
            className="glass-btn flex items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-medium text-white/60 hover:text-white hover:bg-white/10"
          >
            {allActive ? <RotateCcw size={11} /> : <CheckCheck size={11} />}
            <span>{allActive ? 'Filtrer' : 'Tous'}</span>
          </button>
        </div>
      )}
    </div>
  )
}
