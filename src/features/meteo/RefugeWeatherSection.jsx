import { useState, useEffect } from 'react'
import {
  CloudRain,
  Wind,
  Droplets,
  Mountain,
  Thermometer,
  Loader2,
  Clock,
} from 'lucide-react'
import { fetchRefugeWeather } from './pointWeatherService'

export default function RefugeWeatherSection({
  lat,
  lng,
  alt,
  onOpenRadar,
}) {
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedDayIdx, setSelectedDayIdx] = useState(0) // 0: Aujourd'hui, 1: Demain, 2: Après-demain

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
  }, [lat, lng, alt])

  if (loading) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/25 p-4 flex items-center justify-center gap-2 text-xs text-emerald-200/70">
        <Loader2 size={15} className="animate-spin text-emerald-400" />
        <span>Chargement de la météo d'altitude…</span>
      </div>
    )
  }

  if (error || !weather) return null

  const selectedDay = weather.daily?.[selectedDayIdx]

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/35 p-4 shadow-xl backdrop-blur-md flex flex-col gap-3.5 transition-all">
      {/* ─── En-tête : Titre & Altitude ─── */}
      <div className="flex items-center justify-between gap-2 border-b border-emerald-500/20 pb-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-lg shadow-inner shrink-0">
            {weather.codeInfo.icon}
          </span>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Météo au refuge
              </h3>
              {alt != null && (
                <span className="rounded-md bg-emerald-500/25 border border-emerald-400/30 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-200">
                  {alt} m
                </span>
              )}
            </div>
            <p className="text-xs text-emerald-200/90 font-medium">
              {weather.codeInfo.label}
            </p>
          </div>
        </div>

        {onOpenRadar && (
          <button
            onClick={onOpenRadar}
            title="Afficher le radar de précipitations AROME sur la carte"
            className="group rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/40 px-2.5 py-1 text-xs font-semibold text-emerald-200 transition-all flex items-center gap-1 active:scale-95 shrink-0"
          >
            <CloudRain size={13} className="text-emerald-300 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Radar</span> Carte
          </button>
        )}
      </div>

      {/* ─── Sélecteur 3 Jours : Aujourd'hui / Demain / Après-demain ─── */}
      {weather.daily && weather.daily.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {weather.daily.map((day, idx) => {
            const isSelected = selectedDayIdx === idx
            return (
              <button
                key={day.dateStr}
                onClick={() => setSelectedDayIdx(idx)}
                className={`rounded-xl p-2 text-left flex flex-col justify-between transition-all ${
                  isSelected
                    ? 'bg-emerald-500/30 border border-emerald-400/50 shadow-md ring-1 ring-emerald-400/30 text-white font-medium'
                    : 'bg-black/25 border border-white/5 hover:bg-white/5 text-white/70'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-semibold truncate">{day.dayName}</span>
                  <span className="text-sm">{day.codeInfo.icon}</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xs font-bold text-white">
                    {day.tempMax > 0 ? `+${day.tempMax}` : day.tempMax}°
                  </span>
                  <span className="text-[10px] text-white/50">
                    {day.tempMin > 0 ? `+${day.tempMin}` : day.tempMin}°
                  </span>
                </div>
                {day.precipProb > 0 && (
                  <span className="text-[9px] text-sky-300 font-semibold mt-0.5">
                    💧 {day.precipProb}%
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* ─── Détail de la journée sélectionnée ─── */}
      {selectedDayIdx === 0 ? (
        // Aujourd'hui (Valeurs en temps réel)
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-xl bg-black/25 border border-white/5 p-2 flex flex-col">
            <span className="text-[10px] text-white/50 flex items-center gap-1">
              <Thermometer size={11} className="text-rose-400" /> Température
            </span>
            <span className="text-base font-bold text-white mt-0.5">
              {weather.temp > 0 ? `+${weather.temp}` : weather.temp}°C
            </span>
            <span className="text-[9px] text-white/50">
              Ressenti {weather.feelsLike}°C
            </span>
          </div>

          <div className="rounded-xl bg-black/25 border border-white/5 p-2 flex flex-col">
            <span className="text-[10px] text-white/50 flex items-center gap-1">
              <Wind size={11} className="text-purple-400" /> Rafales
            </span>
            <span className="text-base font-bold text-white mt-0.5">
              {weather.windGusts} <span className="text-xs font-normal">km/h</span>
            </span>
            <span className="text-[9px] text-white/50">
              Vent moy. {weather.windSpeed} km/h
            </span>
          </div>

          <div className="rounded-xl bg-black/25 border border-white/5 p-2 flex flex-col">
            <span className="text-[10px] text-white/50 flex items-center gap-1">
              <Droplets size={11} className="text-sky-400" /> Humidité
            </span>
            <span className="text-base font-bold text-white mt-0.5">
              {weather.humidity}%
            </span>
            <span className="text-[9px] text-white/50">
              {weather.precipitation > 0 ? `${weather.precipitation} mm` : 'Pas de pluie'}
            </span>
          </div>

          <div className="rounded-xl bg-black/25 border border-white/5 p-2 flex flex-col">
            <span className="text-[10px] text-white/50 flex items-center gap-1">
              <Mountain size={11} className="text-amber-400" /> Isotherme 0°C
            </span>
            <span className="text-base font-bold text-white mt-0.5">
              {weather.freezingLevel != null ? `${weather.freezingLevel} m` : '—'}
            </span>
            <span className="text-[9px] text-white/50">
              {weather.freezingLevel && alt
                ? weather.freezingLevel > alt
                  ? `+${weather.freezingLevel - alt} m plus haut`
                  : `${alt - weather.freezingLevel} m sous le refuge`
                : 'Limite du gel'}
            </span>
          </div>
        </div>
      ) : (
        // Demain / Après-demain (Vue journée)
        selectedDay && (
          <div className="rounded-xl bg-black/25 border border-white/5 p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selectedDay.codeInfo.icon}</span>
                <div>
                  <div className="text-xs font-bold text-white">
                    {selectedDay.dayName} : {selectedDay.codeInfo.label}
                  </div>
                  <div className="text-[11px] text-emerald-200/80">
                    Max : {selectedDay.tempMax > 0 ? `+${selectedDay.tempMax}` : selectedDay.tempMax}°C (ressenti {selectedDay.feelsMax}°C) · Min : {selectedDay.tempMin > 0 ? `+${selectedDay.tempMin}` : selectedDay.tempMin}°C
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1 pt-2 border-t border-white/10 text-xs">
              <div className="flex items-center gap-1.5 text-white/80">
                <Wind size={13} className="text-purple-400" />
                <span>Rafales max : <strong>{selectedDay.windGustMax} km/h</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-white/80">
                <Droplets size={13} className="text-sky-400" />
                <span>Probabilité pluie : <strong>{selectedDay.precipProb}%</strong></span>
              </div>
            </div>
          </div>
        )
      )}

      {/* ─── Prévision heure par heure (pour le jour sélectionné : Aujourd'hui, Demain ou Après-demain) ─── */}
      {selectedDay?.hourly && selectedDay.hourly.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200/60 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Clock size={10} /> Déroulé heure par heure
            </span>
            <span className="text-[9px] lowercase font-normal text-white/50">
              {selectedDayIdx === 0 ? "aujourd’hui" : selectedDay.dayName}
            </span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scroll-thin">
            {selectedDay.hourly.map((h, idx) => (
              <div
                key={idx}
                className="flex flex-col items-center justify-between rounded-xl bg-black/25 px-2 py-1.5 text-center shrink-0 min-w-[50px] border border-white/5 hover:border-emerald-400/30 transition-colors"
              >
                <span className="text-[10px] text-white/60 font-mono">{h.timeStr}</span>
                <span className="text-base my-0.5">{h.codeInfo.icon}</span>
                <span className="text-xs font-bold text-white">
                  {h.temp > 0 ? `+${h.temp}` : h.temp}°
                </span>
                {h.precipProb > 0 ? (
                  <span className="text-[9px] text-sky-300 font-semibold mt-0.5">
                    {h.precipProb}%
                  </span>
                ) : (
                  <span className="text-[9px] text-white/20 mt-0.5">0%</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
