import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  =
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or service role key in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

// ── Types ─────────────────────────────────────────────────────────────────────

interface ListingData {
  city: string
  neighbourhood: string
  price: number
  floor: number
  has_balcony: boolean
  has_parking: boolean
  pets_allowed: boolean
  recently_renovated: boolean
  furnished: boolean
}

interface FlatmateData {
  schedule: string
  cleanliness: string
  smoking: boolean
  work_from_home: boolean
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchAll(type: 'listing' | 'flatmate'): Promise<unknown[]> {
  const all: unknown[] = []
  let from = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('matches')
      .select('data')
      .eq('type', type)
      .is('user_id', null)
      .range(from, from + pageSize - 1)

    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data.map((r: { data: unknown }) => r.data))
    from += pageSize
    if (data.length < pageSize) break
  }

  return all
}

// ── Expected price ranges (base, before multipliers) ─────────────────────────

const PRICE_RANGES: Record<string, [number, number]> = {
  Chamberi:    [900,  1800],
  Salamanca:   [1200, 2500],
  Malasaña:    [800,  1600],
  Retiro:      [1000, 2000],
  Lavapiés:    [650,  1200],
  Chueca:      [900,  1700],
  Moncloa:     [750,  1400],
  Carabanchel: [550,  950],
  Vallecas:    [500,  850],
  Arganzuela:  [700,  1300],
  Eixample:    [1100, 2200],
  'Gràcia':    [900,  1800],
  'Poble Sec': [750,  1400],
  'Sant Pere': [800,  1600],
  "Sarrià":    [1400, 2800],
  Poblenou:    [900,  1700],
  'Les Corts': [1000, 1900],
  Ruzafa:      [650,  1200],
  'El Carmen': [600,  1100],
  Benimaclet:  [500,  950],
  Campanar:    [550,  1000],
  Extramurs:   [580,  1050],
}

const CENTRAL = new Set([
  'Chamberi', 'Salamanca', 'Lavapiés', 'Chueca',
  'Eixample', 'Sant Pere',
  'Ruzafa', 'El Carmen',
])

const ALL_NEIGHBOURHOODS = Object.keys(PRICE_RANGES)

// ── Helpers ───────────────────────────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m]
}

function fmt(n: number): string {
  return n.toLocaleString('en-GB')
}

// ── Output state ──────────────────────────────────────────────────────────────

const issues: string[] = []
let warnings = 0
let failures = 0

function addWarn(msg: string) {
  issues.push(`  ⚠  ${msg}`)
  warnings++
}

function addFail(msg: string) {
  issues.push(`  ✗  ${msg}`)
  failures++
}

function row(label: string, value: string, ok: boolean, flag: () => void) {
  const status = ok ? '✓' : '⚠'
  const l = `  ${label}`.padEnd(34)
  console.log(`${l}${value.padEnd(42)} ${status}`)
  if (!ok) flag()
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  process.stdout.write('Loading records from Supabase...')
  const listings = (await fetchAll('listing')) as ListingData[]
  const flatmates = (await fetchAll('flatmate')) as FlatmateData[]
  console.log(` ${listings.length.toLocaleString()} listings, ${flatmates.length.toLocaleString()} flatmates loaded.\n`)

  console.log('ESTATO TRAINING DATA VALIDATION REPORT')
  console.log('=======================================\n')

  // ── Check 1: Total counts ─────────────────────────────────────────────────

  console.log('RECORD COUNTS')

  row(
    'Total listings:',
    fmt(listings.length),
    listings.length === 10000,
    () => addWarn(`Expected 10,000 listings, got ${listings.length}`)
  )
  row(
    'Total flatmate profiles:',
    fmt(flatmates.length),
    flatmates.length === 5000,
    () => addWarn(`Expected 5,000 flatmate profiles, got ${flatmates.length}`)
  )

  const byCity = {
    Madrid:    listings.filter(l => l.city === 'Madrid'),
    Barcelona: listings.filter(l => l.city === 'Barcelona'),
    Valencia:  listings.filter(l => l.city === 'Valencia'),
  }

  row('Madrid listings:',    fmt(byCity.Madrid.length),    byCity.Madrid.length    === 5000,
    () => addWarn(`Madrid: expected 5,000, got ${byCity.Madrid.length}`))
  row('Barcelona listings:', fmt(byCity.Barcelona.length), byCity.Barcelona.length === 3000,
    () => addWarn(`Barcelona: expected 3,000, got ${byCity.Barcelona.length}`))
  row('Valencia listings:',  fmt(byCity.Valencia.length),  byCity.Valencia.length  === 2000,
    () => addWarn(`Valencia: expected 2,000, got ${byCity.Valencia.length}`))

  console.log()

  // ── Check 2: Per-neighbourhood counts ─────────────────────────────────────

  console.log('NEIGHBOURHOOD DISTRIBUTION')

  const byNeighbourhood: Record<string, ListingData[]> = {}
  for (const l of listings) {
    if (!byNeighbourhood[l.neighbourhood]) byNeighbourhood[l.neighbourhood] = []
    byNeighbourhood[l.neighbourhood].push(l)
  }

  for (const nh of ALL_NEIGHBOURHOODS) {
    const count = byNeighbourhood[nh]?.length ?? 0
    row(
      `${nh}:`,
      fmt(count),
      count >= 100,
      () => addWarn(`${nh} has only ${count} listings — below minimum of 100`)
    )
  }

  console.log()

  // ── Check 3: Price distribution ───────────────────────────────────────────

  console.log('PRICE RANGES (MEDIAN)')

  for (const nh of ALL_NEIGHBOURHOODS) {
    const nhListings = byNeighbourhood[nh] ?? []
    if (nhListings.length === 0) continue

    const med = median(nhListings.map(l => l.price))
    const [lo, hi] = PRICE_RANGES[nh]
    const inRange = med >= lo * 0.85 && med <= hi * 1.15
    const valueStr = `€${fmt(Math.round(med))}  (expected €${fmt(lo)}–€${fmt(hi)})`

    row(
      `${nh} median:`,
      valueStr,
      inRange,
      () => {
        const pctOff = med > hi
          ? `${Math.round(((med - hi) / hi) * 100)}% above expected max`
          : `${Math.round(((lo - med) / lo) * 100)}% below expected min`
        addWarn(`${nh} median price €${fmt(Math.round(med))} — ${pctOff}`)
      }
    )
  }

  console.log()

  // ── Check 4: Feature distribution ─────────────────────────────────────────

  console.log('FEATURE DISTRIBUTION')

  const total = listings.length
  const centralListings = listings.filter(l => CENTRAL.has(l.neighbourhood))

  const feats: [string, number, number, number][] = [
    ['pets_allowed:',        (listings.filter(l => l.pets_allowed).length      / total)                    * 100, 18, 22],
    ['recently_renovated:',  (listings.filter(l => l.recently_renovated).length / total)                   * 100, 15, 25],
    ['furnished:',           (listings.filter(l => l.furnished).length          / total)                   * 100, 40, 60],
    ['has_balcony:',         (listings.filter(l => l.has_balcony).length        / total)                   * 100, 45, 65],
    ['has_parking (central):',
      centralListings.length > 0
        ? (centralListings.filter(l => l.has_parking).length / centralListings.length) * 100
        : 0,
      6, 10,
    ],
  ]

  for (const [label, val, lo, hi] of feats) {
    row(
      label,
      `${val.toFixed(1)}%  (expected ${lo}–${hi}%)`,
      val >= lo && val <= hi,
      () => addWarn(`${label.replace(':', '')} is ${val.toFixed(1)}% — outside expected ${lo}–${hi}%`)
    )
  }

  console.log()

  // ── Check 5: Flatmate distribution ────────────────────────────────────────

  console.log('FLATMATE DISTRIBUTION')

  const ft = flatmates.length

  const flatDist: [string, number, number, number][] = [
    ['schedule hybrid:',    (flatmates.filter(f => f.schedule    === 'hybrid').length / ft) * 100, 35, 45],
    ['cleanliness high:',   (flatmates.filter(f => f.cleanliness === 'high').length   / ft) * 100, 45, 55],
    ['smoking:',            (flatmates.filter(f => f.smoking).length                  / ft) * 100, 12, 18],
    ['work_from_home:',     (flatmates.filter(f => f.work_from_home).length           / ft) * 100, 40, 50],
  ]

  for (const [label, val, lo, hi] of flatDist) {
    row(
      label,
      `${val.toFixed(1)}%  (expected ${lo}–${hi}%)`,
      val >= lo && val <= hi,
      () => addWarn(`Flatmate ${label.replace(':', '')} is ${val.toFixed(1)}% — outside expected ${lo}–${hi}%`)
    )
  }

  console.log()

  // ── Check 6: Correlation spot checks ─────────────────────────────────────

  console.log('CORRELATION CHECKS')

  // Use first 200 listings as sample
  const sample = listings.slice(0, 200)
  const groundFloor = sample.filter(l => l.floor === 0)
  const groundNoBalcony = groundFloor.filter(l => !l.has_balcony).length
  const groundPct = groundFloor.length > 0 ? (groundNoBalcony / groundFloor.length) * 100 : 0

  row(
    'Ground floor / no balcony:',
    `${groundPct.toFixed(0)}%  (expect ≥70%, n=${groundFloor.length})`,
    groundPct >= 70,
    () => addWarn(`Ground floor / no balcony correlation: ${groundPct.toFixed(0)}% — expected ≥70%`)
  )

  // Renovation price premium — average across all neighbourhoods
  const premiums: number[] = []
  for (const nh of ALL_NEIGHBOURHOODS) {
    const nhL = byNeighbourhood[nh] ?? []
    const renovated    = nhL.filter(l => l.recently_renovated)
    const nonRenovated = nhL.filter(l => !l.recently_renovated)
    if (renovated.length >= 5 && nonRenovated.length >= 5) {
      const avgR  = renovated.reduce((s, l) => s + l.price, 0)    / renovated.length
      const avgNR = nonRenovated.reduce((s, l) => s + l.price, 0) / nonRenovated.length
      premiums.push(((avgR - avgNR) / avgNR) * 100)
    }
  }
  const avgPremium = premiums.length > 0
    ? premiums.reduce((a, b) => a + b, 0) / premiums.length
    : 0

  row(
    'Renovation price premium:',
    `${avgPremium.toFixed(1)}%  (expect ≥15%)`,
    avgPremium >= 15,
    () => addWarn(`Renovation price premium is ${avgPremium.toFixed(1)}% — expected ≥15%`)
  )

  console.log()

  // ── Summary ───────────────────────────────────────────────────────────────

  if (issues.length > 0) {
    console.log('ISSUES FOUND')
    for (const issue of issues) console.log(issue)
    console.log()
  }

  const badge = failures > 0
    ? '✗ FAILED'
    : warnings > 0
    ? '⚠  PASSED WITH WARNINGS'
    : '✓  ALL CHECKS PASSED'

  console.log(`OVERALL: ${warnings} warning${warnings !== 1 ? 's' : ''}, ${failures} failure${failures !== 1 ? 's' : ''}  —  ${badge}`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
