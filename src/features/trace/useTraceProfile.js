import { useEffect, useState } from 'react'
import { computeTraceProfile } from './profile'

const DEBOUNCE_MS = 500
const IDLE = { status: 'idle', profile: null, error: null }

/**
 * Recalcule le profil du tracé quand ses points changent, après une courte pause :
 * une série de modifications rapides ne déclenche qu'un seul appel au service IGN.
 */
export function useTraceProfile(points) {
  const [state, setState] = useState(IDLE)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (points.length < 2) return
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setState((s) => ({ ...s, status: 'loading', error: null }))
      try {
        const profile = await computeTraceProfile(points, ctrl.signal)
        setState({ status: 'ready', profile, error: null })
      } catch (e) {
        if (ctrl.signal.aborted) return
        const error = navigator.onLine ? e.message : 'Profil indisponible hors-ligne'
        setState((s) => ({ ...s, status: 'error', error }))
      }
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [points, attempt])

  const retry = () => setAttempt((n) => n + 1)
  if (points.length < 2) return { ...IDLE, retry }
  // Le profil affiché ne correspond au tracé que s'il a été calculé sur ces points-là
  return { ...state, fresh: state.profile?.points === points, retry }
}
