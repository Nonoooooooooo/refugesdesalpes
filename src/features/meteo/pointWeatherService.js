// Service météo locale haute précision par coordonnées et altitude (Open-Meteo Mountain Model)
// Idéal pour afficher la météo ponctuelle au refuge en complément du radar cartographique AROME

const weatherCache = new Map()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

const CARDINALS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO']

/** Point cardinal (16 secteurs, "O" pour l'ouest) d'un cap en degrés */
export function windCardinal(deg) {
  return deg == null || isNaN(deg) ? '' : CARDINALS[Math.round(deg / 22.5) % 16]
}

/**
 * Traduction des codes météo WMO en français, icônes et pictogramme
 * (`glyph` : clé de pictogramme linéaire, `icon` : emoji conservé pour compatibilité)
 */
export function getWeatherCodeInfo(code) {
  switch (code) {
    case 0:
      return { label: 'Ensoleillé / Ciel dégagé', short: 'Ensoleillé', icon: '☀️', glyph: 'clear', color: '#f59e0b' }
    case 1:
      return { label: 'Peu nuageux', short: 'Éclaircies', icon: '🌤️', glyph: 'fair', color: '#f59e0b' }
    case 2:
      return { label: 'Partiellement nuageux', short: 'Nuageux', icon: '⛅', glyph: 'fair', color: '#94a3b8' }
    case 3:
      return { label: 'Couvert', short: 'Couvert', icon: '☁️', glyph: 'cloud', color: '#64748b' }
    case 45:
    case 48:
      return { label: 'Brouillard givrant', short: 'Brouillard', icon: '🌫️', glyph: 'fog', color: '#94a3b8' }
    case 51:
    case 53:
    case 55:
      return { label: 'Bruine', short: 'Bruine', icon: '🌦️', glyph: 'rain', color: '#38bdf8' }
    case 61:
      return { label: 'Pluie faible', short: 'Pluie faible', icon: '🌧️', glyph: 'rain', color: '#38bdf8' }
    case 63:
      return { label: 'Pluie modérée', short: 'Pluie', icon: '🌧️', glyph: 'rain', color: '#0284c7' }
    case 65:
      return { label: 'Pluie battante', short: 'Forte pluie', icon: '🌧️', glyph: 'rain', color: '#0369a1' }
    case 71:
      return { label: 'Chutes de neige faibles', short: 'Neige faible', icon: '🌨️', glyph: 'snow', color: '#93c5fd' }
    case 73:
      return { label: 'Chutes de neige modérées', short: 'Neige', icon: '❄️', glyph: 'snow', color: '#60a5fa' }
    case 75:
      return { label: 'Fortes chutes de neige', short: 'Forte neige', icon: '❄️', glyph: 'snow', color: '#3b82f6' }
    case 77:
      return { label: 'Grains de neige / Grésil', short: 'Grésil', icon: '🌨️', glyph: 'snow', color: '#93c5fd' }
    case 80:
    case 81:
    case 82:
      return { label: 'Averses de pluie', short: 'Averses', icon: '🌦️', glyph: 'rain', color: '#0284c7' }
    case 85:
    case 86:
      return { label: 'Averses de neige', short: 'Averses neige', icon: '🌨️', glyph: 'snow', color: '#60a5fa' }
    case 95:
      return { label: 'Orage', short: 'Orage', icon: '⚡', glyph: 'storm', color: '#eab308' }
    case 96:
    case 99:
      return { label: 'Orage avec grêle', short: 'Orage violent', icon: '⛈️', glyph: 'storm', color: '#ef4444' }
    default:
      return { label: 'Variable', short: 'Variable', icon: '🌤️', glyph: 'fair', color: '#94a3b8' }
  }
}

/**
 * Récupère les prévisions météo haute altitude pour un refuge
 */
export async function fetchRefugeWeather(lat, lng, elevation, signal) {
  if (lat == null || lng == null) return null

  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)},${Math.round(elevation || 0)}`
  const cached = weatherCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }

  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'precipitation',
      'weather_code',
      'wind_speed_10m',
      'wind_gusts_10m',
      'wind_direction_10m',
      'pressure_msl',
    ].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'apparent_temperature_max',
      'apparent_temperature_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'wind_speed_10m_max',
      'wind_gusts_10m_max',
    ].join(','),
    hourly: [
      'temperature_2m',
      'precipitation_probability',
      'weather_code',
      'freezing_level_height',
      'wind_gusts_10m',
      'wind_speed_10m',
      'wind_direction_10m',
      'precipitation',
      'pressure_msl',
    ].join(','),
    forecast_days: '3',
    past_hours: '3', // sert au calcul de la tendance de pression sur 3 h
    timezone: 'auto',
  })

  if (elevation != null && !isNaN(elevation) && elevation > 0) {
    params.set('elevation', String(Math.round(elevation)))
  }

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`

  try {
    let res = await fetch(url, { signal })
    if ((res.status === 503 || res.status === 429) && !signal?.aborted) {
      await new Promise((r) => setTimeout(r, 600))
      res = await fetch(url, { signal })
    }
    if (!res.ok) {
      throw new Error(`Erreur météo (${res.status})`)
    }
    const raw = await res.json()

    const currentCode = raw.current?.weather_code ?? 0
    const currentCodeInfo = getWeatherCodeInfo(currentCode)

    // Formater les prévisions quotidiennes (3 jours : Aujourd'hui, Demain, Après-demain)
    const nowMs = Date.now() - 30 * 60 * 1000
    const dailyDays = (raw.daily?.time || []).map((dateStr, i) => {
      const date = new Date(dateStr)
      let dayName = ''
      if (i === 0) dayName = "Aujourd'hui"
      else if (i === 1) dayName = 'Demain'
      else {
        dayName = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
      }

      const code = raw.daily?.weather_code?.[i] ?? 0

      // Récupérer toutes les heures de cette journée précise
      const dayHourly = []
      const fullDay = [] // journée entière, y compris les heures déjà passées (agrégats)
      for (let h = 0; h < (raw.hourly?.time || []).length; h++) {
        const hTime = raw.hourly.time[h]
        if (hTime.startsWith(dateStr)) {
          const hDate = new Date(hTime)
          const hCode = raw.hourly?.weather_code?.[h] ?? 0
          const freezing = raw.hourly?.freezing_level_height?.[h]
          const entry = {
            timeStr: hDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            isoTime: hTime,
            hour: hDate.getHours(),
            code: hCode,
            temp: Math.round(raw.hourly?.temperature_2m?.[h] ?? 0),
            precipProb: Math.round(raw.hourly?.precipitation_probability?.[h] ?? 0),
            precip: Math.round((raw.hourly?.precipitation?.[h] ?? 0) * 10) / 10,
            gust: Math.round(raw.hourly?.wind_gusts_10m?.[h] ?? 0),
            windSpeed: Math.round(raw.hourly?.wind_speed_10m?.[h] ?? 0),
            windDir: Math.round(raw.hourly?.wind_direction_10m?.[h] ?? 0),
            freezing: freezing != null ? Math.round(freezing) : null,
            codeInfo: getWeatherCodeInfo(hCode),
          }
          fullDay.push(entry)
          // Pour Aujourd'hui (i === 0), n'afficher qu'à partir de l'heure courante
          if (i === 0 && hDate.getTime() < nowMs) continue
          dayHourly.push(entry)
        }
      }

      // Agrégats de la journée : isotherme 0 °C et heure du pic de rafales
      const freezingVals = fullDay.map((e) => e.freezing).filter((v) => v != null)
      const peak = fullDay.reduce((best, e) => (!best || e.gust > best.gust ? e : best), null)

      return {
        dateStr,
        dayName,
        codeInfo: getWeatherCodeInfo(code),
        tempMax: Math.round(raw.daily?.temperature_2m_max?.[i] ?? 0),
        tempMin: Math.round(raw.daily?.temperature_2m_min?.[i] ?? 0),
        feelsMax: Math.round(raw.daily?.apparent_temperature_max?.[i] ?? 0),
        feelsMin: Math.round(raw.daily?.apparent_temperature_min?.[i] ?? 0),
        precipProb: Math.round(raw.daily?.precipitation_probability_max?.[i] ?? 0),
        precipSum: Math.round((raw.daily?.precipitation_sum?.[i] ?? 0) * 10) / 10,
        windGustMax: Math.round(raw.daily?.wind_gusts_10m_max?.[i] ?? 0),
        freezingMax: freezingVals.length ? Math.max(...freezingVals) : null,
        freezingMin: freezingVals.length ? Math.min(...freezingVals) : null,
        freezingAvg: freezingVals.length ? Math.round(freezingVals.reduce((a, b) => a + b, 0) / freezingVals.length) : null,
        peak: peak ? { timeStr: peak.timeStr, gust: peak.gust, windSpeed: peak.windSpeed, windDir: peak.windDir } : null,
        hasStorm: fullDay.some((e) => e.code >= 95) || code >= 95,
        hourly: dayHourly,
      }
    })

    // Formater les prochaines 24h
    const currentHourIndex = Math.max(
      0,
      (raw.hourly?.time || []).findIndex((t) => new Date(t).getTime() >= Date.now() - 30 * 60 * 1000),
    )
    const next24Hours = (raw.hourly?.time || [])
      .slice(currentHourIndex, currentHourIndex + 16)
      .map((isoTime, i) => {
        const idx = currentHourIndex + i
        const code = raw.hourly?.weather_code?.[idx] ?? 0
        const date = new Date(isoTime)
        return {
          timeStr: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          temp: Math.round(raw.hourly?.temperature_2m?.[idx] ?? 0),
          precipProb: Math.round(raw.hourly?.precipitation_probability?.[idx] ?? 0),
          gust: Math.round(raw.hourly?.wind_gusts_10m?.[idx] ?? 0),
          codeInfo: getWeatherCodeInfo(code),
        }
      })

    const freezingLevel = raw.hourly?.freezing_level_height?.[currentHourIndex] != null
      ? Math.round(raw.hourly.freezing_level_height[currentHourIndex])
      : null

    // Tendance de pression sur 3 h (grâce à past_hours=3)
    const pNow = raw.current?.pressure_msl ?? null
    const pPast = raw.hourly?.pressure_msl?.[currentHourIndex - 3]
    const pressureTrend = pNow != null && pPast != null && currentHourIndex >= 3 ? Math.round((pNow - pPast) * 10) / 10 : null

    const structured = {
      temp: Math.round(raw.current?.temperature_2m ?? 0),
      feelsLike: Math.round(raw.current?.apparent_temperature ?? 0),
      humidity: Math.round(raw.current?.relative_humidity_2m ?? 0),
      windSpeed: Math.round(raw.current?.wind_speed_10m ?? 0),
      windGusts: Math.round(raw.current?.wind_gusts_10m ?? 0),
      windDir: Math.round(raw.current?.wind_direction_10m ?? 0),
      pressure: pNow != null ? Math.round(pNow) : null,
      pressureTrend,
      precipitation: raw.current?.precipitation ?? 0,
      codeInfo: currentCodeInfo,
      freezingLevel,
      daily: dailyDays,
      hourly: next24Hours,
      updatedAt: new Date().toISOString(),
    }

    weatherCache.set(cacheKey, {
      data: structured,
      timestamp: Date.now(),
    })

    return structured
  } catch (err) {
    if (signal?.aborted) throw err
    console.warn('Erreur récupération météo refuge:', err)
    return null
  }
}
