import { getTimes, getPosition } from 'suncalc'

/**
 * Formate une date en heure HH:mm
 */
export function formatTime(date) {
  if (!date || isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function hasValidTime(date) {
  return !!date && !isNaN(date.getTime())
}

/**
 * Formate des minutes en Xh Ym
 */
export function formatDuration(totalMinutes) {
  if (totalMinutes == null || isNaN(totalMinutes)) return '--'
  const h = Math.floor(totalMinutes / 60)
  const m = Math.round(totalMinutes % 60)
  return `${h}h ${m < 10 ? '0' : ''}${m}m`
}

/**
 * Calcule l'ensemble des données solaires et la courbe d'orbite 24h
 * pour des coordonnées GPS (lat, lng), une altitude et une date données.
 */
export function getSunEphemeris(date = new Date(), lat, lng, alt = 0) {
  if (lat == null || lng == null) return null

  // Date de référence calée au début de la journée locale (00:00:00)
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)

  // Éphémérides astronomiques officielles (avec correction d'altitude de l'observateur en mètres)
  const times = getTimes(date, lat, lng, alt || 0)
  const now = new Date()
  const isToday = now.toDateString() === date.toDateString()

  // Durée du jour (du lever au coucher)
  const dayLengthMs = Math.max(0, times.sunset ? times.sunset.getTime() - times.sunrise.getTime() : 0)
  const dayLengthMin = dayLengthMs / (1000 * 60)

  // Position instantanée du soleil
  const currentPos = getPosition(now, lat, lng)
  const currentAltDeg = currentPos.altitude // en degrés dans suncalc v2
  const currentAzimuthDeg = currentPos.azimuth // 0=Nord, 90=Est, 180=Sud, 270=Ouest

  // Temps restant avant le coucher (si aujourd'hui et avant le coucher)
  let remainingText = null
  let remaining = null // { kind: 'sunrise' | 'sunset' | 'night', min }
  if (isToday && times.sunrise && times.sunset) {
    if (now < times.sunrise) {
      const diffMin = Math.round((times.sunrise.getTime() - now.getTime()) / 60000)
      remainingText = `Lever du soleil dans ${formatDuration(diffMin)}`
      remaining = { kind: 'sunrise', min: diffMin }
    } else if (now < times.sunset) {
      const diffMin = Math.round((times.sunset.getTime() - now.getTime()) / 60000)
      remainingText = `${formatDuration(diffMin)} de jour restant`
      remaining = { kind: 'sunset', min: diffMin }
    } else {
      remainingText = 'Nuit en cours'
      // Après le coucher : décompte jusqu'au lever de demain
      const tomorrow = new Date(date)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const nextRise = getTimes(tomorrow, lat, lng, alt || 0).sunrise
      remaining = hasValidTime(nextRise)
        ? { kind: 'sunrise', min: Math.round((nextRise.getTime() - now.getTime()) / 60000), at: nextRise, tomorrow: true }
        : { kind: 'night', min: 0 }
    }
  }

  // Dimensions du canvas SVG
  const width = 480
  const height = 196
  const padX = 30
  const chartWidth = width - padX * 2
  const horizonY = 98
  const topY = 24
  const bottomY = 146
  const axisY = 168

  // Calcul des altitudes sur 24h (toutes les 10 minutes = 145 points)
  const samples = []
  let maxAlt = 0
  let minAlt = 0

  for (let m = 0; m <= 1440; m += 10) {
    // Heure d'horloge (et non temps écoulé) : l'axe X est gradué en heures locales,
    // ce qui reste juste les jours de changement d'heure (23 h / 25 h)
    const t = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), startOfDay.getDate(), 0, m)
    const pos = getPosition(t, lat, lng)
    const altDeg = pos.altitude
    if (altDeg > maxAlt) maxAlt = altDeg
    if (altDeg < minAlt) minAlt = altDeg
    samples.push({ minutes: m, alt: altDeg })
  }

  // Sécurité pour la division
  const peakAlt = maxAlt > 5 ? maxAlt : 45
  const valleyAlt = Math.abs(minAlt) > 5 ? Math.abs(minAlt) : 50

  // Fonction de conversion (minutes, altDeg) -> coordonnées SVG (x, y)
  const toSvgX = (m) => padX + (m / 1440) * chartWidth
  const toSvgY = (altDeg) => {
    if (altDeg >= 0) {
      // Jour : de horizonY (0°) vers topY (peakAlt)
      const ratio = Math.min(1, altDeg / peakAlt)
      return horizonY - ratio * (horizonY - topY)
    } else {
      // Nuit : de horizonY (0°) vers bottomY (minAlt)
      const ratio = Math.min(1, Math.abs(altDeg) / valleyAlt)
      return horizonY + ratio * (bottomY - horizonY)
    }
  }

  // Construction des points SVG
  const curvePoints = samples.map((s) => ({
    x: toSvgX(s.minutes),
    y: toSvgY(s.alt),
    alt: s.alt,
    m: s.minutes,
  }))

  // Création du chemin SVG complet de la courbe (smooth)
  const fullPathD = curvePoints.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `${acc} L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`
  }, '')

  // Découpage en 3 chemins distincts selon l'état astronomique :
  // 1. Jour (alt >= 0°)
  // 2. Crépuscule civil (-6° <= alt < 0°)
  // 3. Nuit (alt < -6°)
  const daySegments = []
  const twilightSegments = []
  const nightSegments = []

  for (let i = 0; i < curvePoints.length - 1; i++) {
    const p1 = curvePoints[i]
    const p2 = curvePoints[i + 1]
    const avgAlt = (p1.alt + p2.alt) / 2
    const seg = `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`

    if (avgAlt >= 0) {
      daySegments.push(seg)
    } else if (avgAlt >= -6) {
      twilightSegments.push(seg)
    } else {
      nightSegments.push(seg)
    }
  }

  // Minutes dans la journée pour les événements clés
  const getDayMinutes = (d) => {
    if (!d || isNaN(d.getTime())) return null
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
  }

  const sunriseM = getDayMinutes(times.sunrise)
  const sunsetM = getDayMinutes(times.sunset)
  const noonM = getDayMinutes(times.solarNoon)
  const dawnM = getDayMinutes(times.dawn)
  const duskM = getDayMinutes(times.dusk)

  // Coordonnées clés pour les annotations
  // Lever/coucher calculés avec la dépression de l'horizon en altitude : le point est posé sur la courbe
  const sunrisePt = sunriseM != null ? { x: toSvgX(sunriseM), y: toSvgY(getPosition(times.sunrise, lat, lng).altitude), m: sunriseM, time: formatTime(times.sunrise) } : null
  const sunsetPt = sunsetM != null ? { x: toSvgX(sunsetM), y: toSvgY(getPosition(times.sunset, lat, lng).altitude), m: sunsetM, time: formatTime(times.sunset) } : null
  const noonPt = noonM != null ? { x: toSvgX(noonM), y: toSvgY(peakAlt), m: noonM, time: formatTime(times.solarNoon), maxAlt: Math.round(peakAlt) } : null
  const dawnPt = dawnM != null ? { x: toSvgX(dawnM), y: toSvgY(-6), m: dawnM, time: formatTime(times.dawn) } : null
  const duskPt = duskM != null ? { x: toSvgX(duskM), y: toSvgY(-6), m: duskM, time: formatTime(times.dusk) } : null

  // Zone hachurée / dégradée sous l'arc du jour (au-dessus de l'horizon)
  let dayAreaPathD = ''
  if (sunrisePt && sunsetPt) {
    const dayCurvePts = curvePoints.filter((p) => p.alt >= 0)
    if (dayCurvePts.length > 0) {
      dayAreaPathD = `M ${sunrisePt.x.toFixed(1)} ${horizonY} ` +
        dayCurvePts.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
        ` L ${sunsetPt.x.toFixed(1)} ${horizonY} Z`
    }
  }

  // Position du curseur "Maintenant"
  let nowPt = null
  if (isToday) {
    const nowM = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
    nowPt = {
      x: toSvgX(nowM),
      y: toSvgY(currentAltDeg),
      alt: currentAltDeg,
      time: formatTime(now),
      isDay: currentAltDeg >= 0,
      isTwilight: currentAltDeg < 0 && currentAltDeg >= -6,
      isNight: currentAltDeg < -6,
    }
  }

  // Données complémentaires : azimuts du lever/coucher, élévation max, écart avec la veille
  const azimuthAt = (d) => (hasValidTime(d) ? Math.round(getPosition(d, lat, lng).azimuth) : null)

  const yesterday = new Date(date)
  yesterday.setDate(yesterday.getDate() - 1)
  const yTimes = getTimes(yesterday, lat, lng, alt || 0)
  const yLenMs = hasValidTime(yTimes.sunrise) && hasValidTime(yTimes.sunset)
    ? yTimes.sunset.getTime() - yTimes.sunrise.getTime()
    : null
  const dayDeltaSec = yLenMs != null && dayLengthMs > 0 ? Math.round((dayLengthMs - yLenMs) / 1000) : null

  // Part de la journée solaire déjà écoulée (0 → 1), uniquement pour aujourd'hui
  let dayProgress = null
  if (isToday && dayLengthMs > 0) {
    dayProgress = Math.min(1, Math.max(0, (now.getTime() - times.sunrise.getTime()) / dayLengthMs))
  }

  return {
    times,
    isToday,
    now,
    dayLengthMin,
    dayLengthStr: formatDuration(dayLengthMin),
    dayDeltaSec,
    dayProgress,
    maxAltDeg: Math.round(maxAlt * 10) / 10,
    sunriseAzimuth: azimuthAt(times.sunrise),
    sunsetAzimuth: azimuthAt(times.sunset),
    remainingText,
    remaining,
    currentPos: {
      altitudeDeg: Math.round(currentAltDeg * 10) / 10,
      azimuthDeg: Math.round(currentAzimuthDeg),
    },
    svg: {
      width,
      height,
      horizonY,
      topY,
      bottomY,
      axisY,
      padX,
      chartWidth,
      fullPathD,
      daySegments: daySegments.join(' '),
      twilightSegments: twilightSegments.join(' '),
      nightSegments: nightSegments.join(' '),
      dayAreaPathD,
      sunrisePt,
      sunsetPt,
      noonPt,
      dawnPt,
      duskPt,
      nowPt,
    },
  }
}
