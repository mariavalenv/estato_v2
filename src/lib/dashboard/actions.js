// ─── Dashboard Actions ────────────────────────────────────────────────────────
// Client-side Supabase mutations. Each validates auth before touching the DB
// and returns a typed result object — never throws.

import { supabase } from '../../supabase.js'

/**
 * Assert the current session user matches userId. Returns userId or throws.
 * @returns {Promise<string>} authenticated user id
 */
async function assertAuth() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Not authenticated')
  return user.id
}

/**
 * Approve an inventory listing — records a user-specific action without
 * mutating the shared inventory row.
 * @param {string} matchId
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function approveMatch(matchId) {
  try {
    const userId = await assertAuth()

    const { error } = await supabase
      .from('user_match_actions')
      .upsert(
        { user_id: userId, match_id: matchId, action: 'approved' },
        { onConflict: 'user_id,match_id' }
      )

    if (error) return { success: false, error: error.message }

    await logAgentActivity(userId, 'Match approved', `match_id:${matchId}`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Reject an inventory listing — records a user-specific action without
 * mutating the shared inventory row.
 * @param {string} matchId
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function rejectMatch(matchId) {
  try {
    const userId = await assertAuth()

    const { error } = await supabase
      .from('user_match_actions')
      .upsert(
        { user_id: userId, match_id: matchId, action: 'rejected' },
        { onConflict: 'user_id,match_id' }
      )

    if (error) return { success: false, error: error.message }

    await logAgentActivity(userId, 'Match rejected', `match_id:${matchId}`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Ask agent to refine — reject the match and log the note.
 * @param {string} matchId
 * @param {string} note
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function requestRefinement(matchId, note) {
  try {
    const userId = await assertAuth()

    const { error } = await supabase
      .from('user_match_actions')
      .upsert(
        { user_id: userId, match_id: matchId, action: 'rejected', note },
        { onConflict: 'user_id,match_id' }
      )

    if (error) return { success: false, error: error.message }

    await logAgentActivity(userId, 'Refinement requested', note)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Initialise agent_status for a new user if it doesn't exist yet.
 * @param {string} userId
 * @returns {Promise<{ success: boolean }>}
 */
export async function initAgentStatus(userId) {
  try {
    // upsert so calling multiple times is safe
    const { error } = await supabase
      .from('agent_status')
      .upsert(
        {
          user_id: userId,
          is_active: true,
          current_task: 'Reviewing options',
          options_reviewed: 0,
          strong_matches_found: 0,
          confidence: 'Medium',
          next_update_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id', ignoreDuplicates: true }
      )

    if (error) {
      console.error('initAgentStatus:', error.message)
      return { success: false }
    }
    return { success: true }
  } catch (err) {
    console.error('initAgentStatus:', err.message)
    return { success: false }
  }
}

/**
 * Log a custom agent activity entry.
 * @param {string} userId
 * @param {string} action
 * @param {string | undefined} detail
 * @returns {Promise<void>}
 */
export async function logAgentActivity(userId, action, detail) {
  const { error } = await supabase.from('agent_activity').insert({
    user_id: userId,
    action,
    detail: detail ?? null,
  })
  if (error) console.error('logAgentActivity:', error.message)
}

/**
 * Send a message in a conversation. Creates the conversation row if needed.
 * @param {string} conversationId
 * @param {string} senderId
 * @param {string} content
 * @returns {Promise<{ success: boolean, message?: object, error?: string }>}
 */
export async function sendMessage(conversationId, senderId, content) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: senderId, content })
      .select()
      .single()

    if (error) return { success: false, error: error.message }

    // Update last_message on conversation
    await supabase
      .from('conversations')
      .update({ last_message: content, last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    return { success: true, message: data }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Upsert agent_permissions for a user.
 * @param {string} userId
 * @param {object} permissions
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function saveAgentPermissions(userId, permissions) {
  try {
    const { error } = await supabase
      .from('agent_permissions')
      .upsert(
        { user_id: userId, ...permissions, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Reject a match and record the specific reasons. Triggers async pattern detection.
 * @param {string} matchId
 * @param {string[]} reasons
 * @param {string | undefined} freeText
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function rejectMatchWithReasons(matchId, reasons, freeText) {
  try {
    const userId = await assertAuth()

    // Get match type from inventory (user_id IS NULL) or user-owned row
    const { data: match, error: fetchError } = await supabase
      .from('matches')
      .select('type')
      .eq('id', matchId)
      .single()

    if (fetchError || !match) return { success: false, error: 'Match not found' }

    // Record rejection action against the shared inventory row
    const { error: actionError } = await supabase
      .from('user_match_actions')
      .upsert(
        { user_id: userId, match_id: matchId, action: 'rejected' },
        { onConflict: 'user_id,match_id' }
      )

    if (actionError) return { success: false, error: actionError.message }

    // Save rejection reasons
    const { error: reasonError } = await supabase
      .from('rejection_reasons')
      .insert({
        user_id: userId,
        match_id: matchId,
        match_type: match.type,
        reasons,
        free_text: freeText ?? null,
      })

    if (reasonError) return { success: false, error: reasonError.message }

    await logAgentActivity(
      userId,
      'Match rejected',
      `${match.type} match rejected. Reasons: ${reasons.join(', ')}`
    )

    // Trigger pattern detection in the background — do not await
    import('../../lib/learning/patternDetection.js')
      .then(({ detectAndApplyPatterns }) => detectAndApplyPatterns(userId))
      .catch(console.error)

    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Accept a pending preference update — mark as accepted and apply to profile.
 * @param {string} updateId
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function acceptPreferenceUpdate(updateId) {
  try {
    const userId = await assertAuth()

    const { data: update, error: fetchError } = await supabase
      .from('preference_updates')
      .select('*')
      .eq('id', updateId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !update) return { success: false, error: 'Update not found' }

    const { error } = await supabase
      .from('preference_updates')
      .update({ accepted_by_user: true })
      .eq('id', updateId)

    if (error) return { success: false, error: error.message }

    // Apply update to learned_overrides
    await import('../../lib/learning/patternDetection.js')
      .then(({ applyLearnedOverride }) => applyLearnedOverride(userId, update))
      .catch(console.error)

    await logAgentActivity(userId, 'preference_update accepted', update.agent_explanation)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Dismiss a pending preference update — mark accepted_by_user as false (no-op on profile).
 * @param {string} updateId
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function dismissPreferenceUpdate(updateId) {
  try {
    const userId = await assertAuth()

    const { error } = await supabase
      .from('preference_updates')
      .update({ accepted_by_user: false })
      .eq('id', updateId)
      .eq('user_id', userId)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Find or create a conversation for a given match.
 * @param {string} matchId
 * @param {string} userId
 * @param {string | null} otherUserId
 * @returns {Promise<{ success: boolean, conversation?: object, error?: string }>}
 */
export async function findOrCreateConversation(matchId, userId, otherUserId = null) {
  try {
    // Try to find existing
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .eq('match_id', matchId)
      .or(`user_id.eq.${userId},other_user_id.eq.${userId}`)
      .single()

    if (existing) return { success: true, conversation: existing }

    // Create new
    const { data, error } = await supabase
      .from('conversations')
      .insert({ match_id: matchId, user_id: userId, other_user_id: otherUserId })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, conversation: data }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
