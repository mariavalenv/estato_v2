// ─── Dashboard Fetchers ───────────────────────────────────────────────────────
// All client-side Supabase queries for dashboard data.
// Each function returns null / [] on error rather than throwing.

import { supabase } from '../../supabase.js'
import { cacheMatchEnrichments } from '../enrichmentCache.js'

/**
 * Get the current user's agent status row.
 * @param {string} userId
 * @returns {Promise<import('../../types/dashboard').AgentStatus | null>}
 */
export async function getAgentStatus(userId) {
  const { data, error } = await supabase
    .from('agent_status')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code !== 'PGRST116') console.error('getAgentStatus:', error.message)
    return null
  }
  return data
}

/**
 * Get recent agent activity, limit 10, ordered newest first.
 * @param {string} userId
 * @returns {Promise<import('../../types/dashboard').AgentActivity[]>}
 */
export async function getRecentActivity(userId) {
  const { data, error } = await supabase
    .from('agent_activity')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('getRecentActivity:', error.message)
    return []
  }
  return data ?? []
}

/**
 * Get strong matches: pending, score >= 75, ordered by score desc, limit 10.
 * @param {string} userId
 * @returns {Promise<import('../../types/dashboard').Match[]>}
 */
export async function getStrongMatches(userId) {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gte('score', 75)
    .order('score', { ascending: false })
    .limit(10)

  if (error) {
    console.error('getStrongMatches:', error.message)
    return []
  }
  cacheMatchEnrichments(data)
  return data ?? []
}

/**
 * Get all matches regardless of status, ordered by score desc.
 * @param {string} userId
 * @returns {Promise<import('../../types/dashboard').Match[]>}
 */
export async function getAllMatches(userId) {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('user_id', userId)
    .order('score', { ascending: false })

  if (error) {
    console.error('getAllMatches:', error.message)
    return []
  }
  cacheMatchEnrichments(data)
  return data ?? []
}

/**
 * Get a single match by ID. Returns null if not found or not owned by user.
 * @param {string} matchId
 * @param {string} userId
 * @returns {Promise<import('../../types/dashboard').Match | null>}
 */
export async function getMatchById(matchId, userId) {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code !== 'PGRST116') console.error('getMatchById:', error.message)
    return null
  }
  return data
}

/**
 * Build NeedsInputItem[] from pending matches with score >= 80.
 * @param {string} userId
 * @returns {Promise<import('../../types/dashboard').NeedsInputItem[]>}
 */
export async function getNeedsInput(userId) {
  const { data, error } = await supabase
    .from('matches')
    .select('id, type, score, data, status')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gte('score', 80)
    .order('score', { ascending: false })

  if (error) {
    console.error('getNeedsInput:', error.message)
    return []
  }
  if (!data) return []

  return data.map((match) => {
    const isListing = match.type === 'listing'
    const d = match.data

    const label = isListing
      ? `Match #${match.score} — ${d.neighbourhood ?? 'Unknown'} flat`
      : `${d.name ?? 'Someone'} wants to connect`

    const sublabel = isListing
      ? 'Agent awaiting your approval'
      : 'Sent you a match request'

    return {
      id: `needs-${match.id}`,
      match_id: match.id,
      type: isListing ? 'review_match' : 'flatmate_intro',
      label,
      sublabel,
      action: isListing ? 'review' : 'view',
    }
  })
}

/**
 * Fetch a conversation by matchId for the current user.
 * Returns null if none exists yet.
 * @param {string} matchId
 * @param {string} userId
 * @returns {Promise<object | null>}
 */
export async function getConversationByMatch(matchId, userId) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('match_id', matchId)
    .or(`user_id.eq.${userId},other_user_id.eq.${userId}`)
    .single()

  if (error) {
    if (error.code !== 'PGRST116') console.error('getConversationByMatch:', error.message)
    return null
  }
  return data
}

/**
 * Fetch messages for a conversation, ordered oldest first.
 * @param {string} conversationId
 * @returns {Promise<object[]>}
 */
export async function getMessages(conversationId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('getMessages:', error.message)
    return []
  }
  return data ?? []
}

/**
 * Get match IDs the user has already actioned (approved or rejected).
 * @param {string} userId
 * @returns {Promise<Set<string>>}
 */
export async function getActionedMatchIds(userId) {
  const { data, error } = await supabase
    .from('user_match_actions')
    .select('match_id')
    .eq('user_id', userId)

  if (error) {
    console.error('getActionedMatchIds:', error.message)
    return new Set()
  }
  return new Set((data ?? []).map(r => r.match_id))
}

/**
 * Fetch inventory listings that match the user's preferences.
 * Excludes listings the user has already actioned.
 * Requires migration 004 (RLS policy allowing authenticated reads of inventory).
 *
 * @param {object} prefs  — denormalised search_preferences row
 * @param {Set<string>} actionedIds  — match IDs to exclude
 * @param {{ type?: 'listing'|'flatmate', limit?: number, minScore?: number }} opts
 * @returns {Promise<object[]>}
 */
export async function getInventoryMatches(prefs, actionedIds = new Set(), opts = {}) {
  const { type = 'listing', limit = 200, minScore = 55 } = opts

  const city = prefs.city || (prefs.cities ?? [])[0]
  if (!city) return []

  // Over-fetch to absorb exclusions, capped at 1000 to stay within Supabase limits
  const fetchLimit = Math.min(limit + actionedIds.size + 50, 1000)

  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .is('user_id', null)
    .eq('type', type)
    .eq('data->>city', city)
    .gte('score', minScore)
    .order('score', { ascending: false })
    .limit(fetchLimit)

  if (error) {
    console.error('getInventoryMatches:', error.message)
    return []
  }

  let results = (data ?? []).filter(m => !actionedIds.has(m.id))

  // Client-side budget filter for listings
  if (type === 'listing') {
    const budgetMax = prefs.budget?.max ?? prefs.budget_max
    if (budgetMax) {
      results = results.filter(m => (m.data?.price ?? 0) <= budgetMax * 1.15)
    }
  }

  const sliced = results.slice(0, limit)
  cacheMatchEnrichments(sliced)
  return sliced
}

/**
 * Fetch everything for the dashboard in parallel.
 * @param {string} userId
 * @returns {Promise<import('../../types/dashboard').DashboardData>}
 */
export async function getDashboardData(userId) {
  const [agentStatus, recentActivity, strongMatches, needsInput, allMatches] =
    await Promise.all([
      getAgentStatus(userId),
      getRecentActivity(userId),
      getStrongMatches(userId),
      getNeedsInput(userId),
      getAllMatches(userId),
    ])

  return { agentStatus, recentActivity, strongMatches, needsInput, allMatches }
}

/**
 * Get matches with optional filters and sorting.
 * @param {string} userId
 * @param {{ type?: 'listing'|'flatmate', status?: string, sort?: string }} filters
 * @returns {Promise<object[]>}
 */
export async function getFilteredMatches(userId, filters = {}) {
  let query = supabase
    .from('matches')
    .select('*')
    .eq('user_id', userId)

  if (filters.type) query = query.eq('type', filters.type)
  if (filters.status) query = query.eq('status', filters.status)

  if (filters.sort === 'price_asc') {
    // price lives inside data jsonb — sort client-side after fetch
  } else if (filters.sort === 'date') {
    query = query.order('created_at', { ascending: false })
  } else {
    // default: score descending
    query = query.order('score', { ascending: false })
  }

  const { data, error } = await query
  if (error) {
    console.error('getFilteredMatches:', error.message)
    return []
  }

  let results = data ?? []
  if (filters.sort === 'price_asc') {
    results = results.sort((a, b) => (a.data?.price ?? 0) - (b.data?.price ?? 0))
  } else if (filters.sort === 'price_desc') {
    results = results.sort((a, b) => (b.data?.price ?? 0) - (a.data?.price ?? 0))
  }

  cacheMatchEnrichments(results)
  return results
}

/**
 * Get the agent_permissions row for a user. Returns defaults if not found.
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function getAgentPermissions(userId) {
  const { data, error } = await supabase
    .from('agent_permissions')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code !== 'PGRST116') console.error('getAgentPermissions:', error.message)
    return {
      can_contact_landlords: false,
      auto_reject_below_score: 60,
      can_initiate_introductions: false,
      max_budget: null,
      max_commute_minutes: 45,
      voice_briefings_enabled: true,
      briefing_frequency: 'important_only',
    }
  }
  return data
}

/**
 * Get agent activity with optional type filter and limit.
 * @param {string} userId
 * @param {{ type?: string, limit?: number }} options
 * @returns {Promise<object[]>}
 */
export async function getFilteredActivity(userId, { type, limit = 50 } = {}) {
  let query = supabase
    .from('agent_activity')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  // Filter by action prefix convention:
  // agent actions start with capital (e.g. "Match approved", "Contacted landlord")
  // We filter client-side since there's no type column
  const { data, error } = await query
  if (error) {
    console.error('getFilteredActivity:', error.message)
    return []
  }

  const rows = data ?? []
  if (!type || type === 'all') return rows

  const matchers = {
    agent:   (r) => /reviewed|contacted|evaluated|updated|scheduled/i.test(r.action),
    user:    (r) => /approved|rejected|refinement/i.test(r.action),
    message: (r) => /message|chat/i.test(r.action),
    viewing: (r) => /viewing|scheduled/i.test(r.action),
  }
  const fn = matchers[type]
  return fn ? rows.filter(fn) : rows
}

/**
 * Get preference updates from the preference_updates table (learning log).
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
export async function getPreferenceLearningLog(userId) {
  const { data, error } = await supabase
    .from('preference_updates')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    console.error('getPreferenceLearningLog:', error.message)
    return []
  }
  return data ?? []
}

/**
 * Get all conversations for a user (both sides), most recent first.
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
export async function getAllConversations(userId) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*, match:matches(type)')
    .or(`user_id.eq.${userId},other_user_id.eq.${userId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (error) {
    console.error('getAllConversations:', error.message)
    return []
  }
  // Flatten match type onto conversation object.
  const convs = (data ?? []).map(c => ({
    ...c,
    match_type: c.match?.type ?? null,
    last_message_sender_id: null, // populated below
  }))

  // The `conversations` table stores `last_message` text but not who sent
  // it, so there is no native way to derive "unread". We enrich each row
  // with the sender of its most recent message via one batched query
  // against `messages`. Callers can then treat
  // `last_message_sender_id != currentUserId` as the unread proxy.
  const ids = convs.map(c => c.id).filter(Boolean)
  if (ids.length > 0) {
    const { data: msgs, error: msgErr } = await supabase
      .from('messages')
      .select('conversation_id, sender_id, created_at')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false })

    if (!msgErr) {
      const latestByConv = {}
      for (const m of msgs || []) {
        // First row per conversation_id wins because we ordered desc.
        if (!latestByConv[m.conversation_id]) {
          latestByConv[m.conversation_id] = m
        }
      }
      for (const c of convs) {
        const latest = latestByConv[c.id]
        if (latest) c.last_message_sender_id = latest.sender_id
      }
    }
  }

  return convs
}
