import { useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight, ExternalLink, ChevronDown, ChevronUp, Images } from 'lucide-react'
import { cleanText } from '../lib/text'

const MAX_PREVIEW = 6

export default function Gallery({ photos }) {
  const [index, setIndex] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [broken, setBroken] = useState(() => new Set())
  const markBroken = (id) => setBroken((s) => new Set(s).add(id))
  const list = photos.filter((p) => !broken.has(p.id))

  const go = (delta) => setIndex((i) => (i + delta + list.length) % list.length)

  useEffect(() => {
    if (index === null) return
    const onKey = (e) => {
      if (e.key === 'Escape') setIndex(null)
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (list.length === 0) return null
  const current = index !== null ? list[index] : null

  const hasMore = list.length > MAX_PREVIEW
  const displayedPhotos = expanded || !hasMore ? list : list.slice(0, MAX_PREVIEW)
  const remainingCount = list.length - (MAX_PREVIEW - 1)

  return (
    <section className="flex flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
          <Images size={13} /> Photos ({list.length})
        </h2>
        {hasMore && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            {expanded ? 'Réduire' : `Tout voir (${list.length})`}
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {displayedPhotos.map((p, i) => {
          const isLastPreview = !expanded && hasMore && i === MAX_PREVIEW - 1

          return (
            <button
              key={p.id}
              onClick={() => {
                if (isLastPreview) {
                  setExpanded(true)
                } else {
                  setIndex(i)
                }
              }}
              className={`group relative overflow-hidden rounded-xl bg-white/10 transition-transform active:scale-95 ${
                i === 0 ? 'col-span-2 row-span-2' : ''
              }`}
              style={{ aspectRatio: '1' }}
            >
              <img
                src={i === 0 ? p.src : p.thumb}
                alt={cleanText(p.legend ?? '') || 'Photo du refuge'}
                loading="lazy"
                onError={() => markBroken(p.id)}
                className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-110 ${
                  isLastPreview ? 'brightness-50' : ''
                }`}
              />

              {/* Badge +N sur la dernière vignette quand la galerie est repliée */}
              {isLastPreview ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 backdrop-blur-[2px] text-white">
                  <span className="text-base font-bold tracking-tight">+{remainingCount}</span>
                  <span className="text-[10px] font-medium text-white/80">photos</span>
                </div>
              ) : (
                p.source && (
                  <span className="absolute bottom-1 right-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white/80 opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur-xs">
                    {p.source}
                  </span>
                )
              )}
            </button>
          )
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="glass-btn mt-2.5 flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2 text-xs font-medium text-white/90 hover:bg-white/15"
        >
          {expanded ? (
            <>
              <ChevronUp size={14} /> Réduire l'affichage des photos
            </>
          ) : (
            <>
              <ChevronDown size={14} /> Afficher les {list.length - MAX_PREVIEW} autres photos
            </>
          )}
        </button>
      )}

      {/* Lightbox plein écran */}
      {current && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setIndex(null)}
        >
          <button
            aria-label="Fermer"
            className="glass-btn glass absolute right-4 top-4 rounded-full p-2.5"
            onClick={() => setIndex(null)}
          >
            <X size={20} />
          </button>
          {list.length > 1 && (
            <>
              <button
                aria-label="Précédente"
                onClick={(e) => {
                  e.stopPropagation()
                  go(-1)
                }}
                className="glass-btn glass absolute left-4 rounded-full p-3"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                aria-label="Suivante"
                onClick={(e) => {
                  e.stopPropagation()
                  go(1)
                }}
                className="glass-btn glass absolute right-4 rounded-full p-3"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}
          <figure
            className="flex max-h-full max-w-5xl flex-col items-center gap-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={current.full || current.src}
              alt={cleanText(current.legend ?? '')}
              onError={(e) => {
                if (current.src && e.target.src !== current.src) {
                  e.target.src = current.src
                }
              }}
              className="max-h-[80vh] w-auto max-w-[90vw] rounded-2xl object-contain shadow-2xl"
            />
            <figcaption className="max-w-xl text-center text-sm text-white/85">
              {cleanText(current.legend ?? '')}
              <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-xs text-white/55">
                <span className="text-white/75">
                  {index + 1} / {list.length}
                </span>
                {current.source && (
                  <span className="rounded bg-white/10 px-2 py-0.5 font-medium text-white/75">
                    {current.source}
                  </span>
                )}
                {current.auteur && <span>{current.auteur}</span>}
                {current.date && <span>· {current.date.slice(0, 10)}</span>}
                {current.license && <span>({current.license})</span>}
                {current.pageUrl && (
                  <a
                    href={current.pageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sky-300 hover:underline"
                  >
                    Source <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </figcaption>
          </figure>
        </div>
      )}
    </section>
  )
}
