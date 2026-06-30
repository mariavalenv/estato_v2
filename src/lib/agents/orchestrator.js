// ─── Global Inventory Enrichment Orchestrator ────────────────────────────────
// Processes unenriched inventory listings and flatmate profiles.
// Runs globally — not per-user. Each enrichment is stored once and served
// to all users who match the inventory item's city/price range.

import { enrichListingInventory } from './listingAgent.js'
import { enrichFlatmateInventory } from './flatmateAgent.js'

/**
 * Enrich a batch of unenriched inventory items.
 * Safe to call on a schedule or on-demand. Processes one batch per type
 * per invocation to keep response times short.
 *
 * @param {{ listings?: boolean, flatmates?: boolean }} options
 */
export async function runInventoryEnrichment({ listings = true, flatmates = true } = {}) {
  console.log('\n[Orchestrator] Starting inventory enrichment run')

  const results = { listingsEnriched: 0, flatmatesEnriched: 0 }

  if (listings) {
    results.listingsEnriched = await enrichListingInventory()
  }

  if (flatmates) {
    results.flatmatesEnriched = await enrichFlatmateInventory()
  }

  console.log(
    `[Orchestrator] Run complete — listings: ${results.listingsEnriched}, flatmates: ${results.flatmatesEnriched}\n`
  )

  return results
}
