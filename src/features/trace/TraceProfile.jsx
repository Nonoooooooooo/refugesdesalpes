import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { slopeClass, aspectLabel } from './profile'
import SlopeFan from './SlopeFan.jsx'

// Palette « instrument », comme les panneaux météo et soleil
const ACCENT = '#ffaa00'
const AMBER = '#ffb020'

const W = 600
const H = 120
const TOP_PAD = 8

const fmt = (n, digits = 0) => n.toLocaleString('fr-FR', { maximumFractionDigits: digits })
const fmtDist = (m) => (m < 1000 ? `${fmt(m)} m` : `${fmt(m / 1000, m < 10000 ? 2 : 1)} km`)

function nearestIndex(samples, dist) {
  let lo = 0
  let hi = samples.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (samples[mid].dist < dist) lo = mid
    else hi = mid
  }
  return dist - samples[lo].dist < samples[hi].dist - dist ? lo : hi
}

function Label({ children }) {
  return (
    <div className="truncate text-[8px] font-semibold uppercase tracking-[0.12em] text-[#8a8a8a] sm:text-[9px] sm:tracking-[0.16em]">
      {children}
    </div>
  )
}

/** Champ de données : libellé, valeur condensée, unité, sous-ligne (masquée sur mobile pour gagner de la place) */
function Field({ label, value, unit, sub, accent }) {
  return (
    <div className="min-w-0 bg-black px-2 py-1.5 sm:px-3 sm:py-2">
      <Label>{label}</Label>
      <div
        className="font-din mt-0.5 flex items-baseline gap-0.5 text-[17px] leading-none font-semibold sm:mt-1 sm:text-[24px]"
        style={accent ? { color: accent } : undefined}
      >
        {value}
        {unit && <span className="text-[10px] font-medium text-[#8a8a8a] sm:text-[11px]">{unit}</span>}
      </div>
      {sub && <div className="mt-1 hidden truncate text-[9px] uppercase tracking-wider text-[#6b6b6b] sm:block">{sub}</div>}
    </div>
  )
}

function useChartGeometry(profile) {
  return useMemo(() => {
    if (!profile || profile.stats.minZ == null) return null
    const { samples, stats } = profile
    const range = Math.max(stats.maxZ - stats.minZ, 20)
    const zLow = stats.minZ - range * 0.08
    const zHigh = stats.maxZ + range * 0.08
    const x = (s) => (s.dist / stats.length) * W
    const y = (s) => TOP_PAD + (1 - (s.z - zLow) / (zHigh - zLow)) * (H - TOP_PAD)

    // Remplissage sous la courbe, découpé en tronçons de même classe de pente
    const fills = []
    let run = null
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i]
      const b = samples[i + 1]
      const cls = a.z != null && b.z != null ? slopeClass(a.slope) : null
      if (!cls) {
        run = null
        continue
      }
      if (!run || run.cls !== cls) {
        run = { cls, top: [[x(a), y(a)]] }
        fills.push(run)
      }
      run.top.push([x(b), y(b)])
    }
    const polygons = fills.map(({ cls, top }) => ({
      color: cls.color,
      opacity: cls.min >= 30 ? 0.85 : 0.1,
      points: [...top, [top[top.length - 1][0], H], [top[0][0], H]].map((p) => p.join(',')).join(' '),
    }))

    // Courbe d'altitude, interrompue hors couverture
    let line = ''
    let pen = false
    for (const s of samples) {
      if (s.z == null) {
        pen = false
        continue
      }
      line += `${pen ? 'L' : 'M'}${x(s).toFixed(1)},${y(s).toFixed(1)}`
      pen = true
    }
    return { polygons, line, x, y }
  }, [profile])
}

/** Lecture d'un point du tracé : altitude, distance, pente et orientation (bulle du profil et de la carte) */
export function SampleReadout({ sample }) {
  const cls = slopeClass(sample.slope)
  return (
    <span className="font-din whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-white">
      {sample.z != null ? `${fmt(sample.z)} m` : 'Hors couverture'} · {fmtDist(sample.dist)}
      {sample.slope != null && (
        <span style={{ color: cls?.min >= 30 ? cls.color : undefined }}>
          {' '}
          · {fmt(sample.slope)}° {aspectLabel(sample.aspect)}
        </span>
      )}
    </span>
  )
}

/** Profil altimétrique du tracé coloré par classe de pente, avec curseur synchronisé avec la carte. */
export default function TraceProfile({ status, profile, fresh, error, retry, hoverIdx, onHover }) {
  const geometry = useChartGeometry(profile)
  const samples = profile?.samples
  const hovered = hoverIdx != null && samples ? (samples[hoverIdx] ?? null) : null

  if (status === 'error' && !fresh) {
    return (
      <div className="flex items-center justify-between gap-3 border-t border-[#262626] px-3.5 py-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: AMBER }}>
            Signal indisponible
          </div>
          <div className="mt-1 text-[11px] text-[#8a8a8a]">{error}</div>
        </div>
        <button
          onClick={retry}
          className="flex shrink-0 items-center gap-1.5 rounded-sm border border-[#2b2b2b] px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white transition-colors hover:border-[#444] active:bg-[#1a1a1a]"
        >
          <RefreshCw size={12} /> Réessayer
        </button>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex h-[150px] items-center justify-center gap-3 border-t border-[#262626]">
        <span className="h-2 w-2 animate-pulse" style={{ background: ACCENT }} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a8a8a]">Calcul du profil IGN…</span>
      </div>
    )
  }

  const { stats } = profile
  const steepestCls = slopeClass(stats.steepest?.slope)

  const handlePointer = (e) => {
    if (!samples) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    onHover?.(nearestIndex(samples, ratio * stats.length))
  }
  const clearHover = () => onHover?.(null)

  const above30Km = stats.lengthAbove30 >= 1000

  return (
    <div className={`transition-opacity ${fresh ? '' : 'opacity-50'}`}>
      {/* ─── Champs de données ─── */}
      <div className="grid grid-cols-4 gap-px border-t border-[#262626] bg-[#262626]">
        <Field label="Dénivelé" value={`+${fmt(stats.gain)}`} sub={`−${fmt(stats.loss)} m`} />
        <Field
          label="Alt. max"
          value={stats.maxZ != null ? fmt(stats.maxZ) : '--'}
          sub={stats.minZ != null ? `min ${fmt(stats.minZ)} m` : undefined}
        />
        <Field
          label={
            <>
              <span className="sm:hidden">Pente</span>
              <span className="hidden sm:inline">Pente max</span>
            </>
          }
          value={stats.steepest ? `${fmt(stats.steepest.slope)}°` : '--'}
          unit={stats.steepest ? aspectLabel(stats.steepest.aspect) : undefined}
          accent={steepestCls?.min >= 30 ? steepestCls.color : undefined}
          sub="Orientation"
        />
        <Field
          label="≥ 30°"
          value={above30Km ? fmt(stats.lengthAbove30 / 1000, 1) : fmt(stats.lengthAbove30)}
          unit={above30Km ? 'km' : 'm'}
          accent={stats.lengthAbove30 > 0 ? ACCENT : undefined}
          sub="sur le tracé"
        />
      </div>

      {/* ─── Courbe d'altitude, avec l'éventail des pentes à sa gauche sur mobile ─── */}
      <div className="flex border-t border-[#262626]">
        <div className="flex shrink-0 items-center border-r border-[#262626] px-1.5 sm:hidden">
          <SlopeFan compact slope={hovered?.slope ?? null} maxSlope={stats.steepest?.slope ?? null} className="h-[78px] w-auto" />
        </div>
      {geometry && (
        <div className="min-w-0 flex-1 bg-[#050505] px-2 pt-2 pb-1.5">
          <div
            className="relative h-[74px] cursor-crosshair select-none sm:h-[92px]"
            style={{ touchAction: 'none' }}
            onPointerDown={handlePointer}
            onPointerMove={handlePointer}
            onPointerLeave={clearHover}
            onPointerCancel={clearHover}
          >
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
              <line x1="0" y1={H} x2={W} y2={H} stroke="#262626" vectorEffect="non-scaling-stroke" />
              {geometry.polygons.map((p, i) => (
                <polygon key={i} points={p.points} fill={p.color} fillOpacity={p.opacity} />
              ))}
              <path d={geometry.line} fill="none" stroke="#fff" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            </svg>
            <span className="font-din pointer-events-none absolute left-1 top-0.5 text-[10px] text-[#8a8a8a]">{fmt(stats.maxZ)} M</span>
            <span className="font-din pointer-events-none absolute bottom-0.5 left-1 text-[10px] text-[#8a8a8a]">{fmt(stats.minZ)} M</span>
            <span className="font-din pointer-events-none absolute bottom-0.5 right-1 text-[10px] uppercase text-[#8a8a8a]">
              {fmtDist(stats.length)}
            </span>

            {hovered && hovered.z != null && (
              <>
                <div
                  className="pointer-events-none absolute inset-y-0 w-px bg-white/70"
                  style={{ left: `${(geometry.x(hovered) / W) * 100}%` }}
                />
                <div
                  className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 border-2 border-white"
                  style={{
                    left: `${(geometry.x(hovered) / W) * 100}%`,
                    top: `${(geometry.y(hovered) / H) * 100}%`,
                    background: ACCENT,
                  }}
                />
                <div
                  className="pointer-events-none absolute -top-1 rounded-sm border border-[#2b2b2b] bg-black px-1.5 py-0.5"
                  style={{
                    left: `${(geometry.x(hovered) / W) * 100}%`,
                    transform: `translate(${-Math.min(100, Math.max(0, (geometry.x(hovered) / W) * 100))}%, -100%)`,
                  }}
                >
                  <SampleReadout sample={hovered} />
                </div>
              </>
            )}
          </div>
        </div>
      )}
      </div>

      <div className="hidden sm:block">
        <SlopeFan slope={hovered?.slope ?? null} maxSlope={stats.steepest?.slope ?? null} />
      </div>

      <div className="space-y-1 border-t border-[#262626] px-3 py-1.5 sm:px-3.5 sm:py-2">
        {status === 'loading' && (
          <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#8a8a8a]">
            <span className="h-1.5 w-1.5 animate-pulse" style={{ background: ACCENT }} /> Mise à jour du profil…
          </div>
        )}
        {stats.missing > 0 && (
          <p className="text-[10px] leading-snug" style={{ color: AMBER }}>
            Une partie du tracé est hors couverture IGN (Suisse, Italie) : pas d’altitude sur ce tronçon.
          </p>
        )}
        <p className="text-[8px] uppercase leading-snug tracking-wider text-[#6b6b6b] sm:text-[9px]">
          <span className="sm:hidden">Pente sur 20 m · IGN · indicatif</span>
          <span className="hidden sm:inline">
            Pente du terrain sur 20 m · RGE ALTI® IGN · indicatif, ne remplace pas l’observation sur place
          </span>
        </p>
      </div>
    </div>
  )
}
