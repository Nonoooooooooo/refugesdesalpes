import { useEffect, useState, useCallback } from 'react'
import { X, Loader2, TriangleAlert, Mountain, BedDouble, ExternalLink, RefreshCw, MessageSquare, Box } from 'lucide-react'
import { fetchPoint } from '../lib/api'
import { fetchCommonsPhotos } from '../lib/wikimedia'
import { fetchGooglePlacesPhotos } from '../lib/google-places'
import { dedupePhotos } from '../lib/dedupe'
import { typeInfo } from '../lib/types.jsx'
import { cleanText } from '../lib/text'
import Gallery from './Gallery.jsx'
import Terrain3DModal from '../features/terrain3d/Terrain3DModal.jsx'

export default function Sidebar({ point, onClose }) {
  const [state, setState] = useState({ loading: true, error: null, data: null })
  const [attempt, setAttempt] = useState(0)
  const [show3D, setShow3D] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    setState({ loading: true, error: null, data: null })

    async function loadData() {
      try {
        const [pointDetails, wikiPhotos, googlePhotos] = await Promise.all([
          fetchPoint(point.id, ctrl.signal),
          fetchCommonsPhotos(point.lat, point.lng, ctrl.signal, 300).catch((e) => {
            if (ctrl.signal.aborted) throw e
            return []
          }),
          fetchGooglePlacesPhotos(point.nom, point.lat, point.lng, ctrl.signal).catch((e) => {
            if (ctrl.signal.aborted) throw e
            return []
          }),
        ])

        if (ctrl.signal.aborted) return

        // Dédoublonnage exact + perceptuel (dHash) entre Refuges, Wikimedia et Google Maps
        const mergedPhotos = await dedupePhotos([
          ...pointDetails.photos,
          ...wikiPhotos,
          ...googlePhotos,
        ])
        pointDetails.photos = mergedPhotos

        setState({ loading: false, error: null, data: pointDetails })
      } catch (e) {
        if (!ctrl.signal.aborted) {
          setState({ loading: false, error: e.message, data: null })
        }
      }
    }

    loadData()
    return () => ctrl.abort()
  }, [point.id, point.lat, point.lng, attempt])

  const retry = useCallback(() => setAttempt((a) => a + 1), [])
  const { color, Icon, label } = typeInfo(point.type)
  const d = state.data
  const description = d && cleanText(d.description)

  return (
    <>
      <aside className="sidebar-enter glass glass-panel scroll-thin absolute bottom-0 left-0 top-0 z-[1100] flex w-full flex-col overflow-y-auto sm:bottom-4 sm:left-4 sm:top-4 sm:w-[420px] sm:rounded-3xl">
        <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-white/10 bg-black/30 p-5 backdrop-blur-xl">
          <span
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ background: color }}
          >
            <Icon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold leading-tight">{d?.nom ?? point.nom}</h1>
            <p className="text-sm text-white/70">{d?.type ?? point.type ?? label}</p>
          </div>
          <button aria-label="Fermer" onClick={onClose} className="glass-btn rounded-full p-2">
            <X size={18} />
          </button>
        </header>

        <div className="flex flex-col gap-5 p-5">
          <div className="flex flex-wrap gap-2">
            {(d?.alt ?? point.alt) != null && (
              <Chip icon={<Mountain size={14} />}>{d?.alt ?? point.alt} m</Chip>
            )}
            {(d?.places ?? point.places) > 0 && (
              <Chip icon={<BedDouble size={14} />}>{d?.places ?? point.places} places</Chip>
            )}
            {(d?.etat ?? point.etat) && <Chip>{d?.etat ?? point.etat}</Chip>}
          </div>

          {/* Bouton Vue 3D immersive */}
          <button
            onClick={() => setShow3D(true)}
            className="glass-btn flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600/30 via-teal-600/30 to-sky-600/30 hover:from-emerald-600/45 hover:to-sky-600/45 border border-emerald-400/40 py-2.5 px-4 text-sm font-semibold text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.25)] transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Box size={16} className="text-emerald-300" />
            <span>Vue 3D immersive</span>
          </button>

          {state.loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-white/70">
              <Loader2 size={18} className="animate-spin" /> Chargement des détails…
            </div>
          )}

          {state.error && (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-red-500/15 p-4 text-center text-sm">
              <TriangleAlert className="text-red-300" />
              {state.error}
              <button onClick={retry} className="glass-btn flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5">
                <RefreshCw size={14} /> Réessayer
              </button>
            </div>
          )}

          {d && (
            <>
              {d.photos.length > 0 && <Gallery photos={d.photos} />}

              {description && (
                <Section title="Description">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-white/85">{description}</p>
                </Section>
              )}

              {d.acces && (
                <Section title="Accès">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-white/85">{cleanText(d.acces)}</p>
                </Section>
              )}

              {d.equipements.length > 0 && (
                <Section title="Équipements">
                  <ul className="grid grid-cols-2 gap-2">
                    {d.equipements.map((e) => (
                      <li key={e.nom} className="rounded-xl bg-white/8 px-3 py-2 text-xs" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className="text-white/60">{e.nom}</div>
                        <div className="font-medium">{String(e.valeur)}</div>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {d.comments.length > 0 && <Comments comments={d.comments} />}

              {d.lien && (
                <a
                  href={d.lien}
                  target="_blank"
                  rel="noreferrer"
                  className="glass-btn flex items-center justify-center gap-2 rounded-2xl bg-white/10 py-2.5 text-sm font-medium"
                >
                  Voir sur Refuges.info <ExternalLink size={14} />
                </a>
              )}
            </>
          )}
        </div>
      </aside>

      {show3D && (
        <Terrain3DModal
          point={{
            ...point,
            nom: d?.nom ?? point.nom,
            alt: d?.alt ?? point.alt,
            type: d?.type ?? point.type,
            lat: point.lat,
            lng: point.lng,
          }}
          onClose={() => setShow3D(false)}
        />
      )}
    </>
  )
}

function Chip({ icon, children }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs font-medium" style={{ background: 'rgba(255,255,255,0.12)' }}>
      {icon}
      {children}
    </span>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">{title}</h2>
      {children}
    </section>
  )
}

const COMMENTS_PREVIEW = 4
const fmtDate = (s) => {
  const d = new Date(String(s).replace(' ', 'T').slice(0, 19))
  return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Comments({ comments }) {
  const [all, setAll] = useState(false)
  const shown = all ? comments : comments.slice(0, COMMENTS_PREVIEW)
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
        <MessageSquare size={13} /> Commentaires ({comments.length})
      </h2>
      <ul className="flex flex-col gap-2.5">
        {shown.map((c) => (
          <li key={c.id} className="rounded-2xl p-3.5" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-white/90">{c.auteur || 'Anonyme'}</span>
              <span className="text-white/45">{fmtDate(c.date)}</span>
            </div>
            <p className="whitespace-pre-line break-words text-[13px] leading-relaxed text-white/80">
              {cleanText(c.texte)}
            </p>
          </li>
        ))}
      </ul>
      {comments.length > COMMENTS_PREVIEW && (
        <button
          onClick={() => setAll((v) => !v)}
          className="glass-btn mt-3 w-full rounded-xl bg-white/10 py-2 text-xs font-medium"
        >
          {all ? 'Réduire' : `Voir les ${comments.length - COMMENTS_PREVIEW} autres commentaires`}
        </button>
      )}
    </section>
  )
}
