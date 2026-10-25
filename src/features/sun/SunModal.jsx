import React, { useState, useMemo, useEffect } from 'react'
import { X } from 'lucide-react'
import { getSunEphemeris, formatTime } from './sunService'

// Palette "cadran" : noir pur, un seul accent chaud, un bleu pour le crépuscule
const ORANGE = '#ff7a1a'
const CYAN = '#2fb6ff'
const SLATE = '#5b6b8c'
const GRID = '#262626'
const MUTED = '#8a8a8a'

const CARDINALS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO']
const cardinal = (az) => (az == null ? '' : CARDINALS[Math.round(az / 22.5) % 16])

const f1 = (n) => n.toFixed(1).replace('.', ',').replace('-', '−')
const splitDuration = (min) => {
  const total = Math.max(0, Math.round(min))
  return { h: Math.floor(total / 60), m: total % 60 }
}
const hasTime = (d) => d && !isNaN(d.getTime())

/** Durée en gros chiffres condensés : 9 H 42 MIN */
function Duration({ min, size = 'text-[52px]' }) {
  if (min == null || isNaN(min)) return <span className={`font-din ${size} leading-none font-semibold`}>--</span>
  const { h, m } = splitDuration(min)
  return (
    <span className="font-din inline-flex items-baseline">
      <span className={`${size} leading-none font-semibold`}>{h}</span>
      <span className="ml-0.5 mr-2 text-base font-medium text-[#8a8a8a]">H</span>
      <span className={`${size} leading-none font-semibold`}>{String(m).padStart(2, '0')}</span>
      <span className="ml-0.5 text-base font-medium text-[#8a8a8a]">MIN</span>
    </span>
  )
}

function Label({ children, className = '' }) {
  return (
    <div className={`text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a8a8a] ${className}`}>
      {children}
    </div>
  )
}

/** Champ de données : libellé, grande valeur, sous-ligne */
function Field({ label, value, sub, accent }) {
  return (
    <div className="bg-black px-3.5 py-3">
      <Label>{label}</Label>
      <div
        className="font-din mt-1 text-[34px] leading-none font-semibold"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[10px] uppercase tracking-wider text-[#6b6b6b]">{sub}</div>}
    </div>
  )
}

/** Jauge segmentée de la journée solaire écoulée */
function DayGauge({ progress, riseTime, setTime }) {
  const SEGMENTS = 40
  const filled = progress == null ? 0 : Math.round(progress * SEGMENTS)
  return (
    <div className="flex items-center gap-3 px-4 pb-3.5">
      <span className="font-din w-12 text-[15px] font-semibold">{riseTime}</span>
      <div className="flex h-3 flex-1 gap-[2px]" aria-hidden="true">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            className="flex-1"
            style={{ background: i < filled ? ORANGE : GRID, opacity: i === filled - 1 ? 1 : i < filled ? 0.85 : 1 }}
          />
        ))}
      </div>
      <span className="font-din w-12 text-right text-[15px] font-semibold">{setTime}</span>
    </div>
  )
}

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

  // Libellés des 3 onglets (jour relatif + date)
  const days = useMemo(
    () =>
      ['AUJ.', 'DEM.', 'J+2'].map((label, i) => {
        const d = new Date()
        d.setDate(d.getDate() + i)
        return { label, date: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) }
      }),
    []
  )

  const lat = point?.lat
  const lng = point?.lng
  const alt = point?.alt

  const ephemeris = useMemo(() => {
    if (lat == null || lng == null) return null
    return getSunEphemeris(targetDate, lat, lng, alt)
  }, [targetDate, lat, lng, alt])

  if (!ephemeris) return null

  const {
    svg,
    times,
    isToday,
    dayLengthMin,
    dayDeltaSec,
    dayProgress,
    maxAltDeg,
    sunriseAzimuth,
    sunsetAzimuth,
    remaining,
    currentPos,
  } = ephemeris

  // Lumière utile : de l'aube civile au crépuscule civil (déplacement sans frontale)
  const usableMin =
    hasTime(times.dawn) && hasTime(times.dusk) ? (times.dusk.getTime() - times.dawn.getTime()) / 60000 : null

  const hourX = (h) => svg.padX + (h / 24) * svg.chartWidth
  const nowColor = svg.nowPt ? (svg.nowPt.isDay ? ORANGE : svg.nowPt.isTwilight ? CYAN : SLATE) : ORANGE

  // Écart de durée avec la veille
  let deltaNode = null
  if (dayDeltaSec != null) {
    const abs = Math.abs(dayDeltaSec)
    const dm = Math.floor(abs / 60)
    const ds = abs % 60
    const up = dayDeltaSec >= 0
    deltaNode = (
      <span className="font-din text-[13px] tracking-wide" style={{ color: up ? ORANGE : CYAN }}>
        {up ? '▲' : '▼'} {dm} MIN {String(ds).padStart(2, '0')} S <span className="text-[#6b6b6b]">VS HIER</span>
      </span>
    )
  }

  // Cellule de droite du bandeau principal
  let heroRight
  if (isToday && remaining) {
    if (remaining.kind === 'night') {
      heroRight = { label: 'Nuit en cours', node: <span className="font-din text-[52px] leading-none font-semibold">--</span>, sub: 'Pas de lever calculable' }
    } else {
      heroRight = {
        label: remaining.kind === 'sunset' ? 'Jour restant' : 'Lever dans',
        node: <Duration min={remaining.min} />,
        sub:
          remaining.kind === 'sunset'
            ? `Coucher à ${formatTime(times.sunset)}`
            : `Lever ${remaining.tomorrow ? 'demain ' : ''}à ${formatTime(remaining.at ?? times.sunrise)}`,
      }
    }
  } else {
    heroRight = {
      label: 'Élévation max',
      node: (
        <span className="font-din inline-flex items-baseline">
          <span className="text-[52px] leading-none font-semibold">{f1(maxAltDeg)}</span>
          <span className="ml-0.5 text-2xl font-medium text-[#8a8a8a]">°</span>
        </span>
      ),
      sub: `Midi solaire à ${formatTime(times.solarNoon)}`,
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/80 p-2 sm:p-6"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Éphéméride solaire"
        onClick={(e) => e.stopPropagation()}
        className="sun-panel-in relative flex max-h-[96dvh] w-full max-w-xl flex-col overflow-y-auto [color-scheme:dark] rounded-md border border-[#2b2b2b] bg-black text-white shadow-[0_30px_80px_-20px_rgba(0,0,0,1)]"
      >
        {/* ─── En-tête ─── */}
        <header className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3">
          <div className="min-w-0">
            <div
              className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: ORANGE }}
            >
              <span className="h-3 w-[3px]" style={{ background: ORANGE }} />
              Éphéméride solaire
              {isToday && (
                <span className="ml-1 flex items-center gap-1 text-[#8a8a8a]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: ORANGE }} />
                  Direct
                </span>
              )}
            </div>
            <h2 className="font-din mt-1.5 truncate text-[28px] leading-none font-semibold uppercase tracking-wide">
              {point?.nom || 'Refuge'}
            </h2>
            <p className="font-din mt-1.5 text-[12px] uppercase tracking-[0.12em] text-[#8a8a8a]">
              {alt != null ? `${alt} M · ` : ''}
              {Math.abs(lat).toFixed(4)}°{lat >= 0 ? 'N' : 'S'} {Math.abs(lng).toFixed(4)}°{lng >= 0 ? 'E' : 'O'}
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-[#2b2b2b] text-[#8a8a8a] transition-colors hover:border-[#444] hover:text-white active:bg-[#1a1a1a]"
          >
            <X size={16} />
          </button>
        </header>

        {/* ─── Onglets de jour ─── */}
        <div role="tablist" className="grid grid-cols-3 border-y" style={{ borderColor: GRID }}>
          {days.map((d, idx) => {
            const active = selectedDayIdx === idx
            return (
              <button
                key={d.label}
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedDayIdx(idx)}
                className="relative px-2 py-2 text-center transition-colors"
                style={{ background: active ? '#0f0f0f' : 'transparent' }}
              >
                <div
                  className="font-din text-[15px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: active ? '#fff' : MUTED }}
                >
                  {d.label}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-[#6b6b6b]">{d.date}</div>
                {active && <span className="absolute inset-x-0 bottom-0 h-[2px]" style={{ background: ORANGE }} />}
              </button>
            )
          })}
        </div>

        {/* ─── Bandeau principal : durée du jour / restant ─── */}
        <div className="grid grid-cols-2 border-b" style={{ borderColor: GRID }}>
          <div className="px-4 py-3.5">
            <Label>Durée du jour</Label>
            <div className="mt-1.5">
              <Duration min={dayLengthMin} />
            </div>
            <div className="mt-2 min-h-[16px]">{deltaNode}</div>
          </div>
          <div className="border-l px-4 py-3.5" style={{ borderColor: GRID }}>
            <Label>{heroRight.label}</Label>
            <div className="mt-1.5">{heroRight.node}</div>
            <div className="mt-2 min-h-[16px] text-[10px] uppercase tracking-wider text-[#6b6b6b]">{heroRight.sub}</div>
          </div>
        </div>

        {/* ─── Jauge de la journée solaire ─── */}
        <div className="pt-3.5">
          <DayGauge progress={isToday ? dayProgress : null} riseTime={formatTime(times.sunrise)} setTime={formatTime(times.sunset)} />
        </div>

        {/* ─── Courbe d'élévation sur 24 h ─── */}
        <div className="border-y bg-[#050505] px-2 pt-2.5" style={{ borderColor: GRID }}>
          <svg
            viewBox={`0 0 ${svg.width} ${svg.height}`}
            className="block h-auto w-full select-none"
            role="img"
            aria-label="Élévation du soleil au cours de la journée"
          >
            {/* Zone sous l'horizon */}
            <rect
              x={svg.padX}
              y={svg.horizonY}
              width={svg.chartWidth}
              height={svg.axisY - svg.horizonY}
              fill={SLATE}
              fillOpacity="0.07"
            />

            {/* Repères horaires */}
            {[0, 6, 12, 18, 24].map((h) => (
              <g key={h}>
                <line x1={hourX(h)} y1={svg.topY - 8} x2={hourX(h)} y2={svg.axisY} stroke="#1c1c1c" strokeWidth="1" />
                <text
                  x={hourX(h)}
                  y={svg.axisY + 15}
                  fill={MUTED}
                  fontSize="11"
                  fontWeight="500"
                  textAnchor="middle"
                  className="font-din"
                >
                  {String(h).padStart(2, '0')}
                </text>
              </g>
            ))}
            {Array.from({ length: 25 }, (_, h) => (
              <line key={h} x1={hourX(h)} y1={svg.axisY} x2={hourX(h)} y2={svg.axisY + 3} stroke="#444" strokeWidth="1" />
            ))}
            <line x1={svg.padX} y1={svg.axisY} x2={svg.width - svg.padX} y2={svg.axisY} stroke="#333" strokeWidth="1" />

            {/* Zone de jour */}
            {svg.dayAreaPathD && <path d={svg.dayAreaPathD} fill={ORANGE} fillOpacity="0.14" />}

            {/* Horizon */}
            <line
              x1={svg.padX}
              y1={svg.horizonY}
              x2={svg.width - svg.padX}
              y2={svg.horizonY}
              stroke="#6b6b6b"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <text x={svg.width - svg.padX + 5} y={svg.horizonY + 4} fill={MUTED} fontSize="11" className="font-din">
              0°
            </text>

            {/* Courbe : nuit, crépuscule, jour */}
            {svg.nightSegments && <path d={svg.nightSegments} fill="none" stroke={SLATE} strokeWidth="1.5" strokeLinecap="round" />}
            {svg.twilightSegments && <path d={svg.twilightSegments} fill="none" stroke={CYAN} strokeWidth="2" strokeLinecap="round" />}
            {svg.daySegments && <path d={svg.daySegments} fill="none" stroke={ORANGE} strokeWidth="2.5" strokeLinecap="round" />}

            {/* Aube / crépuscule civils */}
            {[svg.dawnPt, svg.duskPt].map(
              (p, i) =>
                p && (
                  <g key={i}>
                    <rect x={p.x - 3} y={p.y - 3} width="6" height="6" fill="#000" stroke={CYAN} strokeWidth="1.5" transform={`rotate(45 ${p.x} ${p.y})`} />
                    <text x={p.x} y={p.y + 17} fill={CYAN} fontSize="11" fontWeight="500" textAnchor="middle" className="font-din">
                      {p.time}
                    </text>
                  </g>
                )
            )}

            {/* Lever */}
            {svg.sunrisePt && (
              <g>
                <line x1={svg.sunrisePt.x} y1={svg.horizonY} x2={svg.sunrisePt.x} y2={svg.axisY} stroke={ORANGE} strokeOpacity="0.4" strokeDasharray="2 3" />
                <path
                  d={`M ${svg.sunrisePt.x} ${svg.sunrisePt.y - 6} L ${svg.sunrisePt.x - 5} ${svg.sunrisePt.y + 3} L ${svg.sunrisePt.x + 5} ${svg.sunrisePt.y + 3} Z`}
                  fill={ORANGE}
                />
                <text x={svg.sunrisePt.x} y={svg.horizonY - 12} fill="#fff" fontSize="13" fontWeight="600" textAnchor="middle" className="font-din">
                  {svg.sunrisePt.time}
                </text>
              </g>
            )}

            {/* Coucher */}
            {svg.sunsetPt && (
              <g>
                <line x1={svg.sunsetPt.x} y1={svg.horizonY} x2={svg.sunsetPt.x} y2={svg.axisY} stroke={ORANGE} strokeOpacity="0.4" strokeDasharray="2 3" />
                <path
                  d={`M ${svg.sunsetPt.x} ${svg.sunsetPt.y + 6} L ${svg.sunsetPt.x - 5} ${svg.sunsetPt.y - 3} L ${svg.sunsetPt.x + 5} ${svg.sunsetPt.y - 3} Z`}
                  fill={ORANGE}
                />
                <text x={svg.sunsetPt.x} y={svg.horizonY - 12} fill="#fff" fontSize="13" fontWeight="600" textAnchor="middle" className="font-din">
                  {svg.sunsetPt.time}
                </text>
              </g>
            )}

            {/* Midi solaire */}
            {svg.noonPt && (
              <g>
                <line x1={svg.noonPt.x} y1={svg.noonPt.y} x2={svg.noonPt.x} y2={svg.horizonY} stroke={ORANGE} strokeOpacity="0.4" strokeDasharray="2 3" />
                <circle cx={svg.noonPt.x} cy={svg.noonPt.y} r="4.5" fill="#000" stroke={ORANGE} strokeWidth="2" />
                <text x={svg.noonPt.x} y={svg.noonPt.y - 10} fill="#fff" fontSize="13" fontWeight="600" textAnchor="middle" className="font-din">
                  {svg.noonPt.time}
                  <tspan fill={MUTED} fontWeight="500">{`  ${f1(maxAltDeg)}°`}</tspan>
                </text>
              </g>
            )}

            {/* Curseur de l'heure actuelle */}
            {isToday && svg.nowPt && (
              <g>
                <line x1={svg.nowPt.x} y1={svg.topY - 8} x2={svg.nowPt.x} y2={svg.axisY} stroke="#fff" strokeOpacity="0.35" strokeWidth="1" />
                <circle cx={svg.nowPt.x} cy={svg.nowPt.y} r="6" fill="#000" stroke={nowColor} strokeWidth="2.5" />
                <circle cx={svg.nowPt.x} cy={svg.nowPt.y} r="2" fill={nowColor} />
              </g>
            )}
          </svg>

          {/* Légende */}
          <div className="flex items-center gap-4 px-2 pb-2.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">
            <span className="flex items-center gap-1.5">
              <span className="h-[3px] w-3" style={{ background: ORANGE }} /> Jour
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-[3px] w-3" style={{ background: CYAN }} /> Crépuscule civil
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-[3px] w-3" style={{ background: SLATE }} /> Nuit
            </span>
          </div>
        </div>

        {/* ─── Position instantanée (aujourd'hui) ─── */}
        {isToday && svg.nowPt && (
          <div>
            <div className="flex items-center gap-2 px-4 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a8a8a]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: nowColor }} />
              Position actuelle
            </div>
            <div className="grid grid-cols-3 gap-px border-y" style={{ background: GRID, borderColor: GRID }}>
              <Field
                label="Élévation"
                value={`${svg.nowPt.alt > 0 ? '+' : ''}${f1(svg.nowPt.alt)}°`}
                sub={svg.nowPt.alt >= 0 ? 'Au-dessus de l’horizon' : 'Sous l’horizon'}
                accent={nowColor}
              />
              <Field label="Azimut" value={`${currentPos.azimuthDeg}°`} sub={cardinal(currentPos.azimuthDeg)} />
              <Field label="Heure" value={svg.nowPt.time} sub="Heure locale" />
            </div>
          </div>
        )}

        {/* ─── Grille de données ─── */}
        <div className={`grid grid-cols-2 gap-px border-b sm:grid-cols-3 ${isToday && svg.nowPt ? '' : 'border-t'}`} style={{ background: GRID, borderColor: GRID }}>
          <Field label="Aube civile" value={formatTime(times.dawn)} sub="Début de lumière" />
          <Field label="Lever" value={formatTime(times.sunrise)} sub={sunriseAzimuth != null ? `Az. ${sunriseAzimuth}° ${cardinal(sunriseAzimuth)}` : null} accent={ORANGE} />
          <Field label="Midi solaire" value={formatTime(times.solarNoon)} sub={`Élév. ${f1(maxAltDeg)}°`} />
          <Field label="Coucher" value={formatTime(times.sunset)} sub={sunsetAzimuth != null ? `Az. ${sunsetAzimuth}° ${cardinal(sunsetAzimuth)}` : null} accent={ORANGE} />
          <Field label="Fin crépuscule" value={formatTime(times.dusk)} sub="Frontale requise" />
          <Field
            label="Lumière utile"
            value={
              usableMin != null ? (
                <>
                  {splitDuration(usableMin).h}
                  <span className="text-lg font-medium text-[#8a8a8a]">H</span>
                  {String(splitDuration(usableMin).m).padStart(2, '0')}
                </>
              ) : (
                '--'
              )
            }
            sub="Sans frontale"
          />
        </div>

        {/* ─── Pied de page ─── */}
        <footer className="flex flex-col gap-1 px-4 py-3 text-[10px] uppercase tracking-wider text-[#6b6b6b] sm:flex-row sm:items-center sm:justify-between">
          <span>SunCalc · horizon astronomique</span>
          <span>Relief : lever/coucher réels ±30 à 60 min</span>
        </footer>
      </div>
    </div>
  )
}
