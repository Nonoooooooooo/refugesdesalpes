import { useState, useMemo } from 'react'
import { X, TrendingUp, TrendingDown, Mountain, Route, Compass } from 'lucide-react'

export default function ElevationProfileModal({ isOpen, onClose, track }) {
  const [hoverIndex, setHoverIndex] = useState(null)

  // Calcul des données altimétriques
  const { chartData, minAlt, maxAlt, totalDistKm } = useMemo(() => {
    const points = track?.points || []
    if (!points || points.length === 0) {
      return { chartData: [], minAlt: 0, maxAlt: 1000, totalDistKm: 0 }
    }

    const validPoints = points.filter((p) => p.alt != null && !isNaN(p.alt))
    if (validPoints.length === 0) {
      return { chartData: [], minAlt: 0, maxAlt: 1000, totalDistKm: 0 }
    }

    let min = Infinity
    let max = -Infinity

    validPoints.forEach((p) => {
      if (p.alt < min) min = p.alt
      if (p.alt > max) max = p.alt
    })

    // Arrondi avec marges confortables pour l'échelle SVG
    const padding = Math.max(30, (max - min) * 0.1)
    const yMin = Math.max(0, Math.floor((min - padding) / 50) * 50)
    const yMax = Math.ceil((max + padding) / 50) * 50

    const lastPt = validPoints[validPoints.length - 1]
    const totalDist = lastPt.cumDist || track?.distance || 1
    const totalDistKm = (totalDist / 1000).toFixed(2)

    return {
      chartData: validPoints,
      minAlt: yMin,
      maxAlt: yMax,
      realMinAlt: Math.round(min),
      realMaxAlt: Math.round(max),
      totalDistKm,
    }
  }, [track?.points, track?.distance])

  if (!isOpen || !track) return null

  const width = 640
  const height = 220
  const padLeft = 45
  const padRight = 20
  const padTop = 20
  const padBottom = 30

  const plotWidth = width - padLeft - padRight
  const plotHeight = height - padTop - padBottom

  // Génération du path SVG
  const maxDist = chartData.length > 0 ? chartData[chartData.length - 1].cumDist || 1 : 1

  const svgPoints = chartData.map((pt, idx) => {
    const x = padLeft + ((pt.cumDist || 0) / maxDist) * plotWidth
    const y = padTop + plotHeight - ((pt.alt - minAlt) / Math.max(1, maxAlt - minAlt)) * plotHeight
    return { x, y, pt, idx }
  })

  let pathD = ''
  let areaD = ''

  if (svgPoints.length > 0) {
    pathD = `M ${svgPoints[0].x.toFixed(1)} ${svgPoints[0].y.toFixed(1)}`
    for (let i = 1; i < svgPoints.length; i++) {
      pathD += ` L ${svgPoints[i].x.toFixed(1)} ${svgPoints[i].y.toFixed(1)}`
    }

    const firstX = svgPoints[0].x.toFixed(1)
    const lastX = svgPoints[svgPoints.length - 1].x.toFixed(1)
    const bottomY = (padTop + plotHeight).toFixed(1)
    areaD = `${pathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`
  }

  const activePoint = hoverIndex != null && svgPoints[hoverIndex] ? svgPoints[hoverIndex] : null

  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass relative flex w-full max-w-2xl flex-col rounded-3xl border border-white/20 bg-slate-950/95 p-4 sm:p-6 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-400/30">
              <Mountain size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white truncate max-w-xs sm:max-w-md">
                Profil altimétrique · {track.name || 'Trace GPS'}
              </h3>
              <p className="text-xs text-slate-400">
                Évolution de l’altitude le long du parcours
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

        {/* Métriques clés */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-4">
          <div className="rounded-2xl bg-white/5 p-2.5 border border-white/5">
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <Route size={12} className="text-blue-400" /> Distance
            </span>
            <div className="text-sm font-bold text-white mt-0.5">
              {(track.distance / 1000).toFixed(2)} km
            </div>
          </div>

          <div className="rounded-2xl bg-emerald-500/10 p-2.5 border border-emerald-500/20">
            <span className="text-[11px] font-medium text-emerald-300 flex items-center gap-1">
              <TrendingUp size={12} /> Dénivelé + (D+)
            </span>
            <div className="text-sm font-bold text-emerald-400 mt-0.5">
              +{Math.round(track.elevationGain || 0)} m
            </div>
          </div>

          <div className="rounded-2xl bg-amber-500/10 p-2.5 border border-amber-500/20">
            <span className="text-[11px] font-medium text-amber-300 flex items-center gap-1">
              <TrendingDown size={12} /> Dénivelé - (D-)
            </span>
            <div className="text-sm font-bold text-amber-400 mt-0.5">
              -{Math.round(track.elevationLoss || 0)} m
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 p-2.5 border border-white/5">
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <Mountain size={12} className="text-purple-400" /> Alt. Min / Max
            </span>
            <div className="text-xs font-semibold text-white mt-1 flex items-center gap-1">
              <span>{track.minAltitude != null ? `${track.minAltitude}m` : '—'}</span>
              <span className="text-slate-500">/</span>
              <span className="text-amber-300 font-bold">
                {track.maxAltitude != null ? `${track.maxAltitude}m` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Graphique SVG interactif */}
        {svgPoints.length > 1 ? (
          <div className="relative w-full overflow-hidden rounded-2xl bg-slate-900/80 p-2 border border-white/10">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto select-none"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const mouseX = ((e.clientX - rect.left) / rect.width) * width
                // Trouver le point le plus proche
                let bestIdx = 0
                let bestDiff = Infinity
                svgPoints.forEach((sp, idx) => {
                  const diff = Math.abs(sp.x - mouseX)
                  if (diff < bestDiff) {
                    bestDiff = diff
                    bestIdx = idx
                  }
                })
                setHoverIndex(bestIdx)
              }}
              onTouchMove={(e) => {
                if (e.touches && e.touches[0]) {
                  const touch = e.touches[0]
                  const rect = e.currentTarget.getBoundingClientRect()
                  const touchX = ((touch.clientX - rect.left) / rect.width) * width
                  let bestIdx = 0
                  let bestDiff = Infinity
                  svgPoints.forEach((sp, idx) => {
                    const diff = Math.abs(sp.x - touchX)
                    if (diff < bestDiff) {
                      bestDiff = diff
                      bestIdx = idx
                    }
                  })
                  setHoverIndex(bestIdx)
                }
              }}
              onMouseLeave={() => setHoverIndex(null)}
            >
              <defs>
                <linearGradient id="elevationGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.45" />
                  <stop offset="60%" stopColor="#d97706" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#b45309" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Lignes de repère horizontales (altitude) */}
              {[minAlt, Math.round((minAlt + maxAlt) / 2), maxAlt].map((altVal) => {
                const y =
                  padTop +
                  plotHeight -
                  ((altVal - minAlt) / Math.max(1, maxAlt - minAlt)) * plotHeight
                return (
                  <g key={altVal}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={width - padRight}
                      y2={y}
                      stroke="rgba(255,255,255,0.12)"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padLeft - 6}
                      y={y + 4}
                      fill="#94a3b8"
                      fontSize="10"
                      textAnchor="end"
                      fontWeight="500"
                    >
                      {altVal}m
                    </text>
                  </g>
                )
              })}

              {/* Ligne de repère de distance */}
              <text
                x={padLeft}
                y={height - 8}
                fill="#94a3b8"
                fontSize="10"
                textAnchor="start"
              >
                0 km
              </text>
              <text
                x={width - padRight}
                y={height - 8}
                fill="#94a3b8"
                fontSize="10"
                textAnchor="end"
              >
                {totalDistKm} km
              </text>

              {/* Surface sous la courbe */}
              <path d={areaD} fill="url(#elevationGrad)" />

              {/* Courbe de profil */}
              <path
                d={pathD}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Curseur interactif au survol */}
              {activePoint && (
                <g>
                  <line
                    x1={activePoint.x}
                    y1={padTop}
                    x2={activePoint.x}
                    y2={padTop + plotHeight}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                  <circle
                    cx={activePoint.x}
                    cy={activePoint.y}
                    r="5"
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                </g>
              )}
            </svg>

            {/* Bulle d'information interactive flottante */}
            {activePoint && (
              <div
                className="pointer-events-none absolute top-3 bg-slate-900/95 border border-amber-400/50 rounded-xl px-2.5 py-1 text-xs text-white shadow-xl flex items-center gap-2 transform -translate-x-1/2"
                style={{
                  left: `${(activePoint.x / width) * 100}%`,
                }}
              >
                <span className="font-bold text-amber-300">
                  {activePoint.pt.alt} m
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-300">
                  {((activePoint.pt.cumDist || 0) / 1000).toFixed(2)} km
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-36 items-center justify-center rounded-2xl bg-white/5 text-xs text-slate-400">
            Données altimétriques insuffisantes pour générer la courbe de profil.
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Compass size={13} className="text-amber-400" /> Glissez le doigt ou la souris sur le profil pour inspecter l’altitude.
          </span>
          <button
            onClick={onClose}
            className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
