// ─── Event tracking ───────────────────────────────────────────────────────────
// Fire-and-forget behavioural logging to the `user_events` table for future ML.
//
// Design:
//   - trackEvent(type, listingId, metadata) just enqueues — it never awaits or
//     throws, so callers can fire it from any handler without blocking the UI.
//   - Events are batched and flushed every 5s, on tab-hide, and on page-hide.
//   - The pending queue is persisted to localStorage, so a failed flush or a
//     hard close retries on the next page load (nothing is lost).
//   - Per-session de-duplication stops repeat spam (e.g. listing_view on scroll).

import { supabase } from '../supabase'

const FLUSH_INTERVAL_MS = 5000
const MIN_VIEW_SECONDS = 3       // shorter opens are treated as accidental
const BATCH_MAX = 50             // rows per insert
const MAX_QUEUE = 500            // cap so an offline session can't grow unbounded
const STORAGE_KEY = 'estato_event_queue'

let sessionId = safeUUID()
let userId = null
let userResolved = false
let pending = loadPersisted()    // events awaiting a successful insert
let flushTimer = null
const seen = new Set()           // de-dupe keys already logged this session
const openTimers = new Map()     // listingId → open timestamp (ms)

/* ── Session / user wiring ─────────────────────────────────────── */

// Let the app align the tracking session with the chat session so events and
// conversations share one id. Call once on app/chat init.
export function setSessionId(id) { if (id) sessionId = id }
export function getSessionId() { return sessionId }

// Optional: callers that already know the user can skip the lazy auth lookup.
export function setUserId(id) { userId = id; userResolved = true }

async function resolveUser() {
  if (userResolved) return userId
  try {
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch { userId = null }
  userResolved = true
  return userId
}

/* ── De-duplication ────────────────────────────────────────────── */

// Returns a key to de-dupe on, or null for events that should ALWAYS log.
// Toggle (save) and multi-part (click section, filter value) events include the
// distinguishing metadata so genuinely different actions aren't swallowed.
function dedupeKey(eventType, listingId, metadata = {}) {
  switch (eventType) {
    case 'message_sent':  return null  // every message is a distinct signal
    case 'listing_click': return `listing_click:${listingId}:${metadata.section}`
    case 'listing_save':  return `listing_save:${listingId}:${metadata.saved}`
    case 'filter_applied': return `filter_applied:${metadata.filter_key}:${metadata.filter_value}`
    default:              return listingId ? `${eventType}:${listingId}` : eventType
  }
}

/* ── Public API ────────────────────────────────────────────────── */

/**
 * Log a behavioural event. Fire-and-forget — never awaits, never throws.
 * @param {string} eventType  e.g. 'listing_view', 'filter_applied'
 * @param {string|null} listingId
 * @param {object} metadata
 */
export function trackEvent(eventType, listingId = null, metadata = {}) {
  try {
    const key = dedupeKey(eventType, listingId, metadata)
    if (key) {
      if (seen.has(key)) return
      seen.add(key)
    }
    pending.push({
      session_id: sessionId,                 // captured now in case session changes later
      event_type: eventType,
      listing_id: listingId ?? null,
      metadata: metadata ?? {},
      created_at: new Date().toISOString(),  // event time, not insert time
    })
    if (pending.length > MAX_QUEUE) pending = pending.slice(-MAX_QUEUE)
    persist()
    ensureTimer()
  } catch { /* tracking must never break the app */ }
}

/* ── Listing view timer (item 4) ───────────────────────────────── */

/** Start timing a listing view (call when the detail opens). */
export function startListingTimer(listingId) {
  if (listingId) openTimers.set(listingId, Date.now())
}

/**
 * Stop timing and log listing_view — unless the open was < 3s (accidental) or
 * this listing was already viewed this session.
 */
export function endListingTimer(listingId) {
  if (!listingId) return
  const start = openTimers.get(listingId)
  if (start == null) return
  openTimers.delete(listingId)
  const seconds = Math.round((Date.now() - start) / 1000)
  if (seconds < MIN_VIEW_SECONDS) return
  trackEvent('listing_view', listingId, { time_spent_seconds: seconds })
}

/* ── Flushing ──────────────────────────────────────────────────── */

function ensureTimer() {
  if (flushTimer || typeof window === 'undefined') return
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS)
}

/** Send pending events to Supabase. Safe to call anytime; never throws. */
export async function flush() {
  if (!pending.length) return
  const uid = await resolveUser()
  if (!uid) return  // can't satisfy RLS without a user — keep events for later

  const batch = pending.slice(0, BATCH_MAX)
  const rows = batch.map((e) => ({ user_id: uid, ...e }))
  try {
    const { error } = await supabase.from('user_events').insert(rows)
    if (error) throw error
    pending = pending.slice(batch.length)
    persist()
    if (pending.length) flush()  // drain the rest
  } catch (err) {
    console.warn('[tracking] flush failed, will retry:', err?.message)
    // leave `pending` intact; the interval / next event / next load retries it
  }
}

/* ── Persistence ───────────────────────────────────────────────── */

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pending)) } catch { /* quota */ }
}
function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

function safeUUID() {
  try { return crypto.randomUUID() } catch { return `sess-${Date.now()}-${Math.round(Math.random() * 1e9)}` }
}

/* ── Lifecycle flush hooks ─────────────────────────────────────── */

if (typeof window !== 'undefined') {
  // Tab hidden (most reliable "leaving" signal on mobile) and page unload.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', () => { flush() })
}
