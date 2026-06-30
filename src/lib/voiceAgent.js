// ─── Voice agent client tools ─────────────────────────────────────────
// Functions exposed to the ElevenLabs Conversational AI agent as
// "client tools" — they run inside the browser with the user's existing
// Supabase session, so no service-role key or signed-URL auth is needed.
//
// The agent's job (configured in the ElevenLabs dashboard) is to:
//   1. Greet the user using the dynamic variables passed at session start
//      (no tool call required for the opening line).
//   2. Ask whether the user wants a status update or to dive into a
//      category (houses / flatmates / chats).
//   3. When the user picks a category, call `nextPending(type)` to fetch
//      one match at a time, read out price + neighbourhood + score +
//      pre-computed reasons, ask for a decision, then call `decide()`.
//   4. Loop until the user is done or runs out of pending items, then
//      offer the next category.
//   5. Only call `elaborate()` when the user asks a question the
//      pre-computed reasoning can't answer — that's the only path that
//      hits Claude, keeping the cost story honest.
//
// Each function returns a JSON-serialisable string the agent can read
// out loud directly. We always return a string (never throw) so a tool
// call failure becomes a graceful spoken error instead of a dropped
// session.

import { supabase } from '../supabase.js'
import {
  approveMatch as approveAction,
  rejectMatch as rejectAction,
} from './dashboard/actions.js'
import { db } from '../supabase.js'

// In-memory cursor — tracks which match the agent is currently reading
// in each category for this session. Cleared when the session ends.
const cursor = { listing: 0, flatmate: 0, unread_chat: 0, urgent_chat: 0 }

function resetCursors() {
  cursor.listing = 0
  cursor.flatmate = 0
  cursor.unread_chat = 0
  cursor.urgent_chat = 0
}

// In-memory drafts — keyed by conversation_id. Drafts live for the
// duration of the voice session only; they never touch the DB until
// the user explicitly says "send it" and the agent calls
// confirm_send_draft. discard_draft drops them.
const drafts = {}

// Heuristic for "this conversation needs your attention right now":
// last message was sent by the other party (unread proxy) AND it
// mentions both a time and an action verb that suggests scheduling.
// We require BOTH a time keyword AND an action keyword to keep the
// signal high — "I'm free Tuesday morning" alone isn't urgent without
// an action like "view" or "meet" attached.
const TIME_KEYWORDS = /\b(today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|this week|next week|morning|afternoon|evening|noon|\d{1,2}(:\d{2})?\s*(am|pm))\b/i
const ACTION_KEYWORDS = /\b(view|viewing|tour|visit|see the|meet|meeting|appointment|schedule|free|available|come over|stop by)\b/i

function isUrgentMessage(text) {
  if (!text) return false
  return TIME_KEYWORDS.test(text) && ACTION_KEYWORDS.test(text)
}

/**
 * True when a conversation should be treated as "unread" — i.e. the
 * most recent message in it was sent by someone other than the current
 * user. Returns false for conversations with zero messages.
 */
export function isUnreadConversation(c, currentUserId) {
  return Boolean(c?.last_message_sender_id) && c.last_message_sender_id !== currentUserId
}

/**
 * True when a conversation is unread AND the last message contains
 * scheduling language ("can we meet tomorrow at 3pm?", "want to view
 * this weekend?", etc.).
 */
export function isUrgentConversation(c, currentUserId) {
  return isUnreadConversation(c, currentUserId) && isUrgentMessage(c?.last_message || '')
}

// Friendly speakable label for the other party in a chat. We don't have
// names for landlords/flatmates yet, so we fall back to roles.
function senderLabel(c) {
  if (c?.match_type === 'flatmate') return 'A potential flatmate'
  if (c?.match_type === 'listing') return 'A landlord'
  return 'Someone'
}

// Format a number nicely for TTS — "1,360" reads better than "1360".
function formatPrice(n) {
  if (n == null) return 'unknown price'
  return `€${Number(n).toLocaleString('en-US')}`
}

// Pick the most useful 2-3 reasons + 1 trade-off for a spoken summary.
function summariseMatchForSpeech(match) {
  const d = match.data || {}
  const reasons = (match.match_reasons || []).slice(0, 3)
  const tradeoff = (match.trade_offs || [])[0]

  if (match.type === 'listing') {
    const price = formatPrice(d.price)
    const neighbourhood = d.neighbourhood || 'unknown area'
    const beds = d.bedrooms != null ? `${d.bedrooms}-bed` : ''
    const commute = d.commute_minutes != null ? `${d.commute_minutes} minute commute` : ''
    const reasonsTxt = reasons.length ? ` Highlights: ${reasons.join(', ')}.` : ''
    const tradeoffTxt = tradeoff ? ` Trade-off to watch: ${tradeoff}.` : ''
    return `${price} per month for a ${beds} flat in ${neighbourhood}. ${match.score}% match. ${commute}.${reasonsTxt}${tradeoffTxt}`
  }

  // flatmate
  const name = d.name || 'someone'
  const age = d.age || ''
  const job = d.job_title || ''
  const reasonsTxt = reasons.length ? ` Highlights: ${reasons.join(', ')}.` : ''
  const tradeoffTxt = tradeoff ? ` Trade-off: ${tradeoff}.` : ''
  return `${name}, ${age}, ${job}. ${match.score}% compatible.${reasonsTxt}${tradeoffTxt}`
}

/**
 * Build the dynamic-variable bundle passed to ElevenLabs at session start.
 * Pure function over already-loaded React state — zero API calls. The
 * agent reads these to write its opening line without any tool call.
 *
 * @param {object} ctx
 * @param {object[]} ctx.matches      displayMatches from useDashboard
 * @param {object[]} ctx.conversations  conversations array
 * @param {object[]} ctx.activity     recentActivity array
 * @param {object?} ctx.searchPrefs   searchPrefs row (or null)
 * @param {object?} ctx.agentPerms    agentPerms row (or null)
 * @param {string} ctx.userName       display name
 * @param {string} ctx.userId         supabase auth uid
 */
export function buildDynamicVariables(ctx) {
  const listings  = (ctx.matches || []).filter(m => m.type === 'listing'  && m.status === 'pending')
  const flatmates = (ctx.matches || []).filter(m => m.type === 'flatmate' && m.status === 'pending')
  const allConvs  = ctx.conversations || []
  // "Unread" = the last message was sent by the other party.
  // "Urgent" = unread AND the message looks like a scheduling request.
  const unread    = allConvs.filter(c => isUnreadConversation(c, ctx.userId))
  const urgent    = unread.filter(c => isUrgentMessage(c.last_message || ''))
  const actCount  = (ctx.activity || []).length
  const discarded = (ctx.activity || []).filter(a => /rejected|discard/i.test(a.action || '')).length
  const budget    = ctx.searchPrefs?.budget_max ?? ctx.agentPerms?.max_budget ?? null
  const commute   = ctx.agentPerms?.max_commute_minutes ?? 45

  // One-line preview of the top urgent message — used in the greeting
  // so the agent can mention "Lucía wants to view this weekend" up front.
  const topUrgent = urgent[0]
  const topUrgentSummary = topUrgent
    ? `${senderLabel(topUrgent)} — "${(topUrgent.last_message || '').slice(0, 90)}"`
    : 'none'

  return {
    user_name: ctx.userName || 'there',
    user_id: ctx.userId || '',
    pending_houses: listings.length,
    pending_flatmates: flatmates.length,
    unread_chats: unread.length,
    urgent_chats: urgent.length,
    top_urgent_summary: topUrgentSummary,
    activity_count: actCount,
    discarded_count: discarded,
    budget_max: budget != null ? `€${Number(budget).toLocaleString('en-US')}` : 'no budget set',
    commute_max: `${commute} minutes`,
    top_house_summary: listings[0]
      ? `${formatPrice(listings[0].data?.price)} in ${listings[0].data?.neighbourhood || 'unknown area'} (${listings[0].score}% match)`
      : 'none',
    top_flatmate_summary: flatmates[0]
      ? `${flatmates[0].data?.name || 'unknown'}, ${flatmates[0].score}% compatible`
      : 'none',
  }
}

/**
 * Build the client-tools object passed to Conversation.startSession.
 * Each tool function MUST return a string (or void) — it's what the
 * agent will see and reason over.
 *
 * @param {object} deps
 * @param {() => object[]} deps.getMatches         live getter for current matches
 * @param {() => object[]} deps.getConversations   live getter for conversations
 * @param {() => string} deps.getUserId            current authenticated user id
 * @param {(tabId: string, subId?: string) => void} deps.openPanel
 * @param {(text: string) => void} deps.speakBubble  mirror agent speech
 *                                                    into the UI bubble
 * @param {() => void} deps.onSessionEnd  optional cleanup
 */
export function buildClientTools({
  getMatches,
  getConversations,
  getUserId,
  openPanel,
  speakBubble,
  onSessionEnd,
}) {
  return {
    /**
     * Fetch a structured status snapshot. The agent can call this if
     * the dynamic variables go stale (e.g. after a few decisions).
     */
    get_status: async () => {
      const matches = getMatches() || []
      const listings  = matches.filter(m => m.type === 'listing'  && m.status === 'pending')
      const flatmates = matches.filter(m => m.type === 'flatmate' && m.status === 'pending')
      return JSON.stringify({
        pending_houses: listings.length,
        pending_flatmates: flatmates.length,
        cursor_listing: cursor.listing,
        cursor_flatmate: cursor.flatmate,
      })
    },

    /**
     * Open a content panel in the UI — used when the user says "show me
     * the houses panel" or similar. The agent can keep talking while
     * the panel is on screen.
     */
    open_panel: async ({ tab, sub }) => {
      if (!tab) return 'Missing tab name.'
      try {
        openPanel?.(tab, sub)
        return `Opened ${tab}${sub ? ` → ${sub}` : ''}.`
      } catch (err) {
        return `Could not open panel: ${err.message}`
      }
    },

    /**
     * Fetch the next pending match the agent should narrate. The
     * cursor is per-type and lives for the session.
     *
     * Parameters:
     *   type: 'listing' | 'flatmate'
     *
     * Returns a JSON string with { id, type, score, summary, raw }
     * or { done: true } if there's nothing left.
     */
    next_pending: async ({ type }) => {
      if (type !== 'listing' && type !== 'flatmate') {
        return JSON.stringify({ error: 'type must be "listing" or "flatmate"' })
      }
      const matches = getMatches() || []
      const queue = matches.filter(m => m.type === type && m.status === 'pending')
      const idx = cursor[type]
      if (idx >= queue.length) {
        return JSON.stringify({ done: true, count: queue.length })
      }
      const m = queue[idx]
      cursor[type] = idx + 1
      const summary = summariseMatchForSpeech(m)
      // Mirror the spoken summary into the UI bubble so the user can
      // read along even with audio muted.
      speakBubble?.(summary)
      return JSON.stringify({
        id: m.id,
        type: m.type,
        score: m.score,
        summary,
        // Include raw fields the agent might pick up on if asked.
        price: m.data?.price ?? null,
        neighbourhood: m.data?.neighbourhood ?? null,
        bedrooms: m.data?.bedrooms ?? null,
        commute_minutes: m.data?.commute_minutes ?? null,
        match_reasons: m.match_reasons ?? [],
        trade_offs: m.trade_offs ?? [],
      })
    },

    /**
     * Record a decision on a match the user just heard about.
     * Parameters:
     *   match_id: string
     *   action: 'keep' | 'pass' | 'save'
     *
     * 'save' is an alias for 'keep' that also writes to favourites,
     * mirroring the behaviour of swiping right in the UI.
     */
    decide: async ({ match_id, action }) => {
      if (!match_id || !action) {
        return JSON.stringify({ error: 'match_id and action are required' })
      }
      try {
        if (action === 'pass') {
          const r = await rejectAction(match_id)
          if (!r.success) return JSON.stringify({ error: r.error })
          return JSON.stringify({ ok: true, action: 'rejected' })
        }
        // keep / save → approve, and on save also persist to favourites
        const r = await approveAction(match_id)
        if (!r.success) return JSON.stringify({ error: r.error })

        if (action === 'save') {
          const matches = getMatches() || []
          const m = matches.find(mm => mm.id === match_id)
          if (m) {
            try {
              const { data: { user } } = await supabase.auth.getUser()
              if (user) {
                await db.addFavourite(user.id, { id: m.id, ...(m.data || {}) }).catch(() => {})
              }
            } catch { /* non-fatal */ }
          }
        }
        return JSON.stringify({ ok: true, action: action === 'save' ? 'approved+saved' : 'approved' })
      } catch (err) {
        return JSON.stringify({ error: err.message })
      }
    },

    /**
     * Ask Claude for deeper context on a specific match. This is the
     * ONLY tool that hits the LLM — invoked only when the user pushes
     * past the pre-computed reasoning ("why is the commute so long?",
     * "what's the lift situation?", etc.).
     */
    elaborate: async ({ match_id, question }) => {
      if (!match_id || !question) {
        return JSON.stringify({ error: 'match_id and question are required' })
      }
      const matches = getMatches() || []
      const m = matches.find(mm => mm.id === match_id)
      if (!m) return JSON.stringify({ error: 'match not found' })

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 220,
            system:
              'You are answering a follow-up question about a single property/flatmate match. ' +
              'Be concise, factual, and conversational — your answer is going to be spoken out loud, ' +
              'so avoid lists, markdown, or anything that does not read naturally. ' +
              'Use the JSON below as your only source of truth and say "I do not have that detail" ' +
              'if the answer is not present in the data.\n\n' +
              `MATCH:\n${JSON.stringify({
                type: m.type,
                score: m.score,
                data: m.data,
                reasons: m.match_reasons,
                trade_offs: m.trade_offs,
                agent_reasoning: m.agent_reasoning,
              })}`,
            messages: [{ role: 'user', content: question }],
          }),
        })
        const data = await res.json()
        const text = data?.content?.[0]?.text?.trim() || 'I could not find that detail.'
        speakBubble?.(text)
        return JSON.stringify({ answer: text })
      } catch (err) {
        return JSON.stringify({ error: err.message })
      }
    },

    /**
     * Walk through the user's unread chats one at a time.
     *
     * Parameters:
     *   priority: 'all' | 'urgent'  (defaults to 'all')
     *
     * 'urgent' is the high-priority filter — chats where the other
     * party's last message looks like a scheduling request (mentions
     * a time + an action like "view" or "meet"). Use this when the
     * user says things like "anything urgent?", "any viewings to
     * confirm?", or "anything time-sensitive?".
     *
     * Returns one conversation summary at a time and advances the
     * per-priority cursor. Returns { done: true } when exhausted.
     */
    next_unread_chat: async ({ priority = 'all' } = {}) => {
      const userId = getUserId?.() || null
      const allConvs = (getConversations?.() || [])
      const queue = priority === 'urgent'
        ? allConvs.filter(c => isUrgentConversation(c, userId))
        : allConvs.filter(c => isUnreadConversation(c, userId))

      const cursorKey = priority === 'urgent' ? 'urgent_chat' : 'unread_chat'
      const idx = cursor[cursorKey]
      if (idx >= queue.length) {
        return JSON.stringify({ done: true, count: queue.length, priority })
      }
      const c = queue[idx]
      cursor[cursorKey] = idx + 1

      const sender = senderLabel(c)
      const preview = (c.last_message || '').trim() || 'no preview available'
      const summary = `${sender}: ${preview}`
      speakBubble?.(summary)

      return JSON.stringify({
        conversation_id: c.id,
        match_type: c.match_type,
        sender_label: sender,
        preview,
        is_urgent: isUrgentMessage(c.last_message || ''),
        last_message_at: c.last_message_at,
        // Tell the agent if there's already a draft pending review.
        has_draft: Boolean(drafts[c.id]),
        summary,
      })
    },

    /**
     * Save a draft reply for a conversation. The draft lives in memory
     * for the duration of this voice session and is NOT sent until the
     * user explicitly confirms with confirm_send_draft. The agent
     * should always call read_draft after drafting so the user hears
     * exactly what will be sent.
     */
    draft_reply: async ({ conversation_id, text }) => {
      if (!conversation_id || !text) {
        return JSON.stringify({ error: 'conversation_id and text are required' })
      }
      drafts[conversation_id] = { text, created_at: new Date().toISOString() }
      return JSON.stringify({ ok: true, conversation_id, draft: text })
    },

    /**
     * Read the current draft for a conversation back to the user. The
     * agent calls this after draft_reply (or when the user says
     * "what was the draft again?") so the user can verify the wording
     * before approving the send.
     */
    read_draft: async ({ conversation_id }) => {
      if (!conversation_id) return JSON.stringify({ error: 'conversation_id required' })
      const d = drafts[conversation_id]
      if (!d) return JSON.stringify({ error: 'no draft for this conversation' })
      speakBubble?.(`Draft: ${d.text}`)
      return JSON.stringify({ draft: d.text, created_at: d.created_at })
    },

    /**
     * Send the saved draft. This is the ONLY place that actually writes
     * to the messages table. Drops the in-memory draft on success.
     * The agent must only call this after the user has heard the draft
     * (via read_draft) AND given explicit confirmation like "yes, send
     * it" or "looks good, send".
     */
    confirm_send_draft: async ({ conversation_id }) => {
      if (!conversation_id) return JSON.stringify({ error: 'conversation_id required' })
      const d = drafts[conversation_id]
      if (!d) return JSON.stringify({ error: 'no draft to send' })

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return JSON.stringify({ error: 'not authenticated' })

        const { error: msgErr } = await supabase
          .from('messages')
          .insert({
            conversation_id,
            sender_id: user.id,
            content: d.text,
          })
        if (msgErr) return JSON.stringify({ error: msgErr.message })

        // Best-effort: keep the conversation row's preview + timestamp
        // in sync so the chats panel shows the new message immediately.
        await supabase
          .from('conversations')
          .update({
            last_message: d.text,
            last_message_at: new Date().toISOString(),
          })
          .eq('id', conversation_id)

        delete drafts[conversation_id]
        return JSON.stringify({ ok: true, sent: d.text })
      } catch (err) {
        return JSON.stringify({ error: err.message })
      }
    },

    /**
     * Discard the saved draft. The agent calls this when the user says
     * "no, don't send" or "scrap it, let me think". Removes the draft
     * from memory; nothing is written to the DB.
     */
    discard_draft: async ({ conversation_id }) => {
      if (!conversation_id) return JSON.stringify({ error: 'conversation_id required' })
      delete drafts[conversation_id]
      return JSON.stringify({ ok: true })
    },

    /**
     * Reset the per-type cursors. The agent calls this when the user
     * says "start over" or jumps between categories and wants to revisit
     * earlier items.
     */
    reset_cursor: async ({ type }) => {
      if (type === 'listing' || type === 'flatmate' || type === 'unread_chat' || type === 'urgent_chat') {
        cursor[type] = 0
      } else {
        resetCursors()
      }
      return JSON.stringify({ ok: true })
    },

    /**
     * Politely close the session. The agent calls this when the user
     * says goodbye / wants to end the conversation.
     */
    end_session: async () => {
      onSessionEnd?.()
      return 'Session ending.'
    },
  }
}
