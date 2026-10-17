import { useState, useMemo } from 'react'
import {
  Sun,
  Sunrise,
  Sunset,
  Clock,
  Sparkles,
  Mountain,
} from 'lucide-react'
import { getSunEphemeris, formatTime } from './sunService'

export default function RefugeSunSection({ lat, lng, alt, nom }) {
  const [selectedDayIdx, setSelectedDayIdx] = useState(0) // 0: Aujourd'hui, 1: Demain, 2: Après-demain

  // Génération des 3 dates (Aujourd'hui, Demain, Après-demain)
  const targetDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + selectedDayIdx)
    return d
  }, [selectedDayIdx])

  const ephemeris = useMemo(() => {
    return getSunEphemeris(targetDate, lat, lng, alt)
  }, [targetDate, lat, lng, alt])

  if (!ephemeris) return null

  const { svg, times, isToday, dayLengthStr, remainingText, currentPos } = ephemeris

  const daysLabels = ['Aujourd’hui', 'Demain', 'Après-demain']

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-950/20 p-4 shadow-xl backdrop-blur-md flex flex-col gap-3.5 transition-all text-white">
      {/* ─── En-tête : Titre & Sélecteur de jour ─── */}
      <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/25 border border-amber-400/40 text-amber-300 shadow-inner shrink-0">
            <Sun size={18} className="animate-spin-slow" />
          </span>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Éphéméride & Course solaire
              </h3>
              {alt != null && (
                <span className="rounded-md bg-amber-500/20 border border-amber-400/30 px-1.5 py-0.2 text-[10px] font-semibold text-amber-200">
                  {alt} m
                </span>
              )}
            </div>
            <div className="text-[11px] text-amber-200/75 mt-0.5">
              Trajectoire astronomique à {nom || 'ce refuge'}
            </div>
          </div>
        </div>

        {/* Badge en direct */}
        {isToday && (
          <span className="rounded-full bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-[10px] font-bold text-amber-200 flex items-center gap-1 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
            DIRECT
          </span>
        )}
      </div>

      {/* ─── Onglets 3 Jours (Aujourd'hui / Demain / Après-demain) ─── */}
      <div className="grid grid-cols-3 gap-1.5">
        {daysLabels.map((label, idx) => {
          const isSelected = selectedDayIdx === idx
          return (
            <button
              key={idx}
              onClick={() => setSelectedDayIdx(idx)}
              className={`rounded-xl py-1.5 px-2 text-xs font-medium text-center transition-all ${
                isSelected
                  ? 'bg-amber-500/30 border border-amber-400/50 text-amber-100 font-semibold shadow-md ring-1 ring-amber-400/30'
                  : 'bg-black/25 border border-white/5 hover:bg-white/5 text-white/60'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* ─── Graphique de l'arc solaire (fidèle au diagramme fourni) ─── */}
      <div className="rounded-xl bg-slate-950/80 border border-white/10 p-2 sm:p-3 relative overflow-hidden shadow-inner">
        {/* Légende en haut à gauche */}
        <div className="flex items-center gap-3 text-[10px] font-semibold tracking-wide mb-1 px-1">
          <span className="flex items-center gap-1 text-blue-400">
            <span className="inline-block w-2.5 h-0.5 bg-blue-500 rotate-[-30deg]" /> NUIT
          </span>
          <span className="flex items-center gap-1 text-sky-400">
            <span className="inline-block w-2.5 h-0.5 bg-sky-400 rotate-[-30deg]" /> CRÉPUSCULE
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <span className="inline-block w-2.5 h-0.5 bg-amber-400 rotate-[30deg]" /> JOUR
          </span>
        </div>

        {/* Canvas SVG */}
        <svg
          viewBox={`0 0 ${svg.width} ${svg.height}`}
          className="w-full h-auto select-none"
          style={{ maxHeight: '190px' }}
        >
          <defs>
            {/* Dégradé chaleureux pour la zone du jour */}
            <linearGradient id="sunDayGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#eab308" stopOpacity="0.05" />
            </linearGradient>

            {/* Motif de hachures dorées inspiré du schéma */}
            <pattern id="hatchDay" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.25" />
            </pattern>

            {/* Motif de hachures bleutées pour la nuit */}
            <pattern id="hatchNight" width="8" height="8" patternTransform="rotate(-45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#3b82f6" strokeWidth="1" strokeOpacity="0.12" />
            </pattern>

            {/* Filtre de lueur pour les soleils */}
            <filter id="glowSun" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 1. Zone sous l'horizon : hachures nuit */}
          <rect
            x={svg.padX}
            y={svg.horizonY}
            width={svg.width - svg.padX * 2}
            height={svg.bottomY - svg.horizonY + 10}
            fill="url(#hatchNight)"
          />

          {/* 2. Zone au-dessus de l'horizon : hachures jour */}
          {svg.dayAreaPathD && (
            <>
              <path d={svg.dayAreaPathD} fill="url(#sunDayGrad)" />
              <path d={svg.dayAreaPathD} fill="url(#hatchDay)" />
            </>
          )}

          {/* 3. Ligne de l'horizon */}
          <line
            x1={svg.padX - 10}
            y1={svg.horizonY}
            x2={svg.width - svg.padX + 10}
            y2={svg.horizonY}
            stroke="#64748b"
            strokeWidth="1.2"
            strokeDasharray="none"
          />
          <text
            x={svg.padX - 8}
            y={svg.horizonY - 5}
            fill="#94a3b8"
            fontSize="9"
            fontWeight="bold"
            letterSpacing="0.05em"
          >
            HORIZON
          </text>

          {/* 4. Tracé des segments de courbe */}
          {/* Segments de nuit */}
          {svg.nightSegments && (
            <path d={svg.nightSegments} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
          )}

          {/* Segments de crépuscule civil (-6° à 0°) */}
          {svg.twilightSegments && (
            <path d={svg.twilightSegments} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
          )}

          {/* Segments de jour (> 0°) */}
          {svg.daySegments && (
            <path d={svg.daySegments} fill="none" stroke="#f59e0b" strokeWidth="2.8" strokeLinecap="round" />
          )}

          {/* 5. Points remarquables & Annotations */}

          {/* LEVER DU SOLEIL */}
          {svg.sunrisePt && (
            <g>
              {/* Ligne repère vers crépuscule en dessous */}
              {svg.dawnPt && (
                <path
                  d={`M ${svg.dawnPt.x} ${svg.dawnPt.y} L ${svg.sunrisePt.x} ${svg.sunrisePt.y}`}
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  strokeDasharray="2 2"
                />
              )}
              {/* Cercle soleil à l'horizon */}
              <circle
                cx={svg.sunrisePt.x}
                cy={svg.sunrisePt.y}
                r="6"
                fill="#facc15"
                stroke="#fff"
                strokeWidth="1.5"
                filter="url(#glowSun)"
              />
              <circle cx={svg.sunrisePt.x} cy={svg.sunrisePt.y} r="2.5" fill="#78350f" />

              {/* Étiquette LEVER DU SOLEIL */}
              <text
                x={svg.sunrisePt.x}
                y={svg.sunrisePt.y - 12}
                fill="#fef08a"
                fontSize="9"
                fontWeight="bold"
                textAnchor="middle"
              >
                LEVER : {svg.sunrisePt.time}
              </text>

              {/* Étiquette CRÉPUSCULE (Aube) */}
              {svg.dawnPt && (
                <text
                  x={svg.dawnPt.x}
                  y={svg.dawnPt.y + 13}
                  fill="#7dd3fc"
                  fontSize="8"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  Aube : {svg.dawnPt.time}
                </text>
              )}
            </g>
          )}

          {/* MIDI SOLAIRE (Au sommet de l'arc) */}
          {svg.noonPt && (
            <g>
              {/* Soleil du zénith */}
              <circle
                cx={svg.noonPt.x}
                cy={svg.noonPt.y}
                r="7"
                fill="#f59e0b"
                stroke="#fef08a"
                strokeWidth="2"
                filter="url(#glowSun)"
              />
              <circle cx={svg.noonPt.x} cy={svg.noonPt.y} r="3" fill="#ffffff" />

              {/* Rayons décoratifs */}
              {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
                const rad = (angle * Math.PI) / 180
                const x1 = svg.noonPt.x + Math.cos(rad) * 9
                const y1 = svg.noonPt.y + Math.sin(rad) * 9
                const x2 = svg.noonPt.x + Math.cos(rad) * 12
                const y2 = svg.noonPt.y + Math.sin(rad) * 12
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#facc15"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                )
              })}

              {/* Texte MIDI SOLAIRE */}
              <text
                x={svg.noonPt.x}
                y={svg.noonPt.y - 15}
                fill="#fde047"
                fontSize="9.5"
                fontWeight="bold"
                textAnchor="middle"
              >
                MIDI SOLAIRE ({svg.noonPt.time})
              </text>
            </g>
          )}

          {/* COUCHER DU SOLEIL */}
          {svg.sunsetPt && (
            <g>
              {/* Ligne repère vers crépuscule en dessous */}
              {svg.duskPt && (
                <path
                  d={`M ${svg.sunsetPt.x} ${svg.sunsetPt.y} L ${svg.duskPt.x} ${svg.duskPt.y}`}
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  strokeDasharray="2 2"
                />
              )}
              {/* Cercle soleil à l'horizon */}
              <circle
                cx={svg.sunsetPt.x}
                cy={svg.sunsetPt.y}
                r="6"
                fill="#f97316"
                stroke="#fff"
                strokeWidth="1.5"
                filter="url(#glowSun)"
              />
              <circle cx={svg.sunsetPt.x} cy={svg.sunsetPt.y} r="2.5" fill="#7c2d12" />

              {/* Étiquette COUCHER DU SOLEIL */}
              <text
                x={svg.sunsetPt.x}
                y={svg.sunsetPt.y - 12}
                fill="#fed7aa"
                fontSize="9"
                fontWeight="bold"
                textAnchor="middle"
              >
                COUCHER : {svg.sunsetPt.time}
              </text>

              {/* Étiquette CRÉPUSCULE (Crépuscule civil soir) */}
              {svg.duskPt && (
                <text
                  x={svg.duskPt.x}
                  y={svg.duskPt.y + 13}
                  fill="#7dd3fc"
                  fontSize="8"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  Nuit : {svg.duskPt.time}
                </text>
              )}
            </g>
          )}

          {/* 6. Curseur temps réel "Maintenant" (si Aujourd'hui) */}
          {isToday && svg.nowPt && (
            <g>
              {/* Halo pulsant */}
              <circle
                cx={svg.nowPt.x}
                cy={svg.nowPt.y}
                r="9"
                fill={svg.nowPt.isDay ? '#f59e0b' : '#38bdf8'}
                fillOpacity="0.4"
                className="animate-ping"
              />
              {/* Disque central */}
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

        {/* Badge position actuelle au bas du graphique */}
        {isToday && svg.nowPt && (
          <div className="flex items-center justify-between text-[10px] text-white/70 pt-1 border-t border-white/5 mt-0.5">
            <span className="flex items-center gap-1.5 font-medium text-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              Position actuelle ({svg.nowPt.time}) : {svg.nowPt.alt > 0 ? `+${svg.nowPt.alt.toFixed(1)}° au-dessus de l'horizon` : `${svg.nowPt.alt.toFixed(1)}° sous l'horizon`}
            </span>
            <span className="text-white/40 font-mono">
              Azimut {currentPos.azimuthDeg}°
            </span>
          </div>
        )}
      </div>

      {/* ─── Cartes métriques récapitulatives ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Durée du jour */}
        <div className="rounded-xl bg-black/25 border border-white/5 p-2 flex flex-col">
          <span className="text-[10px] text-white/50 flex items-center gap-1">
            <Clock size={11} className="text-amber-400" /> Durée du jour
          </span>
          <span className="text-base font-bold text-white mt-0.5">
            {dayLengthStr}
          </span>
          <span className="text-[9px] text-amber-200/70 truncate">
            {remainingText || 'Plein jour'}
          </span>
        </div>

        {/* Aube civile (Départ frontale) */}
        <div className="rounded-xl bg-black/25 border border-white/5 p-2 flex flex-col">
          <span className="text-[10px] text-white/50 flex items-center gap-1">
            <Sparkles size={11} className="text-sky-400" /> Aube civile
          </span>
          <span className="text-base font-bold text-white mt-0.5">
            {formatTime(times.dawn)}
          </span>
          <span className="text-[9px] text-white/50">
            Visibilité sans frontale
          </span>
        </div>

        {/* Lever du soleil */}
        <div className="rounded-xl bg-black/25 border border-white/5 p-2 flex flex-col">
          <span className="text-[10px] text-white/50 flex items-center gap-1">
            <Sunrise size={11} className="text-amber-300" /> Lever du soleil
          </span>
          <span className="text-base font-bold text-white mt-0.5">
            {formatTime(times.sunrise)}
          </span>
          <span className="text-[9px] text-white/50">
            Disque à l'horizon
          </span>
        </div>

        {/* Coucher du soleil */}
        <div className="rounded-xl bg-black/25 border border-white/5 p-2 flex flex-col">
          <span className="text-[10px] text-white/50 flex items-center gap-1">
            <Sunset size={11} className="text-rose-400" /> Coucher du soleil
          </span>
          <span className="text-base font-bold text-white mt-0.5">
            {formatTime(times.sunset)}
          </span>
          <span className="text-[9px] text-white/50">
            Fin crépusc. {formatTime(times.dusk)}
          </span>
        </div>
      </div>

      {/* ─── Note informative sur le relief en montagne & Source ─── */}
      <div className="flex flex-col gap-1 rounded-xl bg-black/20 border border-white/5 p-2.5 text-[11px] text-white/70">
        <div className="flex items-start gap-1.5 text-amber-200/90">
          <Mountain size={13} className="shrink-0 mt-0.5 text-amber-400" />
          <span>
            <strong>Nuance relief montagnard :</strong> Les heures indiquées correspondent à l'horizon astronomique mathématique. Selon l'encaissement du vallon et les crêtes rocheuses qui entourent le refuge, le lever et le coucher effectifs peuvent être retardés ou avancés de 30 à 60 minutes.
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10.5px] text-amber-200/60 pt-1 border-t border-amber-500/15">
        <span>Calcul astronomique instantané (SunCalc)</span>
        <span className="text-amber-300 font-medium">Précision à la minute</span>
      </div>
    </div>
  )
}
