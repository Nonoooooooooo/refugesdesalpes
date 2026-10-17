import { useState } from 'react'
import {
  Satellite,
  Mountain,
  Footprints,
  TrainFront,
  SquareParking,
  Compass,
  Camera,
  CloudRain,
  Filter,
  ChevronDown,
  ChevronUp,
  CheckCheck,
  RotateCcw,
  Heart,
  HardDrive,
} from 'lucide-react'
import { FILTERABLE } from '../lib/types.jsx'
import { useFavorites } from '../context/FavoritesContext.jsx'

/**
 * Barre de contrôle divisée en 2 rangées ergonomiques (adaptée mobile & desktop) :
 * LIGNE 1 : Fond de carte (Satellite / OpenTopo / IGN) & Outils personnels (Favoris / Hors-ligne)
 * LIGNE 2 : Calques interactifs (Sentiers / Transports / Webcams / Météo) & Dérouleur Filtres
 * LIGNE 3 : Tiroir des filtres d'hébergements & parkings
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
  showMeteo,
  onToggleMeteo,
  activeTypes,
  onToggleType,
  onOpenFavorites,
  filterOnlyFavorites,
  onToggleFilterOnlyFavorites,
  onOpenOffline,
  isOnline = true,
  savedZonesCount = 0,
}) {
  const { favoritesCount } = useFavorites()
  const [showFilters, setShowFilters] = useState(false)

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
    { key: 'opentopo', label: 'OpenTopo', Icon: Mountain },
    { key: 'ign', label: 'IGN France', Icon: Compass },
  ]

  const activeBaseIdx = Math.max(
    0,
    baseLayers.findIndex(
      (b) =>
        b.key === baseLayer ||
        (baseLayer === 'relief' && b.key === 'opentopo') ||
        (baseLayer === 'cyclosm' && b.key === 'ign'),
    ),
  )

  return (
    <div className="pointer-events-none absolute left-[3.25rem] right-2.5 top-[calc(0.625rem+env(safe-area-inset-top,0px))] sm:left-auto sm:right-4 sm:top-4 z-[1000] flex flex-col items-end gap-1.5 sm:gap-2 max-w-[calc(100vw-3.75rem)] sm:max-w-none">
      {/* ─── LIGNE 1 : Fond de carte & Outils personnels (Favoris / Hors-ligne) ─── */}
      <div className="flex items-center justify-end gap-1.5 flex-wrap sm:flex-nowrap">
        {/* Sélecteur Fond de Carte (Satellite / OpenTopo / IGN) */}
        <div className="pointer-events-auto glass flex items-center rounded-2xl p-0.5 sm:p-1 shadow-2xl backdrop-blur-xl border border-white/10">
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
              const isActive =
                baseLayer === key ||
                (baseLayer === 'relief' && key === 'opentopo') ||
                (baseLayer === 'cyclosm' && key === 'ign')
              return (
                <button
                  key={key}
                  onClick={() => onBaseLayerChange(key)}
                  title={label}
                  className={`relative z-10 flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs font-medium transition-colors ${
                    isActive ? 'text-white font-semibold' : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Icon size={13} />
                  <span className="hidden md:inline">{label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Outils personnels : Favoris & Hors-Ligne */}
        <div className="pointer-events-auto glass flex items-center gap-0.5 sm:gap-1 rounded-2xl p-1 sm:p-1.5 shadow-2xl backdrop-blur-xl border border-white/10">
          {/* Bouton Favoris */}
          <button
            onClick={onOpenFavorites}
            title="Ouvrir la liste de mes refuges favoris"
            className={`glass-btn flex items-center gap-1 sm:gap-1.5 rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs font-medium transition-all ${
              filterOnlyFavorites || favoritesCount > 0
                ? 'border border-amber-400/40 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 shadow-sm'
                : 'bg-white/5 text-white/75 hover:text-white hover:bg-white/10'
            }`}
          >
            <Heart
              size={13}
              className={filterOnlyFavorites || favoritesCount > 0 ? 'fill-amber-400 text-amber-400' : 'text-white/70'}
            />
            <span className="hidden sm:inline">Favoris</span>
            {favoritesCount > 0 && (
              <span className="rounded-full bg-amber-500/25 px-1 sm:px-1.5 py-0.2 text-[9px] sm:text-[10px] font-bold text-amber-200 border border-amber-400/20">
                {favoritesCount}
              </span>
            )}
          </button>

          {/* Bouton Hors-Ligne & PWA */}
          <button
            onClick={onOpenOffline}
            title={
              !isOnline
                ? 'Mode hors-ligne actif · Gérer les cartes et zones téléchargées'
                : 'Télécharger des zones de carte hors-ligne & Installer l’application'
            }
            className={`glass-btn flex items-center gap-1 sm:gap-1.5 rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs font-medium transition-all ${
              !isOnline
                ? 'border border-amber-400/60 bg-amber-400/25 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.35)] ring-1 ring-amber-400/40 font-semibold'
                : savedZonesCount > 0
                  ? 'border border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
                  : 'bg-white/5 text-white/75 hover:text-white hover:bg-white/10'
            }`}
          >
            <HardDrive
              size={13}
              className={
                !isOnline
                  ? 'text-amber-300 animate-pulse'
                  : savedZonesCount > 0
                    ? 'text-amber-400'
                    : 'text-white/70'
              }
            />
            <span className="hidden sm:inline">Hors-ligne</span>
            {savedZonesCount > 0 && (
              <span className="rounded-full bg-amber-500/25 px-1 sm:px-1.5 py-0.2 text-[9px] sm:text-[10px] font-bold text-amber-200 border border-amber-400/20">
                {savedZonesCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ─── LIGNE 2 : Calques (Sentiers, Transports, Webcams, Météo) & Bouton Filtres ─── */}
      <div className="pointer-events-auto glass flex flex-nowrap items-center justify-end gap-0.5 sm:gap-1 rounded-2xl p-1 sm:p-1.5 shadow-2xl backdrop-blur-xl border border-white/10 max-w-full overflow-x-auto scrollbar-none">
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

        {/* Bouton Météo (AROME-PI Météo-France) */}
        <button
          onClick={onToggleMeteo}
          title="Afficher/masquer le radar précipitations et vent AROME-PI (Météo-France)"
          className={`glass-btn flex items-center gap-1 sm:gap-1.5 rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs font-medium transition-all ${
            showMeteo
              ? 'border border-cyan-400/50 bg-cyan-500/35 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.35)] ring-1 ring-cyan-400/30 font-semibold'
              : 'bg-white/5 text-white/65 hover:text-white hover:bg-white/10'
          }`}
        >
          <CloudRain size={14} className={showMeteo ? 'text-cyan-300 animate-pulse' : ''} />
          <span className="hidden sm:inline">Météo</span>
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
          <span className="rounded-full bg-white/20 px-1 sm:px-1.5 py-0.2 text-[9px] sm:text-[10px] font-bold">
            {activeCount}/{FILTERABLE.length}
          </span>
          {showFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* ─── LIGNE 3 : Tiroir ajusté des filtres d'hébergements & Parkings ─── */}
      {showFilters && (
        <div className="pointer-events-auto glass flex w-fit max-w-full sm:max-w-none flex-wrap sm:flex-nowrap items-center justify-start sm:justify-end gap-1 sm:gap-1.5 rounded-2xl p-1 sm:p-1.5 shadow-2xl backdrop-blur-xl border border-white/10 animate-in fade-in slide-in-from-top-1 duration-200">
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

          {/* Filtre Uniquement mes favoris */}
          {onToggleFilterOnlyFavorites && (
            <>
              <div className="mx-0.5 h-4 w-px bg-white/15" />
              <button
                onClick={onToggleFilterOnlyFavorites}
                aria-pressed={filterOnlyFavorites}
                title={
                  filterOnlyFavorites
                    ? 'Afficher tous les refuges'
                    : "N'afficher que mes refuges favoris sur la carte"
                }
                className={`glass-btn flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-all ${
                  filterOnlyFavorites
                    ? 'border border-amber-400/50 bg-amber-500/25 text-amber-100 shadow-sm ring-1 ring-amber-400/30 font-semibold'
                    : 'bg-white/5 text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/15'
                }`}
              >
                <Heart
                  size={12}
                  className={filterOnlyFavorites ? 'fill-amber-300 text-amber-300' : 'text-amber-400'}
                />
                <span className="text-[11px] whitespace-nowrap">Favoris seuls</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
