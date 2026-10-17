import { useState, useEffect } from 'react'
import {
  CloudRain,
  Wind,
  Droplets,
  Mountain,
  Thermometer,
  Loader2,
  ExternalLink,
  ChevronRight,
} from 'lucide-react'
import { fetchRefugeWeather } from './pointWeatherService'

export default function RefugeWeatherSection({
  lat,
  lng,
  alt,
  nom,
  onOpenRadar,
}) {
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center justify-center gap-2 text-xs text-white/60">
        <Loader2 size={15} className="animate-spin text-sky-400" />
        <span>Chargement des prévisions météo…</span>
      </div>
    )
  }

  if (error || !weather) return null

  return (
    <div className="rounded-2xl border border-sky-400/20 bg-sky-950/20 p-4 shadow-xl backdrop-blur-md flex flex-col gap-3">
      {/* ─── Titre & Bouton d'action Radar ─── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{weather.codeInfo.icon}</span>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Météo au refuge
              </h3>
              {alt != null && (
                <span className="rounded-md bg-white/10 px-1.5 py-0.2 text-[10px] text-white/70">
                  {alt} m
                </span>
              )}
            </div>
            <p className="text-xs text-sky-200/90 font-medium">
              {weather.codeInfo.label}
            </p>
          </div>
        </div>

        {onOpenRadar && (
          <button
            onClick={onOpenRadar}
            title="Activer le radar de pluie/neige AROME centré sur ce massif"
            className="group rounded-xl bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/40 px-2.5 py-1 text-xs font-semibold text-sky-200 transition-all flex items-center gap-1 active:scale-95 shrink-0"
          >
            <CloudRain size={13} className="text-sky-300 group-hover:scale-110 transition-transform" />
            <span>Radar AROME</span>
          </button>
        )}
      </div>

      {/* ─── Indicateurs clés : Température, Ressenti, Vent, Isotherme ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl bg-white/5 p-2 flex flex-col">
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

        <div className="rounded-xl bg-white/5 p-2 flex flex-col">
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

        <div className="rounded-xl bg-white/5 p-2 flex flex-col">
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

        <div className="rounded-xl bg-white/5 p-2 flex flex-col">
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

      {/* ─── Prévision heure par heure (12h) ─── */}
      {weather.hourly && weather.hourly.length > 0 && (
        <div className="mt-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/50 mb-1.5 flex items-center justify-between">
            <span>Évolution aujourd’hui</span>
            <span className="text-[9px] lowercase font-normal">heures à venir</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scroll-thin">
            {weather.hourly.map((h, idx) => (
              <div
                key={idx}
                className="flex flex-col items-center justify-between rounded-xl bg-white/5 px-2 py-1.5 text-center shrink-0 min-w-[52px] border border-white/5 hover:border-white/20 transition-colors"
              >
                <span className="text-[10px] text-white/60 font-mono">{h.timeStr}</span>
                <span className="text-base my-0.5">{h.codeInfo.icon}</span>
                <span className="text-xs font-bold text-white">
                  {h.temp > 0 ? `+${h.temp}` : h.temp}°
                </span>
                {h.precipProb > 0 && (
                  <span className="text-[9px] text-sky-300 font-semibold mt-0.5">
                    {h.precipProb}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
