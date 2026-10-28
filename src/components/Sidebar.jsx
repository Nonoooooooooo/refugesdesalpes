import { lazy, Suspense, useEffect, useState, useCallback } from 'react'
import {
  X,
  Loader2,
  TriangleAlert,
  Mountain,
  BedDouble,
  ExternalLink,
  RefreshCw,
  MessageSquare,
  FileText,
  CloudRain,
  CloudSun,
  Sun,
  Heart,
} from 'lucide-react'
import { fetchPoint } from '../lib/api'
import { fetchCommonsPhotos } from '../lib/wikimedia'
import { fetchGooglePlacesPhotos } from '../lib/google-places'
import { dedupePhotos } from '../lib/dedupe'
import { typeInfo, isPointClosed } from '../lib/types.jsx'
import { cleanText } from '../lib/text'
import { useFavorites } from '../context/FavoritesContext.jsx'
import Gallery from './Gallery.jsx'
import AvalancheModal from '../features/avalanche/AvalancheModal.jsx'
import AvalanchePdfModal from '../features/avalanche/AvalanchePdfModal.jsx'
import { findMassifByCoords } from '../features/avalanche/massifLookup'
import RefugeWeatherSection from '../features/meteo/RefugeWeatherSection.jsx'
import SunModal from '../features/sun/SunModal.jsx'

// Chargée à la demande : la vue 3D embarque MapLibre (~1 Mo), inutile au premier affichage de la carte
const Terrain3DModal = lazy(() => import('../features/terrain3d/Terrain3DModal.jsx'))

export default function Sidebar({ point, onClose, onOpenRadar }) {
  const [state, setState] = useState({ loading: true, error: null, data: null })
  const [attempt, setAttempt] = useState(0)
  const [show3D, setShow3D] = useState(false)
  const [showPdf, setShowPdf] = useState(false)
  const [showAvalanche, setShowAvalanche] = useState(false)
  const [showWeather, setShowWeather] = useState(false)
  const [showSunModal, setShowSunModal] = useState(false)
  const [massifInfo, setMassifInfo] = useState(null)

  useEffect(() => {
    let active = true
    if (point?.lat != null && point?.lng != null) {
      findMassifByCoords(point.lat, point.lng).then((info) => {
        if (active) setMassifInfo(info)
      })
    } else {
      setMassifInfo(null)
    }
    return () => {
      active = false
    }
  }, [point?.lat, point?.lng])

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
  const { isFavorite, toggleFavorite } = useFavorites()
  const isFav = isFavorite(point.id)

  const handleToggleFav = () => {
    toggleFavorite({
      id: point.id,
      nom: d?.nom ?? point.nom,
      type: d?.type ?? point.type,
      alt: d?.alt ?? point.alt,
      lat: point.lat,
      lng: point.lng,
      places: d?.places ?? point.places,
      etat: d?.etat ?? point.etat,
    })
  }

  const etatValue = d?.etat ?? point.etat
  const isClosed = isPointClosed(etatValue)

  return (
    <>
      <aside className="sidebar-enter glass glass-panel scroll-thin absolute bottom-0 left-0 top-0 z-[1100] flex w-full flex-col overflow-y-auto sm:bottom-4 sm:left-4 sm:top-4 sm:w-[420px] sm:rounded-3xl">
        <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-white/10 bg-black/30 p-5 pt-[max(1.25rem,env(safe-area-inset-top,0px))] backdrop-blur-xl">
          <span
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ background: isClosed ? '#ef4444' : color }}
          >
            <Icon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold leading-tight">{d?.nom ?? point.nom}</h1>
              {isClosed && (
                <span className="rounded-md bg-red-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider shadow-sm">
                  {etatValue}
                </span>
              )}
            </div>
            <p className="text-sm text-white/70">{d?.type ?? point.type ?? label}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              onClick={handleToggleFav}
              className={`glass-btn flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                isFav
                  ? 'border border-amber-400/40 bg-amber-400/15 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                  : 'text-white/70 hover:text-amber-300 hover:bg-white/10'
              }`}
            >
              <Heart
                size={17}
                className={isFav ? 'fill-amber-400 text-amber-400 scale-105 transition-transform' : ''}
              />
            </button>
            <button
              aria-label="Fermer"
              onClick={onClose}
              className="glass-btn flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-5 p-5 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
          {/* Alerte fermeture ou destruction */}
          {isClosed && (
            <div className="rounded-2xl border border-red-500/45 bg-red-950/45 p-4 text-sm text-red-100 shadow-xl backdrop-blur-md flex items-start gap-3">
              <span className="text-2xl shrink-0 leading-none">🚫</span>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-red-200 uppercase tracking-wide text-xs">
                  {etatValue === 'Détruite' ? 'Bâtiment détruit / Ruines' : 'Hébergement fermé / Non utilisable'}
                </div>
                <p className="mt-1 text-xs text-red-200/90 leading-relaxed">
                  {d?.remarque ? cleanText(d.remarque) : d?.description ? cleanText(d.description).slice(0, 180) + '…' : 'Cet hébergement est indiqué comme fermé ou inutilisable pour dormir sur Refuges.info.'}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {(d?.alt ?? point.alt) != null && (
              <Chip icon={<Mountain size={14} />}>{d?.alt ?? point.alt} m</Chip>
            )}
            {(d?.places ?? point.places) > 0 && (
              <Chip icon={<BedDouble size={14} />}>{d?.places ?? point.places} places</Chip>
            )}
            {etatValue && (
              <Chip className={isClosed ? 'border border-red-500/50 bg-red-500/25 text-red-200 font-semibold' : ''}>
                {etatValue}
              </Chip>
            )}
          </div>

          {/* Boutons d'actions rapides (Vue 3D, Radar Météo et Bulletin Avalanche BERA) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShow3D(true)}
              className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 text-xs font-medium text-white/75 hover:text-white transition-all active:scale-95"
            >
              Vue 3D
            </button>

            <button
              onClick={() => setShowWeather((v) => !v)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all active:scale-95 flex items-center gap-1.5 ${
                showWeather
                  ? 'border border-[#ffaa00]/50 bg-[#ffaa00]/20 text-[#ffd180] shadow-sm font-semibold'
                  : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white/75 hover:text-white'
              }`}
              title="Consulter les prévisions météo d'altitude au refuge (3 jours)"
            >
              <CloudSun size={13} className={showWeather ? 'text-[#ffbf40]' : 'text-white/70'} />
              <span>Météo</span>
            </button>

            <button
              onClick={() => setShowSunModal(true)}
              className="rounded-xl px-3 py-1.5 text-xs font-medium transition-all active:scale-95 flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/75 hover:text-white"
              title="Consulter l'éphéméride et la courbe d'ensoleillement au refuge"
            >
              <Sun size={13} className="text-amber-300" />
              <span>Soleil</span>
            </button>

            {massifInfo && (
              <button
                onClick={() => setShowPdf(true)}
                className="group rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 text-xs font-medium text-white/75 hover:text-white transition-all active:scale-95 flex items-center gap-1.5"
                title={`Consulter le bulletin officiel PDF de Météo-France pour le massif ${massifInfo.label}`}
              >
                <span>⚠️</span>
                <span>Bulletin Avalanche (PDF)</span>
                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70">
                  {massifInfo.label}
                </span>
              </button>
            )}
          </div>

          {/* Section Météo locale au refuge (affichée au clic sur le bouton Météo) */}
          {showWeather && point.lat != null && point.lng != null && (
            <RefugeWeatherSection
              lat={point.lat}
              lng={point.lng}
              alt={d?.alt ?? point.alt}
              nom={d?.nom ?? point.nom}
              onOpenRadar={() => onOpenRadar?.(point)}
            />
          )}

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
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {showPdf && massifInfo && (
        <AvalanchePdfModal
          massif={massifInfo}
          point={{
            ...point,
            nom: d?.nom ?? point.nom,
            alt: d?.alt ?? point.alt,
            type: d?.type ?? point.type,
            lat: point.lat,
            lng: point.lng,
          }}
          onClose={() => setShowPdf(false)}
        />
      )}

      {showAvalanche && massifInfo && (
        <AvalancheModal
          massif={massifInfo}
          point={{
            ...point,
            nom: d?.nom ?? point.nom,
            alt: d?.alt ?? point.alt,
            type: d?.type ?? point.type,
            lat: point.lat,
            lng: point.lng,
          }}
          onClose={() => setShowAvalanche(false)}
        />
      )}

      {showSunModal && (
        <SunModal
          point={{
            ...point,
            nom: d?.nom ?? point.nom,
            alt: d?.alt ?? point.alt,
            lat: point.lat,
            lng: point.lng,
          }}
          onClose={() => setShowSunModal(false)}
        />
      )}
    </>
  )
}

function Chip({ icon, children, className = '' }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${className || 'bg-white/12'}`}
      style={className ? undefined : { background: 'rgba(255,255,255,0.12)' }}
    >
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
