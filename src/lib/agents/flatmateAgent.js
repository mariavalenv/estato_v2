// ─── Flatmate Inventory Enricher ──────────────────────────────────────────────
// Processes unenriched flatmate profiles globally — no user ID.
// Updates inventory rows in-place so the enrichment is shared across all users.

import { createClient } from '@supabase/supabase-js'
import { runAgent, parseAllTaggedJSON } from './runner.js'

function makeClient() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars (URL or SERVICE_ROLE_KEY)')
  return createClient(url, key, { auth: { persistSession: false } })
}

const BATCH_SIZE = 40

/**
 * Enrich one batch of unenriched flatmate profiles.
 * @returns {Promise<number>} number of profiles enriched in this batch
 */
export async function enrichFlatmateInventory() {
  console.log('[FlatmateEnricher] Fetching unenriched flatmate batch...')
  const supabase = makeClient()

  const { data: profiles, error } = await supabase
    .from('matches')
    .select('id, data')
    .is('user_id', null)
    .eq('type', 'flatmate')
    .is('agent_reasoning', null)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) {
    console.error('[FlatmateEnricher] Fetch error:', error.message)
    return 0
  }
  if (!profiles || profiles.length === 0) {
    console.log('[FlatmateEnricher] All flatmate profiles already enriched')
    return 0
  }

  console.log(`[FlatmateEnricher] Enriching ${profiles.length} profiles...`)

  const message = `Flatmate profiles to enrich:\n${JSON.stringify(
    profiles.map(p => ({ profile_id: p.id, ...p.data })),
    null,
    2
  )}`

  let result
  try {
    result = await runAgent({
      skill: 'inventory-enrichment-agent',
      userMessage: message,
      maxTokens: 4096,
    })
  } catch (err) {
    console.error('[FlatmateEnricher] Agent call failed:', err.message)
    return 0
  }

  const enrichments = parseAllTaggedJSON(result.raw, 'flatmate_enrichment')
  console.log(`[FlatmateEnricher] ${enrichments.length} enrichments returned`)

  let updated = 0
  for (const en of enrichments) {
    if (!en.profile_id) continue

    const { error: updateErr } = await supabase
      .from('matches')
      .update({
        match_reasons: en.match_reasons ?? [],
        trade_offs: en.trade_offs ?? [],
        agent_reasoning: en.agent_reasoning ?? null,
      })
      .eq('id', en.profile_id)
      .is('user_id', null)

    if (updateErr) {
      console.error('[FlatmateEnricher] Update error:', updateErr.message)
    } else {
      updated++
    }
  }

  // Mark skipped profiles so they don't loop indefinitely
  const enrichedIds = new Set(enrichments.map(e => e.profile_id))
  const skippedIds = profiles.filter(p => !enrichedIds.has(p.id)).map(p => p.id)

  for (const id of skippedIds) {
    await supabase
      .from('matches')
      .update({ agent_reasoning: '—' })
      .eq('id', id)
      .is('user_id', null)
  }

  console.log(`[FlatmateEnricher] Updated ${updated} profiles`)
  return profiles.length
}
