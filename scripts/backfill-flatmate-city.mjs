#!/usr/bin/env node
// Backfill city field on existing flatmate inventory records.
// Infers city from preferred_neighbourhoods using the same mapping as the seed script.

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

// Same neighbourhood → city mapping as seed-training-data.ts
const NEIGHBOURHOOD_TO_CITY = {}
const CITY_NEIGHBOURHOODS = {
  Madrid:    ['Chamberi', 'Salamanca', 'Malasaña', 'Retiro', 'Lavapiés', 'Chueca', 'Moncloa', 'Carabanchel', 'Vallecas', 'Arganzuela'],
  Barcelona: ['Eixample', 'Gràcia', 'Poble Sec', 'Sant Pere', 'Sarrià', 'Poblenou', 'Les Corts'],
  Valencia:  ['Ruzafa', 'El Carmen', 'Benimaclet', 'Campanar', 'Extramurs'],
}

for (const [city, hoods] of Object.entries(CITY_NEIGHBOURHOODS)) {
  for (const hood of hoods) {
    NEIGHBOURHOOD_TO_CITY[hood] = city
  }
}

function inferCity(data) {
  // Check preferred_neighbourhoods
  const hoods = data.preferred_neighbourhoods ?? []
  for (const h of hoods) {
    if (NEIGHBOURHOOD_TO_CITY[h]) return NEIGHBOURHOOD_TO_CITY[h]
  }
  // Check bio for city mentions
  const bio = (data.bio ?? '').toLowerCase()
  if (bio.includes('madrid')) return 'Madrid'
  if (bio.includes('barcelona')) return 'Barcelona'
  if (bio.includes('valencia')) return 'Valencia'
  return null
}

async function main() {
  console.log('Fetching flatmate records without city...')

  // Fetch all flatmate inventory records that lack a city field
  let allFlatmates = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('matches')
      .select('id, data')
      .is('user_id', null)
      .eq('type', 'flatmate')
      .range(offset, offset + pageSize - 1)

    if (error) {
      console.error('Fetch error:', error.message)
      process.exit(1)
    }
    if (!data || data.length === 0) break

    // Only include records missing city
    const missing = data.filter(r => !r.data?.city)
    allFlatmates.push(...missing)
    offset += pageSize

    if (data.length < pageSize) break
  }

  console.log(`Found ${allFlatmates.length} flatmate records without city.`)
  if (allFlatmates.length === 0) {
    console.log('Nothing to backfill.')
    return
  }

  // Batch update
  let updated = 0
  let skipped = 0

  for (let i = 0; i < allFlatmates.length; i += 100) {
    const batch = allFlatmates.slice(i, i + 100)

    for (const record of batch) {
      const city = inferCity(record.data)
      if (!city) {
        skipped++
        continue
      }

      const newData = { ...record.data, city }
      const { error } = await supabase
        .from('matches')
        .update({ data: newData })
        .eq('id', record.id)

      if (error) {
        console.error(`Error updating ${record.id}:`, error.message)
      } else {
        updated++
      }
    }

    console.log(`  Processed ${Math.min(i + 100, allFlatmates.length)} / ${allFlatmates.length} (${updated} updated, ${skipped} skipped)`)
  }

  console.log(`\nDone. ${updated} records updated, ${skipped} skipped (could not infer city).`)
}

main().catch(console.error)
