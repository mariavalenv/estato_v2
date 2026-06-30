// Vercel serverless function — triggers a global inventory enrichment pass.
// No userId required. Responds 202 immediately; enrichment runs async.
import { config } from 'dotenv'
config({ path: '.env.local' })

import { runInventoryEnrichment } from '../../src/lib/agents/orchestrator.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { listings = true, flatmates = true } = req.body ?? {}

  runInventoryEnrichment({ listings, flatmates }).catch(err =>
    console.error('[api/agents/run] Enrichment error:', err.message)
  )

  return res.status(202).json({ message: 'Inventory enrichment started' })
}
