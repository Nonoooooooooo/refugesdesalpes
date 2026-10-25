import { useState, useEffect, useRef } from 'react'
import { Sun, CloudSun, Cloud, CloudFog, CloudRain, CloudSnow, CloudLightning, Radar, RefreshCw } from 'lucide-react'
import { fetchRefugeWeather, windCardinal } from './pointWeatherService'

// Palette "instrument" : noir pur, orange (accent), cyan (eau / gel), ambre (rafales)
const ACCENT = '#ffaa00'
const CYAN = '#74a5d5'
const AMBER = '#ffb020'
const GUST = '#e6e6e6' // rafales : gris clair, pour ne pas se confondre avec l'accent orange
const RED = '#ff5a4d'
const GRID = '#262626'
const MUTED = '#8a8a8a'

// Échelle de précipitations façon radar (mm/h) : bleu → vert → jaune → orange → rouge
const ECHO_SCALE = [
  { max: 0.5, color: '#74a5d5', label: '< 0,5' },
  { max: 2, color: '#3ddc97', label: '0,5–2' },
  { max: 5, color: '#ffd23f', label: '2–5' },
  { max: 10, color: '#ff7a1a', label: '5–10' },
  { max: Infinity, color: '#ff3d3d', label: '> 10' },
]
const echoColor = (mm) => (ECHO_SCALE.find((s) => mm < s.max) || ECHO_SCALE[ECHO_SCALE.length - 1]).color

const GLYPHS = { clear: Sun, fair: CloudSun, cloud: Cloud, fog: CloudFog, rain: CloudRain, snow: CloudSnow, storm: CloudLightning }
function Glyph({ info, size = 20, strokeWidth = 1.5, className = '', style }) {
  const Icon = GLYPHS[info?.glyph] || CloudSun
  return <Icon size={size} strokeWidth={strokeWidth} className={className} style={style} aria-hidden="true" />
}

const fmtT = (n) => (n == null ? '--' : n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0')
const fmt1 = (n) => String(n).replace('.', ',')
const fmtInt = (n) => (n == null ? '--' : Math.round(n).toLocaleString('fr-FR'))
const gustClass = (g) => (g < 30 ? 'Faibles' : g < 50 ? 'Modérées' : g < 70 ? 'Fortes' : g < 90 ? 'Très fortes' : 'Violentes')
const gustColor = (g) => (g >= 90 ? RED : g >= 60 ? AMBER : undefined)

const CHANNELS = [
  { key: 'temp', label: 'Temp.' },
  { key: 'precip', label: 'Précip.' },
  { key: 'wind', label: 'Vent' },
  { key: 'iso', label: 'Iso 0°C' },
]

function Label({ children, className = '' }) {
  return <div className={`text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a8a8a] ${className}`}>{children}</div>
}

/** Champ de données : libellé, grande valeur condensée, unité, sous-ligne */
function Field({ label, value, unit, sub, accent }) {
  return (
    <div className="bg-black px-3 py-2.5">
      <Label>{label}</Label>
      <div className="font-din mt-1 flex items-baseline gap-1 text-[30px] leading-none font-semibold" style={accent ? { color: accent } : undefined}>
        {value}
        {unit && <span className="text-sm font-medium text-[#8a8a8a]">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-[10px] uppercase tracking-wider text-[#6b6b6b]">{sub}</div>}
    </div>
  )
}

/** Graduations "rondes" pour un axe */
function niceTicks(lo, hi, count = 4) {
  const raw = (hi - lo) / count
  const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)))
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) || raw
  const ticks = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return ticks
}

/** Trace temporelle sélectionnable : température, précipitations, vent ou isotherme 0 °C */
function TraceChart({ hours, channel, refugeAlt, hover, onHover }) {
  const svgRef = useRef(null)
  const W = 360
  const H = 150
  const padL = 38
  const padR = 8
  const padT = 10
  const padB = 20
  const iw = W - padL - padR
  const ih = H - padT - padB
  const n = hours.length
  const xAt = (i) => padL + (n > 1 ? i / (n - 1) : 0.5) * iw

  // Domaine et graduations selon la voie
  let lo = 0
  let hi = 1
  if (channel === 'temp') {
    const v = hours.map((h) => h.temp)
    lo = Math.floor(Math.min(...v) - 1)
    hi = Math.ceil(Math.max(...v) + 1)
    if (hi - lo < 4) hi = lo + 4
  } else if (channel === 'precip') {
    hi = Math.max(1, Math.ceil(Math.max(...hours.map((h) => h.precip))))
  } else if (channel === 'wind') {
    hi = Math.max(30, Math.ceil(Math.max(...hours.map((h) => h.gust)) / 10) * 10)
  } else {
    const v = hours.map((h) => h.freezing).filter((x) => x != null)
    if (refugeAlt != null) v.push(refugeAlt)
    if (v.length) {
      lo = Math.floor((Math.min(...v) - 200) / 100) * 100
      hi = Math.ceil((Math.max(...v) + 200) / 100) * 100
    }
  }
  const ticks = niceTicks(lo, hi, 4)
  const yAt = (v) => padT + (1 - (v - lo) / (hi - lo)) * ih

  const linePath = (vals) => {
    let d = ''
    let pen = false
    vals.forEach((v, i) => {
      if (v == null) {
        pen = false
        return
      }
      d += `${pen ? 'L' : 'M'}${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)} `
      pen = true
    })
    return d.trim()
  }

  const handleMove = (e) => {
    if (!svgRef.current || n < 2) return
    const r = svgRef.current.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    onHover(Math.max(0, Math.min(n - 1, Math.round(((x - padL) / iw) * (n - 1)))))
  }

  const noData = channel === 'iso' && hours.every((h) => h.freezing == null)
  const mainVals = channel === 'temp' ? hours.map((h) => h.temp) : channel === 'wind' ? hours.map((h) => h.windSpeed) : channel === 'iso' ? hours.map((h) => h.freezing) : null
  const barW = Math.max(2, (iw / Math.max(n, 1)) * 0.68)

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full select-none"
        style={{ touchAction: 'pan-y' }}
        onPointerMove={handleMove}
        onPointerDown={handleMove}
        onPointerLeave={(e) => e.pointerType !== 'touch' && onHover(null)}
        role="img"
        aria-label="Évolution heure par heure"
      >
        {/* Graduations horizontales */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} y1={yAt(t)} x2={W - padR} y2={yAt(t)} stroke="#1c1c1c" />
            <text x={padL - 6} y={yAt(t) + 3.5} fill={MUTED} fontSize="10.5" textAnchor="end" className="font-din">
              {channel === 'temp' ? fmtT(t) : channel === 'iso' ? fmtInt(t) : fmt1(t)}
            </text>
          </g>
        ))}
        <line x1={padL} y1={padT + ih} x2={W - padR} y2={padT + ih} stroke="#333" />

        {/* Repères horaires */}
        {hours.map((h, i) =>
          h.hour % 3 === 0 || (n < 4 && i === 0) ? (
            <g key={h.isoTime}>
              <line x1={xAt(i)} y1={padT + ih} x2={xAt(i)} y2={padT + ih + 3} stroke="#555" />
              <text x={xAt(i)} y={H - 5} fill={MUTED} fontSize="10.5" textAnchor="middle" className="font-din">
                {String(h.hour).padStart(2, '0')}H
              </text>
            </g>
          ) : null,
        )}

        {noData && (
          <text x={W / 2} y={H / 2} fill={MUTED} fontSize="12" textAnchor="middle" className="font-din">
            DONNÉE INDISPONIBLE
          </text>
        )}

        {/* TEMPÉRATURE */}
        {channel === 'temp' && (
          <>
            {lo < 0 && hi > 0 && <line x1={padL} y1={yAt(0)} x2={W - padR} y2={yAt(0)} stroke="#6b6b6b" strokeDasharray="3 3" />}
            {n > 1 && <path d={`${linePath(mainVals)} L${xAt(n - 1)} ${padT + ih} L${xAt(0)} ${padT + ih} Z`} fill={ACCENT} fillOpacity="0.1" />}
            <path d={linePath(mainVals)} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" />
          </>
        )}

        {/* PRÉCIPITATIONS : barres colorées selon l'échelle radar */}
        {channel === 'precip' &&
          hours.map((h, i) =>
            h.precip > 0 ? (
              <rect key={h.isoTime} x={xAt(i) - barW / 2} y={yAt(Math.min(h.precip, hi))} width={barW} height={padT + ih - yAt(Math.min(h.precip, hi))} fill={echoColor(h.precip)} />
            ) : null,
          )}

        {/* VENT : moyen + rafales */}
        {channel === 'wind' && (
          <>
            {hi >= 60 && <line x1={padL} y1={yAt(60)} x2={W - padR} y2={yAt(60)} stroke={GUST} strokeOpacity="0.3" strokeDasharray="3 3" />}
            <path d={linePath(hours.map((h) => h.gust))} fill="none" stroke={GUST} strokeWidth="1.5" strokeLinejoin="round" />
            <path d={linePath(mainVals)} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" />
          </>
        )}

        {/* ISOTHERME 0 °C vs altitude du refuge */}
        {channel === 'iso' && !noData && (
          <>
            {refugeAlt != null && (
              <>
                <line x1={padL} y1={yAt(refugeAlt)} x2={W - padR} y2={yAt(refugeAlt)} stroke={ACCENT} strokeDasharray="4 3" />
                <text
                  x={padL + 4}
                  y={yAt(refugeAlt) + (hours[0]?.freezing != null && hours[0].freezing < refugeAlt ? -4 : 11)}
                  fill={ACCENT}
                  fontSize="10"
                  fontWeight="600"
                  className="font-din"
                >
                  REFUGE {fmtInt(refugeAlt)} M
                </text>
              </>
            )}
            <path d={linePath(mainVals)} fill="none" stroke={CYAN} strokeWidth="2" strokeLinejoin="round" />
          </>
        )}

        {/* Curseur */}
        {hover != null && n > 0 && (
          <g>
            <line x1={xAt(hover)} y1={padT} x2={xAt(hover)} y2={padT + ih} stroke="#fff" strokeOpacity="0.35" />
            {mainVals && mainVals[hover] != null && (
              <circle cx={xAt(hover)} cy={yAt(mainVals[hover])} r="4" fill="#000" stroke={channel === 'iso' ? CYAN : ACCENT} strokeWidth="2" />
            )}
          </g>
        )}
      </svg>

      {/* Légende de la voie */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8a8a]">
        {channel === 'temp' && (
          <span className="flex items-center gap-1.5">
            <span className="h-[3px] w-3" style={{ background: ACCENT }} /> Température °C
          </span>
        )}
        {channel === 'wind' && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="h-[3px] w-3" style={{ background: ACCENT }} /> Vent moyen
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-[3px] w-3" style={{ background: GUST }} /> Rafales · km/h
            </span>
          </>
        )}
        {channel === 'iso' && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="h-[3px] w-3" style={{ background: CYAN }} /> Iso 0°C estimée · m
            </span>
            {refugeAlt != null && (
              <span className="flex items-center gap-1.5">
                <span className="h-0 w-3 border-t-2 border-dashed" style={{ borderColor: ACCENT }} /> Refuge
              </span>
            )}
          </>
        )}
        {channel === 'precip' && (
          <>
            <span>mm/h</span>
            {ECHO_SCALE.map((s) => (
              <span key={s.label} className="flex items-center gap-1">
                <span className="h-2 w-2" style={{ background: s.color }} /> {s.label}
              </span>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

export default function RefugeWeatherSection({ lat, lng, alt, nom, onOpenRadar }) {
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedDayIdx, setSelectedDayIdx] = useState(0) // 0: Aujourd'hui, 1: Demain, 2: Après-demain
  const [channel, setChannel] = useState('temp')
  const [hover, setHover] = useState(null)

  useEffect(() => {
    let active = true
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)

    fetchRefugeWeather(lat, lng, alt, ctrl.signal)
      .then((data) => {
        if (!active) return
        setWeather(data)
        setLoading(false)
      })
      .catch((err) => {
        if (!active || ctrl.signal.aborted) return
        setError(err.message)
        setLoading(false)
      })

    return () => {
      active = false
      ctrl.abort()
    }
  }, [lat, lng, alt, reloadKey])

  const shell = 'overflow-hidden rounded-md border border-[#2b2b2b] bg-black text-white [color-scheme:dark]'

  if (loading) {
    return (
      <div className={`${shell} flex items-center justify-center gap-3 px-4 py-5`}>
        <span className="h-2 w-2 animate-pulse" style={{ background: ACCENT }} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a8a8a]">Chargement de la météo…</span>
      </div>
    )
  }

  if (error || !weather) {
    return (
      <div className={`${shell} flex items-center justify-between gap-3 px-4 py-4`}>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: AMBER }}>
            Signal indisponible
          </div>
          <div className="mt-1 text-xs text-[#8a8a8a]">La météo du refuge n’a pas pu être chargée.</div>
        </div>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="flex shrink-0 items-center gap-1.5 rounded-sm border border-[#2b2b2b] px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white transition-colors hover:border-[#444] active:bg-[#1a1a1a]"
        >
          <RefreshCw size={12} /> Réessayer
        </button>
      </div>
    )
  }

  const days = weather.daily || []
  const day = days[selectedDayIdx] || days[0]
  const isToday = selectedDayIdx === 0
  // Aujourd'hui : les 24 prochaines heures en continu (sinon la trace se réduit à quelques points en soirée)
  const hours = isToday ? [...(days[0]?.hourly || []), ...(days[1]?.hourly || [])].slice(0, 24) : day?.hourly || []
  const sel = hover != null && hover < hours.length ? hover : null
  const readout = hours[sel ?? 0]

  const freezingRef = isToday ? weather.freezingLevel : day?.freezingAvg
  const gustMax = day?.windGustMax ?? 0

  // Repères automatiques (seuils indicatifs, pas des vigilances officielles)
  const flags = []
  if (gustMax >= 60) flags.push({ key: 'gust', text: `Rafales jusqu’à ${gustMax} km/h`, color: gustColor(gustMax) })
  if (day?.hasStorm) flags.push({ key: 'storm', text: 'Orage possible', color: AMBER })
  // Marge de 300 m : l'isotherme est estimée, à ±350 m près
  if (alt != null && freezingRef != null && freezingRef < alt - 300) flags.push({ key: 'ice', text: 'Iso 0°C sous le refuge', color: CYAN })
  if ((day?.precipSum ?? 0) >= 5) flags.push({ key: 'precip', text: `Précip. ${fmt1(day.precipSum)} mm`, color: CYAN })

  const dayLabel = (i) => ['AUJ.', 'DEM.', 'J+2'][i] || ''
  const dayDate = (d) => new Date(`${d.dateStr}T12:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  const updated = weather.updatedAt ? new Date(weather.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null

  const trend = weather.pressureTrend
  const trendText = trend == null ? 'Niveau mer' : Math.abs(trend) < 1 ? 'Stable · 3 h' : `${trend > 0 ? '▲ +' : '▼ −'}${fmt1(Math.abs(trend))} · 3 h`

  return (
    <div className={shell}>
      {/* ─── En-tête ─── */}
      <header className="flex items-start justify-between gap-3 px-4 pt-3 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
            <span className="h-3 w-[3px]" style={{ background: ACCENT }} />
            Météo au refuge
          </div>
          <p className="font-din mt-1.5 truncate text-[12px] uppercase tracking-[0.12em] text-[#8a8a8a]">
            {nom ? `${nom} · ` : ''}
            {alt != null ? `${fmtInt(alt)} M` : 'Altitude inconnue'}
          </p>
        </div>

        {onOpenRadar && (
          <button
            onClick={onOpenRadar}
            title="Afficher le radar de précipitations AROME sur la carte"
            className="flex shrink-0 items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors active:bg-[#2a1c00]"
            style={{ borderColor: `${ACCENT}66`, color: ACCENT }}
          >
            <Radar size={13} /> Radar
          </button>
        )}
      </header>

      {/* ─── Onglets de jour ─── */}
      <div role="tablist" className="grid grid-cols-3 border-y" style={{ borderColor: GRID }}>
        {days.map((d, idx) => {
          const active = selectedDayIdx === idx
          return (
            <button
              key={d.dateStr}
              role="tab"
              aria-selected={active}
              onClick={() => {
                setSelectedDayIdx(idx)
                setHover(null)
              }}
              className="relative px-1 py-2 text-center transition-colors"
              style={{ background: active ? '#0f0f0f' : 'transparent' }}
            >
              <div className="font-din text-[15px] font-semibold uppercase tracking-[0.12em]" style={{ color: active ? '#fff' : MUTED }}>
                {dayLabel(idx)}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-[#6b6b6b]">{dayDate(d)}</div>
              <div className="font-din mt-1 flex items-center justify-center gap-1.5 text-[14px] font-semibold">
                <Glyph info={d.codeInfo} size={15} style={{ color: active ? ACCENT : MUTED }} />
                <span style={{ color: active ? '#fff' : MUTED }}>{fmtT(d.tempMax)}°</span>
                <span className="text-[#6b6b6b]">{fmtT(d.tempMin)}°</span>
              </div>
              {active && <span className="absolute inset-x-0 bottom-0 h-[2px]" style={{ background: ACCENT }} />}
            </button>
          )
        })}
      </div>

      {/* ─── Bandeau principal : pictogramme du temps + température ─── */}
      <div className="flex items-center gap-4 px-4 py-3">
        <div
          className="flex h-[72px] w-[72px] shrink-0 items-center justify-center border"
          style={{ borderColor: GRID, background: '#050505', color: ACCENT }}
          title={(isToday ? weather.codeInfo : day.codeInfo).label}
        >
          <Glyph info={isToday ? weather.codeInfo : day.codeInfo} size={44} strokeWidth={1.25} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
            {(isToday ? weather.codeInfo : day.codeInfo).label}
          </div>
          <div className="mt-1 flex items-end gap-4">
            <div className="font-din text-[52px] leading-[0.9] font-semibold">
              {fmtT(isToday ? weather.temp : day.tempMax)}
              <span className="text-2xl font-medium text-[#8a8a8a]">°</span>
            </div>
            <div className="font-din pb-0.5 text-[13px] leading-snug uppercase tracking-wider text-[#8a8a8a]">
              {isToday ? (
                <>
                  <div>
                    Ressenti <span className="font-semibold text-white">{fmtT(weather.feelsLike)}°</span>
                  </div>
                  <div>
                    Max <span className="font-semibold text-white">{fmtT(day.tempMax)}°</span> · Min <span className="font-semibold text-white">{fmtT(day.tempMin)}°</span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    Maximum · Min <span className="font-semibold text-white">{fmtT(day.tempMin)}°</span>
                  </div>
                  <div>
                    Ressenti <span className="font-semibold text-white">{fmtT(day.feelsMax)}°</span> / <span className="font-semibold text-white">{fmtT(day.feelsMin)}°</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Repères automatiques ─── */}
      {flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t px-4 py-2.5" style={{ borderColor: GRID }}>
          {flags.map((f) => (
            <span key={f.key} className="flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ borderColor: `${f.color}66`, color: f.color }}>
              <span className="h-1.5 w-1.5" style={{ background: f.color }} />
              {f.text}
            </span>
          ))}
        </div>
      )}

      {/* ─── Traces heure par heure ─── */}
      {hours.length > 0 && (
        <div className="border-y bg-[#050505]" style={{ borderColor: GRID }}>
          <div role="tablist" aria-label="Voie affichée" className="grid grid-cols-4 border-b" style={{ borderColor: GRID }}>
            {CHANNELS.map((c) => {
              const active = channel === c.key
              return (
                <button
                  key={c.key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setChannel(c.key)}
                  className="relative py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors"
                  style={{ color: active ? ACCENT : MUTED }}
                >
                  {c.label}
                  {active && <span className="absolute inset-x-3 bottom-0 h-[2px]" style={{ background: ACCENT }} />}
                </button>
              )
            })}
          </div>

          {/* Lecture au curseur */}
          <div className="grid grid-cols-5 gap-px border-b" style={{ background: GRID, borderColor: GRID }}>
            {[
              ['Heure', readout.timeStr.replace(':', 'H'), undefined],
              ['Temp.', `${fmtT(readout.temp)}°`, undefined],
              ['Vent', `${readout.windSpeed}/${readout.gust}`, gustColor(readout.gust)],
              ['Précip.', `${fmt1(readout.precip)}`, readout.precip > 0 ? echoColor(readout.precip) : undefined],
              ['Iso 0°', readout.freezing != null ? fmtInt(readout.freezing) : '--', undefined],
            ].map(([label, value, color]) => (
              <div key={label} className="bg-[#050505] px-2 py-1.5 text-center">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#6b6b6b]">{label}</div>
                <div className="font-din text-[17px] leading-tight font-semibold" style={color ? { color } : undefined}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div className="px-2 pt-2.5 pb-2">
            <TraceChart hours={hours} channel={channel} refugeAlt={alt} hover={sel} onHover={setHover} />
          </div>
        </div>
      )}

      {/* ─── Grille de données ─── */}
      <div className="grid grid-cols-2 gap-px border-b" style={{ background: GRID, borderColor: GRID }}>
        {isToday ? (
          <>
            <Field label="Vent" value={weather.windSpeed} unit="KM/H" sub={`De ${windCardinal(weather.windDir)} · ${weather.windDir}°`} />
            <Field label="Rafales" value={weather.windGusts} unit="KM/H" sub={gustClass(weather.windGusts)} accent={gustColor(weather.windGusts)} />
            <Field label="Humidité" value={weather.humidity} unit="%" sub={weather.precipitation > 0 ? `${fmt1(weather.precipitation)} mm/h` : 'Pas de précipitation'} />
            <Field
              label="Iso 0°C"
              value={weather.freezingLevel != null ? fmtInt(weather.freezingLevel) : '--'}
              unit="M"
              accent={CYAN}
              sub={
                weather.freezingLevel != null && alt
                  ? weather.freezingLevel > alt
                    ? `≈ ${fmtInt(Math.round((weather.freezingLevel - alt) / 100) * 100)} m au-dessus du refuge`
                    : `≈ ${fmtInt(Math.round((alt - weather.freezingLevel) / 100) * 100)} m sous le refuge`
                  : 'Limite du gel'
              }
            />
            <Field label="Pression" value={weather.pressure != null ? fmtInt(weather.pressure) : '--'} unit="HPA" sub={trendText} />
            <Field label="Précip. jour" value={fmt1(day.precipSum)} unit="MM" sub={`${day.wetHours} h avec précipitations`} />
          </>
        ) : (
          <>
            <Field
              label="Rafales max"
              value={day.windGustMax}
              unit="KM/H"
              sub={day.peak ? `${gustClass(day.windGustMax)} · ${day.peak.timeStr.replace(':', 'H')} de ${windCardinal(day.peak.windDir)}` : gustClass(day.windGustMax)}
              accent={gustColor(day.windGustMax)}
            />
            <Field label="Précip." value={fmt1(day.precipSum)} unit="MM" sub="Cumul de la journée" />
            <Field label="Durée précip." value={day.wetHours} unit="H" sub="Heures avec précipitations" />
            <Field
              label="Iso 0°C"
              value={day.freezingAvg != null ? fmtInt(day.freezingAvg) : '--'}
              unit="M"
              accent={CYAN}
              sub={day.freezingMin != null ? `${fmtInt(day.freezingMin)} → ${fmtInt(day.freezingMax)} m` : 'Limite du gel'}
            />
          </>
        )}
      </div>

      {/* ─── Pied de page ─── */}
      <footer className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 text-[10px] uppercase tracking-wider text-[#6b6b6b]">
        <span>Météo-France (AROME, ARPEGE) · iso 0°C estimée</span>
        {updated && <span>Maj {updated.replace(':', 'H')}</span>}
      </footer>
    </div>
  )
}
