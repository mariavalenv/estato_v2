#!/usr/bin/env node
// Assigns interested_listing_ids to each flatmate profile.
// For each flatmate, picks 3-6 random inventory listings in the same city
// whose price falls within the flatmate's budget range.

import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY =
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or service role key in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(n, arr.length))
}

async function main() {
  console.log('Loading inventory listings by city...')

  // Pre-load all inventory listings grouped by city
  const listingsByCity = {}
  for (const city of ['Madrid', 'Barcelona', 'Valencia']) {
    const all = []
    let offset = 0
    const pageSize = 1000
    while (true) {
      const { data, error } = await supabase
        .from('matches')
        .select('id, data')
        .is('user_id', null)
        .eq('type', 'listing')
        .eq('data->>city', city)
        .range(offset, offset + pageSize - 1)

      if (error) { console.error(`Fetch error (${city}):`, error.message); break }
      if (!data || data.length === 0) break
      all.push(...data)
      offset += pageSize
      if (data.length < pageSize) break
    }
    listingsByCity[city] = all
    console.log(`  ${city}: ${all.length} listings loaded`)
  }

  console.log('\nLoading flatmate profiles...')
  const allFlatmates = []
  let offset = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await supabase
      .from('matches')
      .select('id, data')
      .is('user_id', null)
      .eq('type', 'flatmate')
      .range(offset, offset + pageSize - 1)

    if (error) { console.error('Fetch error:', error.message); break }
    if (!data || data.length === 0) break
    allFlatmates.push(...data)
    offset += pageSize
    if (data.length < pageSize) break
  }
  console.log(`${allFlatmates.length} flatmates loaded.`)

  // Assign interested listings
  let updated = 0
  let skipped = 0

  for (let i = 0; i < allFlatmates.length; i++) {
    const fm = allFlatmates[i]
    const city = fm.data?.city
    if (!city || !listingsByCity[city]) { skipped++; continue }

    // Already has interested listings? Skip
    if (fm.data.interested_listing_ids?.length > 0) { skipped++; continue }

    const budgetMax = fm.data.budget_max || 2000
    const budgetMin = fm.data.budget_min || 400

    // Filter listings that overlap with flatmate's budget (with 20% flex)
    const candidates = listingsByCity[city].filter(l => {
      const price = l.data?.price ?? 0
      return price >= budgetMin * 0.8 && price <= budgetMax * 1.2
    })

    // Also prefer listings in the flatmate's preferred neighbourhoods
    const prefHoods = new Set((fm.data.preferred_neighbourhoods || []).map(h => h.toLowerCase()))
    const inHood = candidates.filter(l =>
      prefHoods.has((l.data?.neighbourhood || '').toLowerCase())
    )

    // Pick 3-6: prioritize neighbourhood matches, fill rest from budget-matched
    const count = 3 + Math.floor(Math.random() * 4) // 3-6
    let picks
    if (inHood.length >= count) {
      picks = pickN(inHood, count)
    } else {
      // Take all neighbourhood matches + fill from general candidates
      const remaining = candidates.filter(c => !inHood.some(h => h.id === c.id))
      picks = [...inHood, ...pickN(remaining, count - inHood.length)]
    }

    if (picks.length === 0) { skipped++; continue }

    const ids = picks.map(p => p.id)
    const newData = { ...fm.data, interested_listing_ids: ids }

    const { error } = await supabase
      .from('matches')
      .update({ data: newData })
      .eq('id', fm.id)

    if (error) {
      console.error(`Error updating ${fm.id}:`, error.message)
    } else {
      updated++
    }

    if ((i + 1) % 100 === 0 || i === allFlatmates.length - 1) {
      console.log(`  Processed ${i + 1} / ${allFlatmates.length} (${updated} updated, ${skipped} skipped)`)
    }
  }

  console.log(`\nDone. ${updated} flatmates assigned interested listings, ${skipped} skipped.`)
}

main().catch(console.error)
