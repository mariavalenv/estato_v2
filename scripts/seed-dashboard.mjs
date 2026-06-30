/**
 * Seed script — inserts realistic dashboard test data for a single user.
 *
 * Usage:
 *   node scripts/seed-dashboard.mjs <user_id>
 *
 * Requires in .env.local:
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *
 * Uses service role key to bypass RLS.
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const userId = process.argv[2]
if (!userId) {
  console.error('Usage: node scripts/seed-dashboard.mjs <user_id>')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── Seed Data ────────────────────────────────────────────────────────────────

const agentStatusRow = {
  user_id: userId,
  is_active: true,
  current_task: 'Reviewing 14 options',
  options_reviewed: 14,
  strong_matches_found: 2,
  confidence: 'High',
  next_update_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  updated_at: new Date().toISOString(),
}

const activityRows = [
  { user_id: userId, action: 'Contacted 3 listings', detail: null },
  { user_id: userId, action: 'Evaluated 21 flatmate profiles', detail: null },
  { user_id: userId, action: 'Discarded 5 options', detail: 'Over budget or too far from commute anchor' },
  { user_id: userId, action: 'Identified 2 strong matches', detail: null },
  { user_id: userId, action: 'Updated confidence to High', detail: 'Based on budget fit and commute proximity' },
]

const listingMatches = [
  {
    user_id: userId,
    type: 'listing',
    score: 92,
    status: 'pending',
    data: {
      address: 'Calle Luchana 18, 3°B',
      neighbourhood: 'Chamberi',
      city: 'Madrid',
      price: 1150,
      bedrooms: 2,
      bathrooms: 1,
      size_sqm: 72,
      commute_minutes: 14,
      furnished: true,
      images: [
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&q=80', // bright living room with wooden floors
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80',   // modern white kitchen
        'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=600&q=80',    // sunny bedroom
        'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=600&q=80',    // tiled bathroom
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&q=80',    // apartment building facade
      ],
      available_from: '2026-05-01',
    },
    match_reasons: [
      'Within your €900–€1,200 budget',
      'Quiet residential street in Chamberi',
      'Only 14 minutes from Alonso Martínez metro',
    ],
    trade_offs: ['4th floor, no lift', 'Interior courtyard views'],
    agent_reasoning:
      'This is the strongest budget+commute fit I\'ve found. Chamberi is quieter than Malasaña but still walkable to most of the city.',
  },
  {
    user_id: userId,
    type: 'listing',
    score: 87,
    status: 'pending',
    data: {
      address: 'Calle del Pez 14, 2°A',
      neighbourhood: 'Malasaña',
      city: 'Madrid',
      price: 1100,
      bedrooms: 2,
      bathrooms: 1,
      size_sqm: 68,
      commute_minutes: 18,
      furnished: false,
      images: [
        'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=600&q=80', // open-plan apartment with character
        'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=600&q=80',   // kitchen with wooden counters
        'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600&q=80', // unfurnished bedroom with light
        'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=600&q=80', // Mediterranean apartment building
      ],
      available_from: '2026-04-15',
    },
    match_reasons: [
      'Slightly under your maximum budget',
      'Vibrant neighbourhood matching your lifestyle',
      'Callao metro nearby',
    ],
    trade_offs: ['Unfurnished — you\'ll need to budget for furniture', 'Shared courtyard can be noisy on weekends'],
    agent_reasoning:
      'Great value in one of the most sought-after areas. Slightly longer commute than Chamberi but worth considering.',
  },
  {
    user_id: userId,
    type: 'listing',
    score: 76,
    status: 'pending',
    data: {
      address: 'Calle de Ibiza 31, 1°C',
      neighbourhood: 'Retiro',
      city: 'Madrid',
      price: 1380,
      bedrooms: 2,
      bathrooms: 2,
      size_sqm: 85,
      commute_minutes: 22,
      furnished: true,
      images: [
        'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=600&q=80', // sleek modern renovated living room
        'https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=600&q=80', // contemporary fitted kitchen
        'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=600&q=80', // spacious master bedroom
        'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&q=80', // second bedroom with natural light
        'https://images.unsplash.com/photo-1604709177225-055f99402ea3?w=600&q=80', // modern bathroom
        'https://images.unsplash.com/photo-1600607687644-aac4c3eac7f4?w=600&q=80', // balcony with park views
      ],
      available_from: '2026-05-15',
    },
    match_reasons: [
      'Extra bathroom — great for a flatmate',
      'Larger than average for the price',
      'Direct access to Retiro park',
    ],
    trade_offs: ['€180 above your stated maximum', 'Longer commute at 22 minutes'],
    agent_reasoning:
      'This is a stretch on budget but offers meaningfully more space. Worth a look if you\'re open to flexing slightly.',
  },
]

const flatmateMatches = [
  {
    user_id: userId,
    type: 'flatmate',
    score: 89,
    status: 'pending',
    data: {
      name: 'Lucía M.',
      age: 27,
      job_title: 'UX Designer',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80',
      lifestyle_tags: ['Early riser', 'Clean & tidy', 'WFH most days', 'Professional'],
      bio: 'Freelance UX designer working remotely. I value a calm, clean home and like to keep to myself in the evenings. Big coffee person.',
    },
    match_reasons: [
      'Both hybrid remote workers — compatible schedules',
      'Rated 4.9/5 for cleanliness by previous flatmates',
      'Looking in Malasaña and Chamberi — same as you',
    ],
    trade_offs: ['Has a cat — check if you\'re OK with pets', 'Prefers quiet evenings, no frequent guests'],
    agent_reasoning:
      'Lucía is the strongest flatmate match I\'ve found. Her routine aligns closely with yours and cleanliness is a known priority for you. She\'s had interest from 3 others this week.',
  },
  {
    user_id: userId,
    type: 'flatmate',
    score: 81,
    status: 'pending',
    data: {
      name: 'Diego R.',
      age: 31,
      job_title: 'Software Engineer',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80',
      lifestyle_tags: ['Night owl', 'Tidy', 'Gym-goer', 'Non-smoker'],
      bio: 'Engineer at a fintech startup. Work long hours but keep the flat tidy. Into football and cooking on weekends.',
    },
    match_reasons: [
      'Tech professional — similar lifestyle expectations',
      'Explicitly looking for a non-smoker',
      'Budget range overlaps exactly',
    ],
    trade_offs: ['Works late — could affect shared morning routines', 'Has strong opinions on kitchen tidiness'],
    agent_reasoning:
      'Diego scores slightly lower than Lucía mainly on schedule compatibility, but his budget flexibility and lifestyle values are a solid match.',
  },
]

// ── Run ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n🌱  Seeding dashboard for user: ${userId}\n`)

  // 1. Agent status (upsert)
  console.log('  → agent_status')
  const { error: statusErr } = await supabase
    .from('agent_status')
    .upsert(agentStatusRow, { onConflict: 'user_id' })
  if (statusErr) console.error('    ❌', statusErr.message)
  else console.log('    ✓ agent_status upserted')

  // 2. Activity rows
  console.log('  → agent_activity')
  const { error: actErr } = await supabase.from('agent_activity').insert(activityRows)
  if (actErr) console.error('    ❌', actErr.message)
  else console.log(`    ✓ ${activityRows.length} activity rows inserted`)

  // 3. Listing matches
  console.log('  → matches (listings)')
  const { data: insertedListings, error: listErr } = await supabase
    .from('matches')
    .insert(listingMatches)
    .select('id, score')
  if (listErr) console.error('    ❌', listErr.message)
  else console.log(`    ✓ ${insertedListings.length} listing matches inserted`)

  // 4. Flatmate matches
  console.log('  → matches (flatmates)')
  const { data: insertedFlatmates, error: flatErr } = await supabase
    .from('matches')
    .insert(flatmateMatches)
    .select('id, score')
  if (flatErr) console.error('    ❌', flatErr.message)
  else console.log(`    ✓ ${insertedFlatmates.length} flatmate matches inserted`)

  console.log('\n✅  Seed complete. Visit /dashboard to verify.\n')
}

run().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
