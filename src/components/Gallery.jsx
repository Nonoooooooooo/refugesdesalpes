import { useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cleanText } from '../lib/text'

export default function Gallery({ photos }) {
  const [index, setIndex] = useState(null)
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

  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
        Photos ({list.length})
      </h2>
      <div className="grid grid-cols-3 gap-2">
        {list.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setIndex(i)}
            className={`group relative overflow-hidden rounded-xl bg-white/10 ${i === 0 ? 'col-span-2 row-span-2' : ''}`}
            style={{ aspectRatio: i === 0 ? '1' : '1' }}
          >
            <img
              src={i === 0 ? p.src : p.thumb}
              alt={cleanText(p.legend ?? '') || 'Photo du refuge'}
              loading="lazy"
              onError={() => markBroken(p.id)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
          </button>
        ))}
      </div>

      {current && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setIndex(null)}
        >
          <button aria-label="Fermer" className="glass-btn glass absolute right-4 top-4 rounded-full p-2.5">
            <X size={20} />
          </button>
          {list.length > 1 && (
            <>
              <button
                aria-label="Précédente"
                onClick={(e) => { e.stopPropagation(); go(-1) }}
                className="glass-btn glass absolute left-4 rounded-full p-3"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                aria-label="Suivante"
                onClick={(e) => { e.stopPropagation(); go(1) }}
                className="glass-btn glass absolute right-4 rounded-full p-3"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}
          <figure className="flex max-h-full max-w-5xl flex-col items-center gap-3 text-white" onClick={(e) => e.stopPropagation()}>
            <img src={current.src} alt="" className="max-h-[80vh] rounded-2xl object-contain shadow-2xl" />
            <figcaption className="max-w-xl text-center text-sm text-white/80">
              {cleanText(current.legend ?? '')}
              <div className="mt-1 text-xs text-white/50">
                {current.auteur} {current.date && `· ${current.date.slice(0, 10)}`}
              </div>
            </figcaption>
          </figure>
        </div>
      )}
    </section>
  )
}
