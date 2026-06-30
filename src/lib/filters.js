// ─── Listing filters ──────────────────────────────────────────────────────────
// Canonical active-filter shape (all keys optional):
//   { budget, city, neighbourhood, property_type, bedrooms,
//     furnished, pet_friendly, bills_included, min_floor, orientation, near_metro }
//
// `budget` is a MAX monthly price. Filters are cumulative — new filters merge
// into the active set, they don't replace it.

import { supabase } from '../supabase'
import { DUMMY_LISTINGS } from '../data/dummyListings'

// Cities we recognise so "in Madrid" → city while "in Malasaña" → neighbourhood.
const KNOWN_CITIES = ['madrid', 'barcelona', 'london', 'valencia', 'seville', 'lisbon', 'porto', 'berlin', 'paris']

// How each canonical filter key maps onto a Supabase `listings` query.
// Adjust here (and the migration 007 columns) if your real table differs.
const FILTER_COLUMN_MAP = {
  budget:         (q, v) => q.lte('price', v),
  city:           (q, v) => q.ilike('city', `%${v}%`),
  neighbourhood:  (q, v) => q.ilike('neighbourhood', `%${v}%`),
  property_type:  (q, v) => q.eq('property_type', v),
  bedrooms:       (q, v) => q.gte('bedrooms', v),
  furnished:      (q, v) => q.eq('furnished', v),
  pet_friendly:   (q, v) => q.eq('pet_friendly', v),
  bills_included: (q, v) => q.eq('bills_included', v),
  min_floor:      (q, v) => q.gte('floor', v),
  orientation:    (q, v) => q.eq('orientation', v),
  near_metro:     (q, v) => q.eq('near_metro', v),
}

/* ── Normalisation & merge ─────────────────────────────────────── */

// Map loose / aliased keys coming from Claude or parseFilters → canonical keys.
export function normalizeFilters(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const out = {}
  const alias = {
    max_budget: 'budget', maxprice: 'budget', max_price: 'budget', price: 'budget',
    area: 'neighbourhood', district: 'neighbourhood',
    type: 'property_type', petfriendly: 'pet_friendly', pets: 'pet_friendly',
    bills: 'bills_included', metro: 'near_metro', floor: 'min_floor',
  }
  for (const [k, v] of Object.entries(raw)) {
    if (v == null) continue
    const key = alias[k.toLowerCase()] || k
    if (key in FILTER_COLUMN_MAP) out[key] = v
  }
  return out
}

// Cumulative merge: incoming (non-null) values win, everything else is kept.
export function mergeFilters(active, incoming) {
  return { ...active, ...normalizeFilters(incoming) }
}

/* ── Local structured parser ───────────────────────────────────── */

/**
 * Parse clear, structured inputs locally so we can skip the classification API
 * call. Returns null when nothing confident is found (→ fall back to Claude).
 * @param {string} message
 * @returns {{ filters: object } | null}
 */
export function parseFilters(message) {
  if (!message) return null
  const text = message.toLowerCase()
  const filters = {}

  // Budget — "under €800", "max 700", "cheaper than 900", "below 850", "<800"
  const budget = text.match(/(?:under|below|max|maximum|cheaper than|less than|up to|<)\s*€?\s*(\d{2,5})/)
  if (budget) filters.budget = parseInt(budget[1], 10)

  // Location — "in Madrid" / "in Malasaña"
  const loc = text.match(/\bin\s+([a-záéíóúñü' ]{3,30}?)(?:[,.!?]|$|\s+(?:under|with|that|for|near))/)
  if (loc) {
    const place = loc[1].trim()
    if (KNOWN_CITIES.includes(place)) filters.city = capitalise(place)
    else filters.neighbourhood = capitalise(place)
  }
  if (/\bnear (?:the )?metro\b|\bnear transport\b|\bby the metro\b/.test(text)) filters.near_metro = true

  // Property type
  if (/\bstudio\b/.test(text)) filters.property_type = 'studio'
  else if (/\broom(?:\s+in\s+(?:a\s+)?shared)?\b/.test(text)) filters.property_type = 'room'
  else if (/\b(flat|apartment)\b/.test(text)) filters.property_type = 'flat'
  else if (/\bhouse\b/.test(text)) filters.property_type = 'house'

  // Amenities
  if (/\bfurnished\b/.test(text)) filters.furnished = true
  if (/\bpet[-\s]?friendly\b|\bpets? allowed\b|\bwith (?:a )?dog\b/.test(text)) filters.pet_friendly = true
  if (/\bbills? incl/.test(text)) filters.bills_included = true

  return Object.keys(filters).length ? { filters } : null
}

function capitalise(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

/* ── Seeding from a profile / memory ───────────────────────────── */

// Build the starting active-filter set from the intake context or memory.
export function initialFilters(source) {
  if (!source) return {}
  const f = {}
  const city = source.city || source.cities?.[0]
  if (city) f.city = city
  const hood = source.neighbourhood || source.preferred_neighbourhoods?.[0] || source.neighbourhoods?.[0]
  if (hood) f.neighbourhood = hood
  const maxBudget = source.budget?.max ?? (typeof source.budget === 'number' ? source.budget : null)
  if (maxBudget != null) f.budget = maxBudget
  const type = source.property_type || source.flat_type || source.flatType
  if (type) f.property_type = coarseType(type)
  return f
}

function coarseType(t) {
  const s = String(t).toLowerCase()
  if (s.includes('studio')) return 'studio'
  if (s.includes('room')) return 'room'
  if (s.includes('house')) return 'house'
  return 'flat'
}

/* ── Querying ──────────────────────────────────────────────────── */

/**
 * Query the Supabase `listings` table with ALL active filters. Falls back to
 * client-side-filtered DUMMY_LISTINGS if the table is empty or unavailable, so
 * the UI always has something to show.
 * @param {object} filters
 * @returns {Promise<Array>}
 */
export async function queryListings(filters = {}) {
  const active = normalizeFilters(filters)
  try {
    let q = supabase.from('listings').select('*')
    for (const [key, value] of Object.entries(active)) {
      const apply = FILTER_COLUMN_MAP[key]
      if (apply) q = apply(q, value)
    }
    const { data, error } = await q.limit(60)
    if (error) throw error
    if (data && data.length) return data.map(rowToListing)
  } catch (err) {
    console.warn('[filters] listings query failed — using dummy data:', err?.message)
  }
  return filterDummy(active)
}

// Map a `listings` row to the shape the listing tiles expect.
function rowToListing(row) {
  return {
    id: row.id,
    title: row.title,
    city: row.city,
    area: row.neighbourhood,
    price: row.price,
    isForRent: true,
    bedrooms: row.bedrooms ?? 1,
    petFriendly: !!row.pet_friendly,
    image: row.image || row.data?.image,
    ...(row.data || {}),  // full stored payload (images, amenities, …) wins
  }
}

// Apply the canonical filters that DUMMY_LISTINGS can support, client-side.
function filterDummy(active) {
  let r = [...DUMMY_LISTINGS]
  if (active.budget != null) r = r.filter((l) => l.price <= active.budget)
  if (active.city) r = r.filter((l) => l.city?.toLowerCase() === String(active.city).toLowerCase())
  if (active.neighbourhood) r = r.filter((l) => l.area?.toLowerCase().includes(String(active.neighbourhood).toLowerCase()))
  if (active.bedrooms != null) r = r.filter((l) => l.bedrooms >= active.bedrooms)
  if (active.property_type === 'studio') r = r.filter((l) => l.bedrooms === 0)
  if (active.pet_friendly) r = r.filter((l) => l.petFriendly === true)
  if (active.near_metro) r = r.filter((l) => l.nearTransport === true)
  // Don't apply fields dummy data lacks (furnished/floor/orientation) — would zero out results.
  return r.length ? r : DUMMY_LISTINGS
}
