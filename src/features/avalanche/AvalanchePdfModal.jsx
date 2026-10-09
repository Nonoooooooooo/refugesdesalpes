import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  X,
  Download,
  ExternalLink,
  RefreshCw,
  Loader2,
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import {
  fetchAvalanchePdfBlob,
  register1605Scheduler,
} from './avalancheService'

/**
 * Modale Lightbox affichant le PDF officiel Météo-France du BERA,
 * exactement de la même manière qu'une photo de refuge en plein écran.
 */
export default function AvalanchePdfModal({ massif, point, onClose }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null)
  const [fetchedAt, setFetchedAt] = useState(null)
  const blobUrlRef = useRef(null)

  const loadPdf = useCallback(
    async (force = false) => {
      if (!massif) return
      setLoading(true)
      setError(null)

      try {
        const { blob, timestamp } = await fetchAvalanchePdfBlob(massif.id, force)

        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current)
        }

        const url = URL.createObjectURL(blob)
        blobUrlRef.current = url
        setPdfBlobUrl(url)
        setFetchedAt(timestamp)
      } catch (err) {
        console.error('Erreur chargement PDF BERA :', err)
        setError(err.message || 'Impossible de récupérer le PDF de Météo-France')
      } finally {
        setLoading(false)
      }
    },
    [massif],
  )

  useEffect(() => {
    loadPdf()
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [loadPdf])

  // Programmation de la mise à jour automatique à 16h05
  useEffect(() => {
    const unregister = register1605Scheduler(() => {
      console.log('⏰ 16h05 : actualisation automatique du PDF BERA Météo-France...')
      loadPdf(true)
    })
    return () => unregister()
  }, [loadPdf])

  // Fermeture clavier avec la touche Échap
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/85 p-2 sm:p-4 md:p-6 backdrop-blur-md animate-fadeIn select-none"
      onClick={onClose}
    >
      <div
        className="relative flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 bg-slate-950 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* BARRE SUPÉRIEURE (HEADER STYLE LIGHTBOX PHOTO) */}
        <header className="flex items-center justify-between border-b border-white/10 bg-slate-900/95 px-4 sm:px-6 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
              <FileText size={20} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold leading-tight truncate text-white">
                  Bulletin d'Avalanche · Massif {massif.label}
                </h2>
                <span className="hidden sm:inline-block rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/70">
                  BERA #{massif.id}
                </span>
              </div>
              <p className="text-[11px] text-white/60 truncate">
                {point?.nom ? `Pour : ${point.nom}` : 'Document officiel Météo-France'}
                {point?.alt ? ` (${point.alt} m)` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {pdfBlobUrl && (
              <>
                <a
                  href={pdfBlobUrl}
                  download={`BERA-${massif.label}-${massif.id}.pdf`}
                  title="Télécharger le bulletin PDF officiel"
                  className="glass-btn flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition-all active:scale-95"
                >
                  <Download size={16} />
                </a>
                <a
                  href={pdfBlobUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Ouvrir le PDF dans un nouvel onglet"
                  className="glass-btn flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition-all active:scale-95"
                >
                  <ExternalLink size={16} />
                </a>
              </>
            )}

            <button
              onClick={() => loadPdf(true)}
              title="Rafraîchir le bulletin (Mise à jour 16h05)"
              className="glass-btn flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition-all active:scale-95"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin text-sky-400' : ''} />
            </button>

            <button
              onClick={onClose}
              aria-label="Fermer"
              className="glass-btn flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-red-500/30 text-white hover:text-white transition-all active:scale-95 ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* ZONE CENTRALE : VISIONNEUSE DU PDF OFFICIEL */}
        <div className="relative flex-1 overflow-hidden bg-slate-900">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950/80 backdrop-blur-sm">
              <Loader2 size={32} className="animate-spin text-sky-400" />
              <p className="text-sm font-medium text-white/80">
                Téléchargement du bulletin officiel Météo-France...
              </p>
              <p className="text-xs text-white/50">
                Massif {massif.label} (code {massif.id})
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center text-white">
              <div className="rounded-full bg-red-500/20 p-4 text-red-400 border border-red-500/30">
                <AlertTriangle size={32} />
              </div>
              <div className="max-w-md space-y-1">
                <h3 className="text-base font-semibold text-white">
                  Impossible d'afficher le bulletin PDF
                </h3>
                <p className="text-xs text-white/70 leading-relaxed">{error}</p>
              </div>
              <button
                onClick={() => loadPdf(true)}
                className="glass-btn flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2 text-xs font-medium text-white transition-all"
              >
                <RefreshCw size={14} /> Réessayer
              </button>
            </div>
          )}

          {pdfBlobUrl && !error && (
            <iframe
              src={`${pdfBlobUrl}#view=FitH&toolbar=1&navpanes=0`}
              title={`Bulletin d'Estimation du Risque d'Avalanche - Massif ${massif.label}`}
              className="h-full w-full border-0 bg-white"
            />
          )}
        </div>

        {/* PIED DE LA MODALE AVEC RAPPEL DU CYCLE DE DIFFUSION 16h05 */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-slate-900/95 px-4 sm:px-6 py-2.5 text-xs text-white/70 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-sky-400 shrink-0" />
            <span>
              Mise à jour quotidienne Météo-France :{' '}
              <strong className="text-sky-300">16h05 tous les jours</strong>
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-white/50">
            {fetchedAt && (
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 size={12} />
                Récupéré à {new Date(fetchedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <span>Source : Météo-France (DPBRA)</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
