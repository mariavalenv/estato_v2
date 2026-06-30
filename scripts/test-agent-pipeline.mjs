/**
 * Test the global inventory enrichment pipeline.
 *
 * Usage:
 *   node scripts/test-agent-pipeline.mjs [--listings] [--flatmates]
 *
 * Default: enriches one batch of both listings and flatmates.
 *
 * Requires in .env.local:
 *   VITE_SUPABASE_URL=...
 *   VITE_SUPABASE_SERVICE_ROLE_KEY=...
 *   ANTHROPIC_API_KEY=...  (or VITE_ANTHROPIC_API_KEY)
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createClient } from '@supabase/supabase-js'
import { runInventoryEnrichment } from '../src/lib/agents/orchestrator.js'

const args = process.argv.slice(2)
const onlyListings  = args.includes('--listings')
const onlyFlatmates = args.includes('--flatmates')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function countInventory() {
  const [listings, flatmates, unenrichedL, unenrichedF] = await Promise.all([
    supabase.from('matches').select('*', { count: 'exact', head: true }).is('user_id', null).eq('type', 'listing'),
    supabase.from('matches').select('*', { count: 'exact', head: true }).is('user_id', null).eq('type', 'flatmate'),
    supabase.from('matches').select('*', { count: 'exact', head: true }).is('user_id', null).eq('type', 'listing').is('agent_reasoning', null),
    supabase.from('matches').select('*', { count: 'exact', head: true }).is('user_id', null).eq('type', 'flatmate').is('agent_reasoning', null),
  ])
  return {
    totalListings: listings.count ?? 0,
    totalFlatmates: flatmates.count ?? 0,
    unenrichedListings: unenrichedL.count ?? 0,
    unenrichedFlatmates: unenrichedF.count ?? 0,
  }
}

async function showSample() {
  const { data } = await supabase
    .from('matches')
    .select('id, type, score, match_reasons, trade_offs, agent_reasoning')
    .is('user_id', null)
    .not('agent_reasoning', 'is', null)
    .neq('agent_reasoning', '—')
    .order('score', { ascending: false })
    .limit(3)

  if (!data || data.length === 0) {
    console.log('\nNo enriched inventory yet.')
    return
  }

  console.log('\nSample enriched inventory:\n')
  for (const m of data) {
    console.log(`  [${m.type}] score=${m.score}`)
    console.log(`    reasons:   ${(m.match_reasons ?? []).join(' | ')}`)
    console.log(`    trade-offs: ${(m.trade_offs ?? []).join(' | ')}`)
    console.log(`    reasoning: ${(m.agent_reasoning ?? '').slice(0, 120)}`)
    console.log()
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('Estato Inventory Enrichment Test')
  console.log('='.repeat(60))

  const before = await countInventory()
  console.log(`\nInventory before:`)
  console.log(`  Listings:  ${before.totalListings} total, ${before.unenrichedListings} unenriched`)
  console.log(`  Flatmates: ${before.totalFlatmates} total, ${before.unenrichedFlatmates} unenriched`)
  console.log()

  const opts = {
    listings:  onlyFlatmates ? false : true,
    flatmates: onlyListings  ? false : true,
  }

  await runInventoryEnrichment(opts)

  const after = await countInventory()
  console.log(`\nInventory after:`)
  console.log(`  Listings:  unenriched ${before.unenrichedListings} → ${after.unenrichedListings}`)
  console.log(`  Flatmates: unenriched ${before.unenrichedFlatmates} → ${after.unenrichedFlatmates}`)

  await showSample()

  console.log('='.repeat(60))
  console.log('Done. Enriched inventory is available to all users.')
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
