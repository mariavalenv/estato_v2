// ─── Pattern Detection ─────────────────────────────────────────────────────────
// Reads rejection history from Supabase, detects repeating patterns, calls the
// learning agent API for each pattern, and writes preference_updates back to DB.
// Runs client-side so it can use the authenticated Supabase session directly.

import { supabase } from '../../supabase.js'

const PATTERN_THRESHOLDS = {
  low: 2,    // 2 rejections for same reason → low confidence
  medium: 3, // 3 rejections → medium confidence
  high: 5,   // 5 rejections → high confidence (auto-apply)
}

// Maps rejection reason codes to profile fields and suggested update shapes
const REASON_TO_FIELD = {
  no_balcony: {
    field: 'must_haves',
    suggested_update: { add: 'balcony' },
  },
  too_far_from_commute: {
    field: 'commute_anchor',
    suggested_update: { tighten_max_minutes: true },
  },
  ground_floor: {
    field: 'deal_breakers',
    suggested_update: { add: 'ground_floor' },
  },
  no_natural_light: {
    field: 'must_haves',
    suggested_update: { add: 'natural_light' },
  },
  too_small: {
    field: 'must_haves',
    suggested_update: { add: 'minimum_size' },
  },
  no_lift: {
    field: 'must_haves',
    suggested_update: { add: 'lift' },
  },
  too_noisy: {
    field: 'deal_breakers',
    suggested_update: { add: 'busy_street' },
  },
  too_expensive: {
    field: 'budget',
    suggested_update: { lower_max: true },
  },
  wrong_location: {
    field: 'neighbourhoods',
    suggested_update: { review_preferences: true },
  },
  incompatible_schedule: {
    field: 'flatmate_preferences',
    suggested_update: { tighten_schedule_match: true },
  },
  incompatible_cleanliness: {
    field: 'flatmate_preferences',
    suggested_update: { tighten_cleanliness_match: true },
  },
}

function extractPatterns(rejections) {
  const reasonCounts = new Map()

  for (const rejection of rejections) {
    for (const reason of rejection.reasons) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)
    }
  }

  const patterns = []

  for (const [reason, count] of reasonCounts) {
    if (count < PATTERN_THRESHOLDS.low) continue

    const mapping = REASON_TO_FIELD[reason]
    if (!mapping) continue

    const confidence =
      count >= PATTERN_THRESHOLDS.high ? 'high' :
      count >= PATTERN_THRESHOLDS.medium ? 'medium' : 'low'

    patterns.push({
      field: mapping.field,
      pattern: reason,
      occurrences: count,
      confidence,
      suggested_update: mapping.suggested_update,
    })
  }

  return patterns
}

export async function detectAndApplyPatterns(userId) {
  // Fetch last 30 rejections
  const { data: rejections } = await supabase
    .from('rejection_reasons')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30)

  if (!rejections || rejections.length < 2) return

  const patterns = extractPatterns(rejections)
  if (patterns.length === 0) return

  // Fetch current profile to pass to the learning agent
  const { data: profile } = await supabase
    .from('search_preferences')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  for (const pattern of patterns) {
    // Skip if we already applied an update for this field in the last 7 days
    const { data: existing } = await supabase
      .from('preference_updates')
      .select('id')
      .eq('user_id', userId)
      .eq('field_updated', pattern.field)
      .gte(
        'created_at',
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      )
      .limit(1)

    if (existing && existing.length > 0) continue

    // Call the learning agent API (Anthropic call lives server-side)
    let update = null
    try {
      const res = await fetch('/api/learning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, pattern, rejections: rejections.slice(0, 10), profile }),
      })
      if (res.ok) {
        const json = await res.json()
        update = json.update
      }
    } catch (err) {
      console.error('Learning agent call failed:', err)
      continue
    }

    if (!update) continue

    // Save the preference_update row
    const autoAccepted = update.confidence === 'high'
    const { error: insertError } = await supabase.from('preference_updates').insert({
      user_id: userId,
      field_updated: update.field_updated,
      previous_value: update.previous_value ?? null,
      new_value: update.new_value ?? null,
      derived_from_rejections: update.derived_from_rejections ?? [],
      confidence: update.confidence,
      accepted_by_user: autoAccepted,
      agent_explanation: update.agent_explanation,
    })

    if (insertError) {
      console.error('Failed to save preference_update:', insertError.message)
      continue
    }

    // High confidence → apply to learned_overrides immediately
    if (autoAccepted) {
      await applyLearnedOverride(userId, update)

      const { logAgentActivity } = await import('../dashboard/actions.js')
      await logAgentActivity(userId, 'preference_update', update.agent_explanation)
    }
  }
}

/**
 * Merge a single preference update into search_preferences.learned_overrides.
 * @param {string} userId
 * @param {{ field_updated: string, new_value: unknown }} update
 */
export async function applyLearnedOverride(userId, update) {
  // Read existing overrides first
  const { data: row } = await supabase
    .from('search_preferences')
    .select('learned_overrides')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const current = row?.learned_overrides ?? {}
  const merged = {
    ...current,
    [update.field_updated]: update.new_value,
  }

  await supabase
    .from('search_preferences')
    .update({ learned_overrides: merged, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
}
