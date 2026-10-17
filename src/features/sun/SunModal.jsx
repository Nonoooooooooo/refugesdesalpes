import React, { useState, useMemo, useEffect } from 'react'
import {
  X,
  Sun,
  Sunrise,
  Sunset,
  Sparkles,
  Clock,
  Compass,
} from 'lucide-react'
import { getSunEphemeris, formatTime } from './sunService'

export default function SunModal({ point, onClose }) {
  const [selectedDayIdx, setSelectedDayIdx] = useState(0) // 0: Aujourd'hui, 1: Demain, 2: Après-demain

  // Fermeture par touche Échap
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Date cible selon l'onglet choisi
  const targetDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + selectedDayIdx)
    return d
  }, [selectedDayIdx])

  const lat = point?.lat
  const lng = point?.lng
  const alt = point?.alt

  const ephemeris = useMemo(() => {
    if (lat == null || lng == null) return null
    return getSunEphemeris(targetDate, lat, lng, alt)
  }, [targetDate, lat, lng, alt])

  const daysLabels = ['Aujourd’hui', 'Demain', 'Après-demain']

  if (!ephemeris) return null

  const { svg, times, isToday, dayLengthStr, remainingText, currentPos } = ephemeris

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[1300] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xl animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-gradient-to-b from-amber-500/10 via-slate-950/85 to-slate-950/95 text-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-200"
      >
        {/* ─── En-tête épuré style Apple ─── */}
        <header className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400/15 border border-amber-300/30 text-amber-300 shadow-inner">
              <Sun size={20} className="drop-shadow" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight text-white">
                  Éphéméride Solaire
                </h2>
                {isToday && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-medium text-amber-200 border border-amber-400/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    En direct
                  </span>
                )}
              </div>
              <p className="text-xs text-white/50">
                {point?.nom || 'Refuge'} {alt != null ? `· ${alt} m d’altitude` : ''}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all active:scale-95 backdrop-blur-md"
          >
            <X size={16} />
          </button>
        </header>

        {/* ─── Sélecteur segmenté style Apple (Aujourd'hui / Demain / Après-demain) ─── */}
        <div className="px-6 py-2">
          <div className="flex rounded-full bg-white/5 p-1 border border-white/10">
            {daysLabels.map((label, idx) => {
              const isSelected = selectedDayIdx === idx
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDayIdx(idx)}
                  className={`flex-1 rounded-full py-1 text-xs font-medium text-center transition-all ${
                    isSelected
                      ? 'bg-white/20 text-white shadow-sm font-semibold'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ─── Hero Statistique : Durée du jour & Compte à rebours ─── */}
        <div className="px-6 py-2 flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/40 font-medium">
              Durée d'ensoleillement
            </div>
            <div className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mt-0.5">
              {dayLengthStr}
            </div>
          </div>
          {remainingText && (
            <div className="rounded-full bg-amber-400/10 border border-amber-300/25 px-3 py-1 text-xs text-amber-200 font-medium">
              {remainingText}
            </div>
          )}
        </div>

        {/* ─── Graphique de l'arc solaire (Reproduction fidèle et épurée) ─── */}
        <div className="mx-6 my-2 rounded-2xl bg-black/40 border border-white/10 p-3 sm:p-4 shadow-inner relative overflow-hidden backdrop-blur-md">
          {/* Légende minimaliste en haut à gauche */}
          <div className="flex items-center gap-4 text-[10px] font-medium tracking-wide mb-1 text-white/50">
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="inline-block w-2.5 h-0.5 bg-blue-500 rounded-full" /> Nuit
            </span>
            <span className="flex items-center gap-1.5 text-sky-400">
              <span className="inline-block w-2.5 h-0.5 bg-sky-400 rounded-full" /> Crépuscule
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="inline-block w-2.5 h-0.5 bg-amber-400 rounded-full" /> Jour
            </span>
          </div>

          <svg
            viewBox={`0 0 ${svg.width} ${svg.height}`}
            className="w-full h-auto select-none"
            style={{ maxHeight: '185px' }}
          >
            <defs>
              {/* Dégradé doux et soigné pour le jour */}
              <linearGradient id="appleDayGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#eab308" stopOpacity="0.02" />
              </linearGradient>

              {/* Hachures fines et discrètes */}
              <pattern id="appleHatchDay" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="10" stroke="#f59e0b" strokeWidth="0.8" strokeOpacity="0.22" />
              </pattern>

              <pattern id="appleHatchNight" width="10" height="10" patternTransform="rotate(-45 0 0)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="10" stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.10" />
              </pattern>

              <filter id="appleSunGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Zone nuit sous l'horizon */}
            <rect
              x={svg.padX}
              y={svg.horizonY}
              width={svg.width - svg.padX * 2}
              height={svg.bottomY - svg.horizonY + 10}
              fill="url(#appleHatchNight)"
            />

            {/* Zone jour au-dessus de l'horizon */}
            {svg.dayAreaPathD && (
              <>
                <path d={svg.dayAreaPathD} fill="url(#appleDayGrad)" />
                <path d={svg.dayAreaPathD} fill="url(#appleHatchDay)" />
              </>
            )}

            {/* Ligne d'horizon */}
            <line
              x1={svg.padX - 10}
              y1={svg.horizonY}
              x2={svg.width - svg.padX + 10}
              y2={svg.horizonY}
              stroke="#64748b"
              strokeWidth="1.2"
              strokeOpacity="0.7"
            />
            <text
              x={svg.padX - 8}
              y={svg.horizonY - 5}
              fill="#94a3b8"
              fontSize="9"
              fontWeight="600"
              letterSpacing="0.06em"
            >
              HORIZON
            </text>

            {/* Courbes de nuit, crépuscule et jour */}
            {svg.nightSegments && (
              <path d={svg.nightSegments} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
            )}
            {svg.twilightSegments && (
              <path d={svg.twilightSegments} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
            )}
            {svg.daySegments && (
              <path d={svg.daySegments} fill="none" stroke="#f59e0b" strokeWidth="2.8" strokeLinecap="round" />
            )}

            {/* LEVER DU SOLEIL */}
            {svg.sunrisePt && (
              <g>
                {svg.dawnPt && (
                  <path
                    d={`M ${svg.dawnPt.x} ${svg.dawnPt.y} L ${svg.sunrisePt.x} ${svg.sunrisePt.y}`}
                    stroke="#38bdf8"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    strokeOpacity="0.7"
                  />
                )}
                <circle
                  cx={svg.sunrisePt.x}
                  cy={svg.sunrisePt.y}
                  r="6"
                  fill="#facc15"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  filter="url(#appleSunGlow)"
                />
                <circle cx={svg.sunrisePt.x} cy={svg.sunrisePt.y} r="2.5" fill="#78350f" />

                <text
                  x={svg.sunrisePt.x}
                  y={svg.sunrisePt.y - 12}
                  fill="#fef08a"
                  fontSize="9"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  LEVER · {svg.sunrisePt.time}
                </text>

                {svg.dawnPt && (
                  <text
                    x={svg.dawnPt.x}
                    y={svg.dawnPt.y + 13}
                    fill="#7dd3fc"
                    fontSize="8"
                    fontWeight="500"
                    textAnchor="middle"
                  >
                    Aube {svg.dawnPt.time}
                  </text>
                )}
              </g>
            )}

            {/* MIDI SOLAIRE */}
            {svg.noonPt && (
              <g>
                <circle
                  cx={svg.noonPt.x}
                  cy={svg.noonPt.y}
                  r="7"
                  fill="#f59e0b"
                  stroke="#fef08a"
                  strokeWidth="2"
                  filter="url(#appleSunGlow)"
                />
                <circle cx={svg.noonPt.x} cy={svg.noonPt.y} r="3" fill="#ffffff" />

                <text
                  x={svg.noonPt.x}
                  y={svg.noonPt.y - 14}
                  fill="#fde047"
                  fontSize="9.5"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  MIDI SOLAIRE · {svg.noonPt.time}
                </text>
              </g>
            )}

            {/* COUCHER DU SOLEIL */}
            {svg.sunsetPt && (
              <g>
                {svg.duskPt && (
                  <path
                    d={`M ${svg.sunsetPt.x} ${svg.sunsetPt.y} L ${svg.duskPt.x} ${svg.duskPt.y}`}
                    stroke="#38bdf8"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    strokeOpacity="0.7"
                  />
                )}
                <circle
                  cx={svg.sunsetPt.x}
                  cy={svg.sunsetPt.y}
                  r="6"
                  fill="#f97316"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  filter="url(#appleSunGlow)"
                />
                <circle cx={svg.sunsetPt.x} cy={svg.sunsetPt.y} r="2.5" fill="#7c2d12" />

                <text
                  x={svg.sunsetPt.x}
                  y={svg.sunsetPt.y - 12}
                  fill="#fed7aa"
                  fontSize="9"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  COUCHER · {svg.sunsetPt.time}
                </text>

                {svg.duskPt && (
                  <text
                    x={svg.duskPt.x}
                    y={svg.duskPt.y + 13}
                    fill="#7dd3fc"
                    fontSize="8"
                    fontWeight="500"
                    textAnchor="middle"
                  >
                    Nuit {svg.duskPt.time}
                  </text>
                )}
              </g>
            )}

            {/* Curseur EN DIRECT (si aujourd'hui) */}
            {isToday && svg.nowPt && (
              <g>
                <circle
                  cx={svg.nowPt.x}
                  cy={svg.nowPt.y}
                  r="9"
                  fill={svg.nowPt.isDay ? '#f59e0b' : '#38bdf8'}
                  fillOpacity="0.45"
                  className="animate-ping"
                />
                <circle
                  cx={svg.nowPt.x}
                  cy={svg.nowPt.y}
                  r="5"
                  fill="#ffffff"
                  stroke={svg.nowPt.isDay ? '#f59e0b' : '#0284c7'}
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>

          {isToday && svg.nowPt && (
            <div className="flex items-center justify-between text-[11px] text-white/60 pt-2 border-t border-white/5 mt-1">
              <span className="flex items-center gap-1.5 text-amber-200/90 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Maintenant ({svg.nowPt.time}) : {svg.nowPt.alt > 0 ? `+${svg.nowPt.alt.toFixed(1)}° d'élévation` : `${svg.nowPt.alt.toFixed(1)}° sous l'horizon`}
              </span>
              <span className="text-white/40 font-mono text-[10px]">
                Azimut {currentPos.azimuthDeg}°
              </span>
            </div>
          )}
        </div>

        {/* ─── Cartes métriques récapitulatives style Apple ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 px-6 py-2">
          {/* Aube */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3 flex flex-col">
            <span className="text-[10px] text-white/50 flex items-center gap-1.5 font-medium">
              <Sparkles size={12} className="text-sky-300" /> Aube civile
            </span>
            <span className="text-xl font-semibold text-white mt-1">
              {formatTime(times.dawn)}
            </span>
            <span className="text-[10px] text-white/40 mt-0.5">
              Sans frontale
            </span>
          </div>

          {/* Lever */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3 flex flex-col">
            <span className="text-[10px] text-white/50 flex items-center gap-1.5 font-medium">
              <Sunrise size={12} className="text-amber-300" /> Lever du soleil
            </span>
            <span className="text-xl font-semibold text-white mt-1">
              {formatTime(times.sunrise)}
            </span>
            <span className="text-[10px] text-white/40 mt-0.5">
              Disque à 0°
            </span>
          </div>

          {/* Midi */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3 flex flex-col">
            <span className="text-[10px] text-white/50 flex items-center gap-1.5 font-medium">
              <Sun size={12} className="text-amber-400" /> Midi solaire
            </span>
            <span className="text-xl font-semibold text-white mt-1">
              {formatTime(times.solarNoon)}
            </span>
            <span className="text-[10px] text-white/40 mt-0.5">
              Zénith
            </span>
          </div>

          {/* Coucher */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3 flex flex-col">
            <span className="text-[10px] text-white/50 flex items-center gap-1.5 font-medium">
              <Sunset size={12} className="text-rose-400" /> Coucher du soleil
            </span>
            <span className="text-xl font-semibold text-white mt-1">
              {formatTime(times.sunset)}
            </span>
            <span className="text-[10px] text-white/40 mt-0.5">
              Nuit dès {formatTime(times.dusk)}
            </span>
          </div>
        </div>

        {/* ─── Pied de page épuré avec note relief ─── */}
        <footer className="px-6 py-3 border-t border-white/10 bg-black/20 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-white/40">
          <span>
            🏔️ Calcul astronomique (SunCalc) · Le relief environnant peut masquer le soleil plus tôt ou plus tard.
          </span>
          <span className="text-amber-300/80 font-medium shrink-0">
            Précision à la minute
          </span>
        </footer>
      </div>
    </div>
  )
}
