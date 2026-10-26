import { useId } from 'react'
import { SLOPE_CLASSES } from './profile'

// Éventail des angles de pente : le sommet est en bas à droite, l'horizontale part vers la gauche
const OX = 146
const OY = 118
const R = 112

const classColor = (key) => SLOPE_CLASSES.find((c) => c.key === key).color

const SECTORS = [
  { from: 25, to: 30, color: classColor('p0'), opacity: 0.22 },
  { from: 30, to: 35, color: classColor('p30'), opacity: 0.9 },
  { from: 35, to: 40, color: classColor('p35'), opacity: 0.9 },
  { from: 40, to: 45, color: classColor('p40'), opacity: 0.9 },
  { from: 45, to: 60, color: classColor('p45'), opacity: 0.5 },
]

const LEGEND = [
  { color: classColor('p45'), label: '45–60°', note: 'peu fréquent', opacity: 0.5 },
  { color: classColor('p40'), label: '40–45°' },
  { color: classColor('p35'), label: '35–40°', note: 'les plus fréquents', strong: true },
  { color: classColor('p30'), label: '30–35°' },
  { color: classColor('p0'), label: '25–30°', note: 'rare', opacity: 0.22 },
]

function polar(deg, r = R) {
  const a = (deg * Math.PI) / 180
  return [OX - r * Math.cos(a), OY - r * Math.sin(a)]
}

function sectorPath(from, to) {
  const [x1, y1] = polar(from)
  const [x2, y2] = polar(to)
  return `M${OX},${OY} L${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 0 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`
}

function Needle({ deg, dashed }) {
  const [x, y] = polar(Math.min(deg, 89), R + 4)
  return (
    <line
      x1={OX}
      y1={OY}
      x2={x}
      y2={y}
      stroke="#fff"
      strokeWidth={dashed ? 1.2 : 2}
      strokeDasharray={dashed ? '3 3' : undefined}
      strokeLinecap="round"
      opacity={dashed ? 0.7 : 1}
    />
  )
}

/** Dessin de l'éventail seul */
function FanSvg({ slope, maxSlope, className }) {
  const [arcStartX, arcStartY] = polar(25, R + 14)
  const [arcEndX, arcEndY] = polar(60, R + 14)
  // Identifiant unique : l'éventail peut être présent deux fois (bandeau mobile et panneau PC)
  const arcId = useId()

  return (
    <svg viewBox="24 0 128 124" className={className} aria-hidden>
        <defs>
          <path id={arcId} d={`M${arcStartX},${arcStartY} A${R + 14},${R + 14} 0 0 1 ${arcEndX},${arcEndY}`} />
        </defs>

        {/* Horizontale de référence */}
        <line x1={OX} y1={OY} x2={OX - R - 6} y2={OY} stroke="#fff" strokeOpacity="0.25" strokeWidth="1" />

        {SECTORS.map((s) => (
          <path key={s.from} d={sectorPath(s.from, s.to)} fill={s.color} fillOpacity={s.opacity} />
        ))}

        {[25, 30, 45, 60].map((deg) => {
          const [x, y] = polar(deg)
          const [lx, ly] = polar(deg, R + 9)
          return (
            <g key={deg}>
              <line x1={OX} y1={OY} x2={x} y2={y} stroke="#ffaa00" strokeWidth="1" strokeOpacity="0.8" />
              <text x={lx} y={ly} fill="#fff" fillOpacity="0.75" fontSize="8" fontWeight="600" textAnchor="middle" dominantBaseline="middle">
                {deg}°
              </text>
            </g>
          )
        })}

        {/* Arc « avalanches de plaque possibles » de 25 à 60° */}
        <path d={`M${arcStartX},${arcStartY} A${R + 14},${R + 14} 0 0 1 ${arcEndX},${arcEndY}`} fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.5" />
        <text fill="#fff" fillOpacity="0.6" fontSize="7" fontWeight="600" dy="-3">
          <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
            Plaques possibles
          </textPath>
        </text>

        {maxSlope != null && <Needle deg={maxSlope} dashed />}
        {slope != null && <Needle deg={slope} />}
        <circle cx={OX} cy={OY} r="2.5" fill="#fff" />
    </svg>
  )
}

/**
 * Angles de pente propices aux avalanches de plaque (25–60°, surtout 30–45°), aux couleurs du tracé.
 * Aiguille pleine : pente sous le curseur du profil. Aiguille pointillée : pente maximale du tracé.
 * `compact` : éventail seul, pour le bandeau mobile.
 */
export default function SlopeFan({ slope, maxSlope, compact = false, className = '' }) {
  if (compact) return <FanSvg slope={slope} maxSlope={maxSlope} className={className} />

  return (
    <div className="flex items-center gap-3 border-t border-[#262626] px-3.5 py-2">
      <FanSvg slope={slope} maxSlope={maxSlope} className="h-[116px] w-auto shrink-0" />

      <div className="min-w-0 flex-1 text-[9.5px] leading-tight">
        <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#8a8a8a]">
          Avalanches de plaque possibles
        </div>
        <ul className="space-y-0.5">
          {LEGEND.map((l) => (
            <li key={l.label} className="flex flex-wrap items-center gap-x-1.5 whitespace-nowrap">
              <span className="h-2 w-2 shrink-0" style={{ background: l.color, opacity: l.opacity ?? 1 }} />
              <span className="font-din text-[11px] font-semibold text-white">{l.label}</span>
              {l.note && (
                <span
                  className={`text-[9px] uppercase tracking-wider ${l.strong ? 'font-semibold' : 'text-[#6b6b6b]'}`}
                  style={l.strong ? { color: '#ffaa00' } : undefined}
                >
                  {l.note}
                </span>
              )}
            </li>
          ))}
        </ul>
        {(slope != null || maxSlope != null) && (
          <div className="mt-1.5 text-[9px] uppercase tracking-wider text-[#6b6b6b]">
            {slope != null ? 'Aiguille : pente au curseur' : 'Pointillés : pente max du tracé'}
          </div>
        )}
      </div>
    </div>
  )
}
