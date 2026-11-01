import { useState, useMemo } from 'react'
import {
  Play,
  Pause,
  TrendingUp,
  TrendingDown,
  Mountain,
  Gauge,
  Clock,
  Compass,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  LineChart,
  Trash2,
  Check,
  Footprints,
} from 'lucide-react'

function formatDuration(sec) {
  const s = Math.max(0, Math.floor(sec || 0))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60

  const pad = (n) => String(n).padStart(2, '0')
  if (hours > 0) {
    return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`
  }
  return `${pad(minutes)}:${pad(seconds)}`
}

function getCompassDirection(deg) {
  if (deg == null) return ''
  const val = Math.floor(deg / 22.5 + 0.5) % 16
  const arr = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ]
  return arr[val]
}

export default function TrackRecorderHUD({
  isRecording,
  isPaused,
  stats,
  points,
  isBacktrackMode,
  backtrackGuidance,
  onPause,
  onResume,
  onStopAndSave,
  onDiscard,
  onToggleBacktrack,
  onOpenElevationProfile,
  hasSelected = false,
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [trackNameInput, setTrackNameInput] = useState('')

  const distKm = useMemo(() => {
    return ((stats.distance || 0) / 1000).toFixed(2)
  }, [stats.distance])

  if (!isRecording && points.length === 0) {
    return null
  }

  const handleOpenSaveDialog = () => {
    const dateStr = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    setTrackNameInput(`Randonnée du ${dateStr}`)
    setShowSaveDialog(true)
  }

  const handleConfirmSave = () => {
    onStopAndSave(trackNameInput)
    setShowSaveDialog(false)
  }

  return (
    <>
      {/* ─── BANNIÈRE ALERTE BROUILLARD / NEIGE (FIL D'ARIANE ACTIF) ─── */}
      {isBacktrackMode && backtrackGuidance && (
        <div
          className={`pointer-events-auto absolute top-20 left-1/2 z-[1100] -translate-x-1/2 max-w-sm sm:max-w-md w-[calc(100%-2rem)] transition-all animate-in fade-in slide-in-from-top-2 duration-300`}
        >
          <div className="glass flex flex-col gap-1.5 rounded-2xl border border-cyan-400/60 bg-slate-950/95 p-3 text-xs shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-cyan-300">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                </span>
                <span className="text-[13px] tracking-wide uppercase">
                  ❄️ Sécurité Brouillard & Neige active
                </span>
              </div>
              <button
                onClick={onToggleBacktrack}
                className="rounded-lg bg-white/10 px-2 py-0.5 text-[10px] text-slate-300 hover:text-white"
              >
                Quitter
              </button>
            </div>
            <p className="text-[11px] text-slate-300 leading-tight">
              Suivez la trace cyan pointillée en sens inverse pour regagner vos pas et votre point de départ en toute sécurité.
            </p>
            <div className="flex items-center gap-3 pt-1 border-t border-cyan-500/20 text-xs font-semibold">
              <span className="text-white">
                Reste jusqu’au départ :{' '}
                <span className="text-cyan-300">
                  {(backtrackGuidance.remainingDistToStart / 1000).toFixed(2)} km
                </span>
              </span>
              {backtrackGuidance.bearingToNext != null && (
                <span className="text-slate-400 flex items-center gap-1">
                  <Compass size={13} className="text-cyan-400" />
                  Cap {backtrackGuidance.bearingToNext}° (
                  {getCompassDirection(backtrackGuidance.bearingToNext)})
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── HUD PRINCIPAL FLOTTANT D'ENREGISTREMENT GPS ─── */}
      <div
        className={`pointer-events-auto absolute left-3 right-3 sm:left-auto sm:right-4 z-[1050] max-w-lg transition-all duration-300 ${
          hasSelected
            ? 'bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-28'
            : 'bottom-[calc(5.2rem+env(safe-area-inset-bottom,0px))] sm:bottom-6'
        }`}
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div className="glass rounded-3xl border border-white/20 bg-slate-950/90 shadow-2xl backdrop-blur-2xl overflow-hidden">
          {/* Barre de statut supérieure avec badge REC et bouton Réduire */}
          <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                {isRecording && !isPaused && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${
                    isPaused ? 'bg-amber-500' : 'bg-red-600'
                  }`}
                ></span>
              </span>
              <span className="text-xs font-black tracking-wider uppercase text-white flex items-center gap-1.5">
                {isPaused ? (
                  <span className="text-amber-400">EN PAUSE</span>
                ) : (
                  <span className="text-red-400 flex items-center gap-1">
                    REC <span className="font-normal text-[11px] text-slate-400">Strava Live</span>
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Bouton Profil altimétrique */}
              <button
                onClick={onOpenElevationProfile}
                title="Afficher la courbe de profil altimétrique"
                className="flex items-center gap-1 rounded-xl bg-white/5 hover:bg-white/15 px-2 py-1 text-[11px] font-medium text-slate-200 transition"
              >
                <LineChart size={13} className="text-amber-400" />
                <span className="hidden sm:inline">Profil</span>
              </button>

              {/* Bouton toggle réduire/agrandir */}
              <button
                onClick={() => setIsExpanded((v) => !v)}
                className="rounded-xl bg-white/5 p-1 text-slate-400 hover:text-white transition"
                title={isExpanded ? 'Réduire le bandeau' : 'Agrandir le bandeau'}
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
            </div>
          </div>

          {/* Grille de métriques de montagne en direct */}
          {isExpanded && (
            <div className="p-3 sm:p-4">
              <div className="grid grid-cols-3 gap-2 pb-3 border-b border-white/10 text-center">
                {/* Distance */}
                <div className="flex flex-col items-center justify-center rounded-2xl bg-white/5 p-2 border border-white/5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Distance</span>
                  <div className="text-lg font-black text-white mt-0.5">
                    {distKm} <span className="text-xs font-normal text-slate-400">km</span>
                  </div>
                </div>

                {/* Chronomètre / Durée */}
                <div className="flex flex-col items-center justify-center rounded-2xl bg-white/5 p-2 border border-white/5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <Clock size={10} /> Temps
                  </span>
                  <div className="text-lg font-black text-white mt-0.5 font-mono">
                    {formatDuration(stats.duration)}
                  </div>
                </div>

                {/* Dénivelé positif (D+) */}
                <div className="flex flex-col items-center justify-center rounded-2xl bg-emerald-500/10 p-2 border border-emerald-500/20">
                  <span className="text-[10px] uppercase font-bold text-emerald-300 flex items-center gap-1">
                    <TrendingUp size={10} /> D+
                  </span>
                  <div className="text-lg font-black text-emerald-400 mt-0.5">
                    +{Math.round(stats.elevationGain || 0)}{' '}
                    <span className="text-xs font-normal text-emerald-300/70">m</span>
                  </div>
                </div>
              </div>

              {/* Ligne 2 : Dénivelé négatif (D-), Altitude instantanée, Vitesse */}
              <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                {/* Dénivelé négatif (D-) */}
                <div className="flex flex-col items-center justify-center rounded-xl bg-amber-500/5 p-1.5">
                  <span className="text-[10px] text-amber-300/80 flex items-center gap-1">
                    <TrendingDown size={10} /> D-
                  </span>
                  <span className="text-xs font-bold text-amber-300 mt-0.5">
                    -{Math.round(stats.elevationLoss || 0)} m
                  </span>
                </div>

                {/* Altitude courante */}
                <div className="flex flex-col items-center justify-center rounded-xl bg-white/5 p-1.5">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Mountain size={10} className="text-amber-400" /> Altitude
                  </span>
                  <span className="text-xs font-bold text-white mt-0.5">
                    {stats.currentAltitude != null ? `${stats.currentAltitude} m` : '—'}
                  </span>
                </div>

                {/* Vitesse */}
                <div className="flex flex-col items-center justify-center rounded-xl bg-white/5 p-1.5">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Gauge size={10} /> Vitesse
                  </span>
                  <span className="text-xs font-bold text-white mt-0.5">
                    {stats.currentSpeed || 0}{' '}
                    <span className="text-[9px] font-normal text-slate-400">km/h</span>
                  </span>
                </div>
              </div>

              {/* Bouton Fil d'Ariane / Retour sur mes pas (Idéal brouillard / neige) */}
              <div className="pt-3">
                <button
                  onClick={onToggleBacktrack}
                  title="Activer le mode retour sur vos pas dans la neige ou le brouillard"
                  className={`w-full flex items-center justify-center gap-2 rounded-2xl py-2 px-3 text-xs font-semibold transition-all ${
                    isBacktrackMode
                      ? 'border border-cyan-400 bg-cyan-500/25 text-cyan-200 ring-2 ring-cyan-400/50 shadow-lg shadow-cyan-500/20'
                      : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Footprints
                    size={14}
                    className={isBacktrackMode ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}
                  />
                  <span>
                    {isBacktrackMode
                      ? 'Désactiver le Fil d’Ariane'
                      : '❄️ Fil d’Ariane (Retour sur mes pas / Brouillard)'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Rangée de commandes tactiles ergonomiques */}
          <div className="flex items-center justify-between gap-2 border-t border-white/10 p-2.5 sm:p-3 bg-black/40">
            {/* Abandonner */}
            <button
              onClick={() => setShowDiscardDialog(true)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition"
              title="Abandonner et effacer l’enregistrement"
            >
              <Trash2 size={18} />
            </button>

            {/* Pause / Reprendre */}
            {isPaused ? (
              <button
                onClick={onResume}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs sm:text-sm shadow-lg shadow-emerald-600/30 transition active:scale-95"
              >
                <Play size={18} fill="#ffffff" />
                <span>Reprendre la marche</span>
              </button>
            ) : (
              <button
                onClick={onPause}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl bg-amber-600 hover:bg-amber-500 font-bold text-white text-xs sm:text-sm shadow-lg shadow-amber-600/30 transition active:scale-95"
              >
                <Pause size={18} />
                <span>Mettre en pause</span>
              </button>
            )}

            {/* Terminer & Enregistrer */}
            <button
              onClick={handleOpenSaveDialog}
              className="flex items-center justify-center gap-1.5 h-11 px-4 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 font-bold text-white text-xs sm:text-sm shadow-lg shadow-orange-600/30 transition active:scale-95"
              title="Terminer et sauvegarder la trace"
            >
              <Check size={18} />
              <span className="hidden sm:inline">Terminer</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── DIALOGUE DE SAUVEGARDE DE LA TRACE ─── */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-[1600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass flex w-full max-w-sm flex-col rounded-3xl border border-white/20 bg-slate-950/95 p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white">Enregistrer votre trace GPS</h3>
            <p className="text-xs text-slate-400 mt-1">
              Cette trace sera enregistrée sur votre téléphone/appareil et consultable 100% hors-ligne.
            </p>

            <div className="mt-4">
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Nom de la randonnée
              </label>
              <input
                type="text"
                value={trackNameInput}
                onChange={(e) => setTrackNameInput(e.target.value)}
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                placeholder="Ex: Randonnée Aiguille du Midi"
                autoFocus
              />
            </div>

            <div className="mt-3 rounded-2xl bg-white/5 p-2.5 text-xs text-slate-300 grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[10px] text-slate-400 block">Distance</span>
                <span className="font-bold text-white">{distKm} km</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">D+</span>
                <span className="font-bold text-emerald-400">
                  +{Math.round(stats.elevationGain || 0)} m
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Durée</span>
                <span className="font-bold text-white">{formatDuration(stats.duration)}</span>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="flex-1 rounded-xl bg-white/10 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/15 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmSave}
                className="flex-1 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-600/30 hover:opacity-90 transition"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DIALOGUE DE CONFIRMATION D'ABANDON ─── */}
      {showDiscardDialog && (
        <div className="fixed inset-0 z-[1600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass flex w-full max-w-sm flex-col rounded-3xl border border-red-500/30 bg-slate-950/95 p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <AlertTriangle size={18} />
              Abandonner l’enregistrement ?
            </div>
            <p className="text-xs text-slate-300 mt-2">
              Tous les points enregistrés pour cette sortie ({distKm} km,{' '}
              {formatDuration(stats.duration)}) seront définitivement effacés.
            </p>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowDiscardDialog(false)}
                className="flex-1 rounded-xl bg-white/10 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/15 transition"
              >
                Continuer la trace
              </button>
              <button
                onClick={() => {
                  setShowDiscardDialog(false)
                  onDiscard()
                }}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-600/30 hover:bg-red-500 transition"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
