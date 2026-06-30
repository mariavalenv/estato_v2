// ─── useDashboard ─────────────────────────────────────────────────────────────
// Central hook for the dashboard. Accepts server-rendered initialData,
// subscribes to Realtime for live updates, and exposes mutation actions.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase.js'
import {
  getAgentStatus,
  getRecentActivity,
  getStrongMatches,
  getNeedsInput,
  getAllMatches,
  getInventoryMatches,
  getActionedMatchIds,
} from '../lib/dashboard/fetchers.js'
import { db } from '../supabase.js'
import {
  approveMatch as approveMatchAction,
  rejectMatch as rejectMatchAction,
  requestRefinement as requestRefinementAction,
} from '../lib/dashboard/actions.js'

/**
 * @param {{ initialData: import('../types/dashboard').DashboardData, userId: string }} props
 */
export function useDashboard({ initialData, userId }) {
  const [agentStatus, setAgentStatus] = useState(initialData?.agentStatus ?? null)
  const [recentActivity, setRecentActivity] = useState(initialData?.recentActivity ?? [])
  const [strongMatches, setStrongMatches] = useState(initialData?.strongMatches ?? [])
  const [needsInput, setNeedsInput] = useState(initialData?.needsInput ?? [])
  const [allMatches, setAllMatches] = useState(initialData?.allMatches ?? [])
  const [isLoading, setIsLoading] = useState(false)

  // Sync state when initialData arrives asynchronously (it's null on mount)
  useEffect(() => {
    if (!initialData) return
    if (initialData.agentStatus !== undefined) setAgentStatus(initialData.agentStatus)
    if (initialData.recentActivity !== undefined) setRecentActivity(initialData.recentActivity)
    if (initialData.strongMatches !== undefined) setStrongMatches(initialData.strongMatches)
    if (initialData.needsInput !== undefined) setNeedsInput(initialData.needsInput)
    if (initialData.allMatches !== undefined) setAllMatches(initialData.allMatches)
  }, [initialData])

  // Refetch matches-related state (user-specific + inventory)
  const refreshMatches = useCallback(async () => {
    if (!userId) return
    const [strong, needs, all] = await Promise.all([
      getStrongMatches(userId),
      getNeedsInput(userId),
      getAllMatches(userId),
    ])

    // Also pull inventory matches if user has preferences
    let combined = strong
    try {
      const prefs = await db.getPreferences(userId)
      if (prefs) {
        const actionedIds = await getActionedMatchIds(userId)
        const [invListings, invFlatmates] = await Promise.all([
          getInventoryMatches(prefs, actionedIds, { type: 'listing', limit: 10, minScore: 65 }),
          getInventoryMatches(prefs, actionedIds, { type: 'flatmate', limit: 5, minScore: 65 }),
        ])
        const invIds = new Set(combined.map(m => m.id))
        const newInv = [...invListings, ...invFlatmates].filter(m => !invIds.has(m.id))
        combined = [...combined, ...newInv].sort((a, b) => b.score - a.score)
      }
    } catch (e) {
      console.warn('[useDashboard] inventory refresh failed:', e)
    }

    setStrongMatches(combined)
    setNeedsInput(needs)
    setAllMatches(all)
  }, [userId])

  // Refetch agent status and activity
  const refreshAgentStatus = useCallback(async () => {
    if (!userId) return
    const [status, activity] = await Promise.all([
      getAgentStatus(userId),
      getRecentActivity(userId),
    ])
    setAgentStatus(status)
    setRecentActivity(activity)
  }, [userId])

  // Realtime subscriptions
  useEffect(() => {
    if (!userId) return

    const matchesSub = supabase
      .channel(`matches:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `user_id=eq.${userId}` },
        () => refreshMatches()
      )
      .subscribe()

    const agentSub = supabase
      .channel(`agent_status:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_status', filter: `user_id=eq.${userId}` },
        () => refreshAgentStatus()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(matchesSub)
      supabase.removeChannel(agentSub)
    }
  }, [userId, refreshMatches, refreshAgentStatus])

  const approveMatch = useCallback(async (matchId) => {
    setIsLoading(true)
    try {
      const result = await approveMatchAction(matchId)
      if (result.success) await refreshMatches()
      return result
    } finally {
      setIsLoading(false)
    }
  }, [refreshMatches])

  const rejectMatch = useCallback(async (matchId) => {
    setIsLoading(true)
    try {
      const result = await rejectMatchAction(matchId)
      if (result.success) await refreshMatches()
      return result
    } finally {
      setIsLoading(false)
    }
  }, [refreshMatches])

  const requestRefinement = useCallback(async (matchId, note) => {
    setIsLoading(true)
    try {
      const result = await requestRefinementAction(matchId, note)
      if (result.success) await refreshMatches()
      return result
    } finally {
      setIsLoading(false)
    }
  }, [refreshMatches])

  return {
    agentStatus,
    recentActivity,
    strongMatches,
    needsInput,
    allMatches,
    isLoading,
    approveMatch,
    rejectMatch,
    requestRefinement,
  }
}
