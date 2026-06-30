// ─── useMatch ─────────────────────────────────────────────────────────────────
// Single-match hook for the approval flow.
// Fetches match by ID on mount; exposes approve/reject/refinement actions.

import { useState, useEffect, useCallback } from 'react'
import { getMatchById } from '../lib/dashboard/fetchers.js'
import {
  approveMatch as approveMatchAction,
  rejectMatch as rejectMatchAction,
  requestRefinement as requestRefinementAction,
} from '../lib/dashboard/actions.js'
import { supabase } from '../supabase.js'

/**
 * @param {{ matchId: string }} props
 */
export function useMatch({ matchId }) {
  const [match, setMatch] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
    })
  }, [])

  useEffect(() => {
    if (!matchId || !userId) return

    setIsLoading(true)
    getMatchById(matchId, userId)
      .then(setMatch)
      .finally(() => setIsLoading(false))
  }, [matchId, userId])

  const approve = useCallback(async () => {
    if (!match) return { success: false, error: 'No match loaded' }
    setIsLoading(true)
    const result = await approveMatchAction(match.id)
    if (result.success) setMatch((m) => m ? { ...m, status: 'approved' } : m)
    setIsLoading(false)
    return result
  }, [match])

  const reject = useCallback(async () => {
    if (!match) return { success: false, error: 'No match loaded' }
    setIsLoading(true)
    const result = await rejectMatchAction(match.id)
    if (result.success) setMatch((m) => m ? { ...m, status: 'rejected' } : m)
    setIsLoading(false)
    return result
  }, [match])

  const requestRefinement = useCallback(async (note) => {
    if (!match) return { success: false, error: 'No match loaded' }
    setIsLoading(true)
    const result = await requestRefinementAction(match.id, note)
    if (result.success) setMatch((m) => m ? { ...m, status: 'rejected' } : m)
    setIsLoading(false)
    return result
  }, [match])

  return { match, isLoading, approve, reject, requestRefinement }
}
