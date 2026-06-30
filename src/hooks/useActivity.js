// ─── useActivity ──────────────────────────────────────────────────────────────
// Fetches agent activity with optional type filter.

import { useState, useEffect, useCallback } from 'react'
import { getFilteredActivity } from '../lib/dashboard/fetchers.js'

/**
 * @param {{ userId: string, type?: string }} props
 */
export function useActivity({ userId, type = 'all' }) {
  const [activity, setActivity] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    const data = await getFilteredActivity(userId, { type, limit: 100 })
    setActivity(data)
    setIsLoading(false)
  }, [userId, type])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { activity, isLoading, refresh }
}
