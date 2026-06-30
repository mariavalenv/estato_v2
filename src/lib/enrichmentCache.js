// ─── Enrichment Cache ─────────────────────────────────────────────────────────
// In-memory + sessionStorage cache for agent-generated text keyed by match ID.
// Prevents redundant API calls when the same listing/flatmate detail is viewed
// multiple times in a session.

const SESSION_KEY = 'estato_enrichment_cache'
const mem = new Map()

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      for (const [k, v] of Object.entries(parsed)) {
        if (!mem.has(k)) mem.set(k, v)
      }
    }
  } catch { /* ignore */ }
}

function persistSession() {
  try {
    const obj = Object.fromEntries(mem)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(obj))
  } catch { /* quota exceeded — fine, in-memory still works */ }
}

// Initialise from sessionStorage on load
if (typeof sessionStorage !== 'undefined') loadSession()

/**
 * Get cached enrichment for a match ID.
 * @param {string} matchId
 * @returns {{ agent_reasoning: string, match_reasons: string[], trade_offs: string[] } | null}
 */
export function getCachedEnrichment(matchId) {
  return mem.get(matchId) ?? null
}

/**
 * Cache enrichment data for a match ID.
 * @param {string} matchId
 * @param {{ agent_reasoning?: string, match_reasons?: string[], trade_offs?: string[] }} data
 */
export function setCachedEnrichment(matchId, data) {
  if (!matchId || !data) return
  mem.set(matchId, {
    agent_reasoning: data.agent_reasoning ?? '',
    match_reasons: data.match_reasons ?? [],
    trade_offs: data.trade_offs ?? [],
  })
  persistSession()
}

/**
 * Bulk-cache enrichments from a list of match objects.
 * Call this when matches are fetched from Supabase to pre-populate the cache.
 * @param {Array<{ id: string, agent_reasoning?: string, match_reasons?: string[], trade_offs?: string[] }>} matches
 */
export function cacheMatchEnrichments(matches) {
  if (!matches?.length) return
  for (const m of matches) {
    if (m.id && m.agent_reasoning) {
      setCachedEnrichment(m.id, m)
    }
  }
}

/**
 * Check if enrichment exists for a given ID.
 * @param {string} matchId
 * @returns {boolean}
 */
export function hasEnrichment(matchId) {
  return mem.has(matchId)
}
