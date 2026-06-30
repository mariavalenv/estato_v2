// ─── Listing Inventory Enricher ───────────────────────────────────────────────
// Processes unenriched inventory listings globally — no user ID.
// Fetches listings with agent_reasoning = null, sends them to the
// inventory-enrichment-agent skill in batches, and updates the inventory rows
// in-place. Results are shared across all users.

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
 * Enrich one batch of unenriched inventory listings.
 * Call repeatedly until it returns 0 to process all listings.
 * @returns {Promise<number>} number of listings enriched in this batch
 */
export async function enrichListingInventory() {
  console.log('[ListingEnricher] Fetching unenriched inventory batch...')
  const supabase = makeClient()

  const { data: listings, error } = await supabase
    .from('matches')
    .select('id, data, score')
    .is('user_id', null)
    .eq('type', 'listing')
    .is('agent_reasoning', null)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) {
    console.error('[ListingEnricher] Fetch error:', error.message)
    return 0
  }
  if (!listings || listings.length === 0) {
    console.log('[ListingEnricher] All listings already enriched')
    return 0
  }

  console.log(`[ListingEnricher] Enriching ${listings.length} listings...`)

  const message = `Listings to enrich:\n${JSON.stringify(
    listings.map(l => ({ listing_id: l.id, ...l.data })),
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
    console.error('[ListingEnricher] Agent call failed:', err.message)
    return 0
  }

  const enrichments = parseAllTaggedJSON(result.raw, 'listing_enrichment')
  console.log(`[ListingEnricher] ${enrichments.length} enrichments returned`)

  let updated = 0
  for (const en of enrichments) {
    if (!en.listing_id) continue

    const { error: updateErr } = await supabase
      .from('matches')
      .update({
        match_reasons: en.match_reasons ?? [],
        trade_offs: en.trade_offs ?? [],
        agent_reasoning: en.agent_reasoning ?? null,
      })
      .eq('id', en.listing_id)
      .is('user_id', null)

    if (updateErr) {
      console.error('[ListingEnricher] Update error:', updateErr.message)
    } else {
      updated++
    }
  }

  // Mark any listings Claude skipped (e.g. all fields missing) with a fallback
  // so they don't get re-queued indefinitely
  const enrichedIds = new Set(enrichments.map(e => e.listing_id))
  const skippedIds = listings.filter(l => !enrichedIds.has(l.id)).map(l => l.id)

  for (const id of skippedIds) {
    await supabase
      .from('matches')
      .update({ agent_reasoning: '—' })
      .eq('id', id)
      .is('user_id', null)
  }

  console.log(`[ListingEnricher] Updated ${updated} listings`)
  return listings.length
}
