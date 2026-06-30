// ─── useMatches ──────────────────────────────────────────────────────────────
// Fetches filtered matches, subscribes to realtime, exposes approve/reject.
// Merges user-specific matches with global inventory matches so the user sees
// the full 30K+ catalogue, not just the handful of seeded per-user rows.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase.js'
import {
  getFilteredMatches,
  getInventoryMatches,
  getActionedMatchIds,
} from '../lib/dashboard/fetchers.js'
import {
  approveMatch as approveMatchAction,
  rejectMatch as rejectMatchAction,
  requestRefinement as requestRefinementAction,
} from '../lib/dashboard/actions.js'

/**
 * @param {{ userId: string, filters: { type?: string, status?: string, sort?: string } }} props
 */
export function useMatches({ userId, filters = {} }) {
  const [matches, setMatches] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)

    // 1. Fetch user-specific matches (seeded / agent-created for this user)
    const userMatches = await getFilteredMatches(userId, filters)

    // 2. Fetch inventory matches (user_id=null, the 30K global catalogue)
    //    Only fetch inventory for pending/no-status filter — approved/rejected
    //    are user-specific by definition.
    let inventoryMatches = []
    if (!filters.status || filters.status === 'pending') {
      try {
        // Load user preferences for city/budget filtering
        const { data: prefs } = await supabase
          .from('search_preferences')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (prefs) {
          const actionedIds = await getActionedMatchIds(userId)
          // Also exclude IDs already in userMatches
          const userMatchIds = new Set(userMatches.map(m => m.id))
          const allExcluded = new Set([...actionedIds, ...userMatchIds])

          // Fetch listings from inventory
          if (!filters.type || filters.type === 'listing') {
            const listings = await getInventoryMatches(
              {
                city: prefs.cities?.[0],
                cities: prefs.cities,
                budget: { min: prefs.budget_min, max: prefs.budget_max },
                budget_max: prefs.budget_max,
              },
              allExcluded,
              { type: 'listing', limit: 200, minScore: 55 }
            )
            inventoryMatches.push(...listings)
          }

          // Fetch flatmates from inventory
          if (!filters.type || filters.type === 'flatmate') {
            const flatmates = await getInventoryMatches(
              {
                city: prefs.cities?.[0],
                cities: prefs.cities,
              },
              allExcluded,
              { type: 'flatmate', limit: 200, minScore: 55 }
            )
            inventoryMatches.push(...flatmates)
          }

          // Inventory items default to pending status for the review flow
          inventoryMatches = inventoryMatches.map(m => ({
            ...m,
            status: m.status || 'pending',
          }))
        }
      } catch (err) {
        console.warn('useMatches: inventory fetch failed:', err.message)
      }
    }

    // 3. Merge: user matches first, then inventory (no duplicates)
    const seenIds = new Set(userMatches.map(m => m.id))
    const merged = [...userMatches]
    for (const inv of inventoryMatches) {
      if (!seenIds.has(inv.id)) {
        seenIds.add(inv.id)
        merged.push(inv)
      }
    }

    // 4. Apply sorting
    if (filters.sort === 'price_asc') {
      merged.sort((a, b) => (a.data?.price ?? 0) - (b.data?.price ?? 0))
    } else if (filters.sort === 'price_desc') {
      merged.sort((a, b) => (b.data?.price ?? 0) - (a.data?.price ?? 0))
    } else if (filters.sort === 'date') {
      merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    } else {
      // default: score descending
      merged.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    }

    setMatches(merged)
    setIsLoading(false)
  }, [userId, filters.type, filters.status, filters.sort]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refresh()
  }, [refresh])

  // Realtime subscription
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`matches-tab:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `user_id=eq.${userId}` },
        () => refresh()
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [userId, refresh])

  const approveMatch = useCallback(async (matchId) => {
    const result = await approveMatchAction(matchId)
    if (result.success) await refresh()
    return result
  }, [refresh])

  const rejectMatch = useCallback(async (matchId) => {
    const result = await rejectMatchAction(matchId)
    if (result.success) await refresh()
    return result
  }, [refresh])

  const requestRefinement = useCallback(async (matchId, note) => {
    const result = await requestRefinementAction(matchId, note)
    if (result.success) await refresh()
    return result
  }, [refresh])

  return { matches, isLoading, approveMatch, rejectMatch, requestRefinement, refresh }
}
