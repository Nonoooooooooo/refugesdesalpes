import { useEffect, useState } from 'react'
import { fetchHikingSegment, NoRouteError } from './brouterService'

const DEBOUNCE_MS = 500
const IDLE = { status: 'idle', source: null, line: null, failures: [] }

/**
 * Colle le tracé aux sentiers : chaque paire de points consécutifs est routée par BRouter.
 * Déplacer un point ne recalcule que ses deux tronçons voisins (les autres sont en cache).
 * Un tronçon sans sentier devient une ligne droite et est signalé dans `failures`.
 *
 * `line` est le tracé à afficher, avec une référence stable tant que les points ne changent pas ;
 * elle vaut null le temps du calcul pour que le profil n'analyse pas un tracé périmé.
 */
export function useHikingPath(points, enabled) {
  const [state, setState] = useState(IDLE)
  const [attempt, setAttempt] = useState(0)
  const active = enabled && points.length >= 2

  useEffect(() => {
    if (!active) return
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setState((s) => ({ ...s, status: 'loading' }))
      const line = []
      const failures = []
      try {
        for (let i = 1; i < points.length; i++) {
          let segment
          try {
            segment = await fetchHikingSegment(points[i - 1], points[i], ctrl.signal)
          } catch (e) {
            if (ctrl.signal.aborted) throw e
            const message = e instanceof NoRouteError ? e.message : navigator.onLine ? e.message : 'Hors-ligne'
            failures.push({ from: i, to: i + 1, message })
            segment = [points[i - 1], points[i]]
          }
          // Le tronçon suivant démarre là où le précédent s'arrête
          line.push(...(line.length ? segment.slice(1) : segment))
        }
        setState({ status: 'ready', source: points, line, failures })
      } catch {
        // Annulé : un nouveau calcul prend le relais
      }
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [points, active, attempt])

  const retry = () => setAttempt((n) => n + 1)
  if (!active) return { status: 'idle', line: points, failures: [], retry }
  if (state.source !== points) return { status: 'loading', line: null, failures: [], retry }
  return { ...state, retry }
}
