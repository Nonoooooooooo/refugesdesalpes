import { useEffect, useMemo, useState } from 'react'
import { fetchWalkingSegment, getCachedSegment, NoRouteError } from './itineraireService'

const DEBOUNCE_MS = 400
// En dessous, le point posé et le début du chemin sont confondus : inutile de les relier
const JOIN_TOLERANCE_M = 1
// Au-delà, la ligne droite entre un point posé et le sentier où le service l'a recalé est signalée
const GAP_NOTICE_M = 150
const M_PER_DEG_LAT = 111320

function distanceM(a, b) {
  const dy = (a.lat - b.lat) * M_PER_DEG_LAT
  const dx = (a.lng - b.lng) * M_PER_DEG_LAT * Math.cos((a.lat * Math.PI) / 180)
  return Math.hypot(dx, dy)
}

const closeEnough = (a, b) => distanceM(a, b) < JOIN_TOLERANCE_M

/**
 * Tracé complet à partir des chemins de chaque tronçon (null = pas encore connu ou introuvable : ligne droite).
 * Chaque chemin est relié aux points posés, que le service recale sur le sentier le plus proche :
 * le trait part et arrive toujours sur les marqueurs. Les liaisons longues, où aucun sentier n'est connu,
 * sont rendues à part dans `gaps` ({ point, meters, positions }, `point` étant l'index du point posé).
 */
function assemble(points, pathOf) {
  const line = []
  const gaps = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const path = pathOf(i) ?? []
    if (path.length) {
      const ends = [
        [i - 1, a, path[0]],
        [i, b, path[path.length - 1]],
      ]
      for (const [point, marker, trail] of ends) {
        const meters = distanceM(marker, trail)
        if (meters > GAP_NOTICE_M) {
          gaps.push({ point, meters, positions: [[marker.lat, marker.lng], [trail.lat, trail.lng]] })
        }
      }
    }
    const segment = [a]
    for (const p of path) if (!closeEnough(segment[segment.length - 1], p)) segment.push(p)
    if (segment.length > 1 && closeEnough(segment[segment.length - 1], b)) segment.pop()
    segment.push(b)
    // Le tronçon suivant démarre sur le point où s'arrête le précédent
    line.push(...(line.length ? segment.slice(1) : segment))
  }
  return { line, gaps }
}

/**
 * Colle le tracé aux sentiers : chaque paire de points consécutifs est routée par l'API d'itinéraire de l'IGN.
 * Les tronçons déjà calculés sont réutilisés tout de suite (annuler, déplacer un point, réactiver le mode) :
 * seuls les nouveaux partent sur le réseau. Un tronçon sans chemin reste en ligne droite et est signalé.
 *
 * `line` est toujours affichable ; `complete` dit si elle est définitive, et c'est seulement alors que
 * le profil doit l'analyser. Sa référence reste stable tant que les points ne changent pas.
 * `gaps` liste les longues liaisons hors sentier du tracé définitif.
 */
export function useHikingPath(points, enabled) {
  const active = enabled && points.length >= 2
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)

  // Tracé provisoire, avec les tronçons déjà en cache et des lignes droites pour les autres
  const draft = useMemo(() => {
    if (!active) return null
    const cached = points.map((p, i) => (i ? getCachedSegment(points[i - 1], p) : null))
    const complete = cached.every((c, i) => i === 0 || c)
    return { ...assemble(points, (i) => cached[i]), complete }
  }, [points, active])

  useEffect(() => {
    if (!active || draft.complete) return
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      const paths = []
      const failures = []
      try {
        for (let i = 1; i < points.length; i++) {
          try {
            paths[i] = await fetchWalkingSegment(points[i - 1], points[i], ctrl.signal)
          } catch (e) {
            if (ctrl.signal.aborted) throw e
            const message = e instanceof NoRouteError || navigator.onLine ? e.message : 'Hors-ligne'
            failures.push({ from: i, to: i + 1, message })
          }
        }
        setResult({ source: points, attempt, ...assemble(points, (i) => paths[i]), failures })
      } catch {
        // Annulé : un nouveau calcul prend le relais
      }
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [points, active, draft, attempt])

  const retry = () => setAttempt((n) => n + 1)
  if (!active) return { status: 'idle', line: points, complete: true, failures: [], gaps: [], retry }
  if (draft.complete) return { status: 'ready', line: draft.line, complete: true, failures: [], gaps: draft.gaps, retry }
  if (result?.source === points && result.attempt === attempt) {
    return { status: 'ready', line: result.line, complete: true, failures: result.failures, gaps: result.gaps, retry }
  }
  return { status: 'loading', line: draft.line, complete: false, failures: [], gaps: [], retry }
}
