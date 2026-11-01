import { useState, useRef } from 'react'
import {
  X,
  Play,
  Download,
  Trash2,
  Upload,
  Mountain,
  Route,
  Clock,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  LineChart,
  Footprints,
  Compass,
  AlertCircle,
  Check,
} from 'lucide-react'
import { downloadGPXFile, parseGPX, deleteTrack, updateTrack, saveTrack } from './trackStorage'

function formatDuration(sec) {
  const s = Math.max(0, Math.floor(sec || 0))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m ${seconds}s`
}

function MiniElevationPreview({ points }) {
  if (!points || points.length < 2) return null
  const valid = points.filter((p) => p.alt != null && !isNaN(p.alt))
  if (valid.length < 2) return null

  const min = Math.min(...valid.map((p) => p.alt))
  const max = Math.max(...valid.map((p) => p.alt))
  const range = Math.max(10, max - min)

  const w = 120
  const h = 32
  const maxDist = valid[valid.length - 1].cumDist || 1

  const pts = valid.map((p) => {
    const x = ((p.cumDist || 0) / maxDist) * w
    const y = h - ((p.alt - min) / range) * (h - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return (
    <div className="w-[120px] h-[32px] shrink-0 opacity-75">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full overflow-visible">
        <polyline
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pts.join(' ')}
        />
      </svg>
    </div>
  )
}

export default function TracksModal({
  isOpen,
  onClose,
  tracks = [],
  onTracksUpdated,
  isRecording = false,
  onStartRecording,
  selectedTrackToView = null,
  onSelectTrackToView,
  onOpenProfile,
  onFollowTrackInFog,
}) {
  const fileInputRef = useRef(null)
  const [importError, setImportError] = useState(null)
  const [importSuccess, setImportSuccess] = useState(null)
  const [editingTrackId, setEditingTrackId] = useState(null)
  const [editingName, setEditingName] = useState('')

  if (!isOpen) return null

  // Import GPX
  const handleFileChange = async (e) => {
    setImportError(null)
    setImportSuccess(null)
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const newTrack = parseGPX(text, file.name)
      await saveTrack(newTrack)
      setImportSuccess(`Tracé « ${newTrack.name} » importé avec succès (${(newTrack.distance / 1000).toFixed(2)} km)`)
      onTracksUpdated?.()
      onSelectTrackToView?.(newTrack)
    } catch (err) {
      setImportError(err.message || "Erreur lors de l'import du fichier GPX.")
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Renommer une trace
  const handleStartEdit = (track) => {
    setEditingTrackId(track.id)
    setEditingName(track.name)
  }

  const handleSaveEdit = async (trackId) => {
    if (editingName.trim()) {
      await updateTrack(trackId, { name: editingName.trim() })
      onTracksUpdated?.()
    }
    setEditingTrackId(null)
  }

  // Supprimer une trace
  const handleDelete = async (trackId, trackName) => {
    if (window.confirm(`Supprimer définitivement la trace « ${trackName} » ?`)) {
      await deleteTrack(trackId)
      if (selectedTrackToView?.id === trackId) {
        onSelectTrackToView?.(null)
      }
      onTracksUpdated?.()
    }
  }

  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass relative flex w-full max-w-2xl max-h-[90vh] flex-col rounded-3xl border border-white/20 bg-slate-950/95 p-4 sm:p-6 shadow-2xl overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/25">
              <Footprints size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Mes Traces GPS & Randonnées
                <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-300 border border-orange-500/30">
                  {tracks.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                100% Hors-ligne · Enregistrement direct & Sécurité brouillard
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:bg-white/15 hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Barre d'action : Démarrer ou Importer GPX */}
        <div className="flex flex-wrap items-center justify-between gap-2 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            {!isRecording ? (
              <button
                onClick={() => {
                  onClose()
                  onStartRecording?.()
                }}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-orange-600/25 hover:opacity-95 transition"
              >
                <Play size={14} fill="#ffffff" />
                <span>Nouvel enregistrement en direct</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-red-500/20 border border-red-500/30 px-3 py-1.5 text-xs font-bold text-red-300">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span>Enregistrement en cours…</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".gpx,application/gpx+xml"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 text-xs font-semibold text-slate-200 transition"
              title="Importer un fichier GPX depuis votre appareil"
            >
              <Upload size={14} className="text-amber-400" />
              <span>Importer GPX</span>
            </button>
          </div>
        </div>

        {/* Notifications import */}
        {importError && (
          <div className="mt-2 flex items-center gap-2 rounded-2xl bg-red-500/20 border border-red-500/30 p-2.5 text-xs text-red-200">
            <AlertCircle size={15} className="shrink-0 text-red-400" />
            <span className="flex-1">{importError}</span>
            <button onClick={() => setImportError(null)}>
              <X size={14} />
            </button>
          </div>
        )}
        {importSuccess && (
          <div className="mt-2 flex items-center gap-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 p-2.5 text-xs text-emerald-200">
            <Check size={15} className="shrink-0 text-emerald-400" />
            <span className="flex-1">{importSuccess}</span>
            <button onClick={() => setImportSuccess(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Liste des traces */}
        <div className="flex-1 overflow-y-auto scroll-thin py-3 space-y-2.5 pr-1">
          {tracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/5 p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/20 text-orange-400 mb-3">
                <Footprints size={24} />
              </div>
              <h3 className="text-sm font-bold text-white">Aucune trace enregistrée pour le moment</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
                Activez l’enregistrement GPS en direct pour tracer vos pas en temps réel comme sur Strava. 
                Indispensable en montagne pour retrouver votre chemin dans la neige ou le brouillard !
              </p>
              {!isRecording && (
                <button
                  onClick={() => {
                    onClose()
                    onStartRecording?.()
                  }}
                  className="mt-4 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-orange-600/30 hover:opacity-95 transition"
                >
                  <Play size={14} fill="#ffffff" />
                  Démarrer mon premier enregistrement
                </button>
              )}
            </div>
          ) : (
            tracks.map((track) => {
              const isSelected = selectedTrackToView?.id === track.id
              const isEditing = editingTrackId === track.id
              const dateStr = new Date(track.startTime || track.createdAt).toLocaleDateString(
                'fr-FR',
                {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                },
              )

              return (
                <div
                  key={track.id}
                  className={`rounded-2xl border p-3 sm:p-3.5 transition-all ${
                    isSelected
                      ? 'border-emerald-500/60 bg-emerald-950/30 ring-1 ring-emerald-500/30 shadow-lg'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 mb-1">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="rounded-lg bg-black/60 border border-orange-500 px-2 py-0.5 text-xs text-white focus:outline-none w-full max-w-xs"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(track.id)}
                            className="rounded-lg bg-orange-600 p-1 text-white hover:bg-orange-500"
                            title="Valider"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            onClick={() => setEditingTrackId(null)}
                            className="rounded-lg bg-white/10 p-1 text-slate-400 hover:text-white"
                            title="Annuler"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h4
                            onClick={() => handleStartEdit(track)}
                            title="Cliquer pour renommer"
                            className="text-sm font-bold text-white truncate cursor-pointer hover:text-orange-300 transition"
                          >
                            {track.name}
                          </h4>
                          <span className="text-[10px] text-slate-500 shrink-0">{dateStr}</span>
                        </div>
                      )}

                      {/* Métriques clés */}
                      <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                        <span className="flex items-center gap-1 font-semibold text-white">
                          <Route size={12} className="text-blue-400" />
                          {(track.distance / 1000).toFixed(2)} km
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-emerald-400">
                          <TrendingUp size={12} />
                          +{Math.round(track.elevationGain || 0)} m
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-amber-400">
                          <TrendingDown size={12} />
                          -{Math.round(track.elevationLoss || 0)} m
                        </span>
                        <span className="flex items-center gap-1 text-slate-300">
                          <Clock size={12} className="text-slate-400" />
                          {formatDuration(track.duration)}
                        </span>
                        {track.maxAltitude != null && (
                          <span className="flex items-center gap-1 text-slate-400 text-[11px]">
                            <Mountain size={11} className="text-purple-400" />
                            {track.maxAltitude} m max
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Aperçu miniature SVG */}
                    <MiniElevationPreview points={track.points} />
                  </div>

                  {/* Boutons d'action pour la trace */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                      {/* Afficher sur la carte */}
                      <button
                        onClick={() => {
                          if (isSelected) {
                            onSelectTrackToView?.(null)
                          } else {
                            onSelectTrackToView?.(track)
                            onClose()
                          }
                        }}
                        className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold transition ${
                          isSelected
                            ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                            : 'bg-white/10 text-slate-200 hover:bg-white/20'
                        }`}
                        title={isSelected ? 'Masquer de la carte' : 'Afficher sur la carte'}
                      >
                        {isSelected ? <EyeOff size={13} /> : <Eye size={13} />}
                        <span>{isSelected ? 'Masquer' : 'Voir sur la carte'}</span>
                      </button>

                      {/* Profil altimétrique */}
                      <button
                        onClick={() => onOpenProfile?.(track)}
                        className="flex items-center gap-1 rounded-xl bg-white/10 hover:bg-white/20 px-2.5 py-1 text-xs font-semibold text-slate-200 transition"
                        title="Ouvrir le profil altimétrique détaillé"
                      >
                        <LineChart size={13} className="text-amber-400" />
                        <span className="hidden sm:inline">Profil</span>
                      </button>

                      {/* Fil d'Ariane pour cette trace */}
                      <button
                        onClick={() => {
                          onFollowTrackInFog?.(track)
                          onClose()
                        }}
                        className="flex items-center gap-1 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 px-2.5 py-1 text-xs font-semibold text-cyan-200 transition"
                        title="Suivre cette trace pour revenir sur ses pas dans le brouillard / neige"
                      >
                        <Compass size={13} className="text-cyan-400" />
                        <span className="hidden sm:inline">Suivre trace (Brouillard)</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Télécharger GPX */}
                      <button
                        onClick={() => downloadGPXFile(track)}
                        className="flex items-center gap-1 rounded-xl bg-white/10 hover:bg-white/20 px-2.5 py-1 text-xs font-semibold text-slate-200 transition"
                        title="Exporter et télécharger au format GPX (compatible Strava, Garmin, IGN)"
                      >
                        <Download size={13} className="text-blue-400" />
                        <span className="hidden sm:inline">GPX</span>
                      </button>

                      {/* Supprimer */}
                      <button
                        onClick={() => handleDelete(track.id, track.name)}
                        className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition"
                        title="Supprimer la trace"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Pied de page informatif */}
        <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            ❄️ En montagne sans réseau, votre GPS satellite reste 100% fonctionnel.
          </span>
          <button
            onClick={onClose}
            className="rounded-xl bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
