import { useState, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { SwipeCard } from '../../review/_components/SwipeCard.jsx'
import { DetailSheet } from '../../review/_components/DetailSheet.jsx'
import { getCachedEnrichment, setCachedEnrichment, hasEnrichment } from '../../../lib/enrichmentCache.js'

const BORDER = '1px solid rgba(28,24,20,0.08)'

/**
 * Generate a local description for a listing from its structured data
 * when the enrichment agent hasn't run yet. Avoids an API call entirely.
 */
function generateLocalDescription(d) {
  const parts = []
  if (d.neighbourhood) parts.push(`${d.bedrooms ?? ''}bed flat in ${d.neighbourhood}`)
  if (d.price) parts.push(`€${d.price.toLocaleString()}/mo`)
  if (d.commute_minutes) {
    const quality = d.commute_minutes <= 15 ? 'excellent' : d.commute_minutes <= 25 ? 'good' : 'moderate'
    parts.push(`${d.commute_minutes} min commute (${quality})`)
  }
  const pros = []
  if (d.furnished) pros.push('furnished')
  if (d.has_balcony) pros.push('has balcony')
  if (d.has_lift) pros.push('has lift')
  if (d.natural_light === 'abundant') pros.push('great natural light')
  if (d.recently_renovated) pros.push('recently renovated')
  if (pros.length) parts.push(pros.join(', '))
  const cons = []
  if (d.street_noise === 'high') cons.push('street noise')
  if (!d.has_lift && d.floor && parseInt(d.floor) >= 3) cons.push(`${d.floor}th floor no lift`)
  if (cons.length) parts.push(`watch: ${cons.join(', ')}`)
  return parts.join('. ') + '.'
}

/* ── Convert a Supabase match object to flat listing shape ────── */
function matchToListing(match) {
  const d = match.data || {}
  return {
    id: match.id,
    price: d.price || 0,
    bills: d.bills || 80,
    community: d.community || 'Unknown',
    location: d.neighbourhood || d.location || d.area || '',
    beds: d.bedrooms || 1,
    sqm: d.size_sqm || 0,
    floor: d.floor || '—',
    commute: d.commute_minutes || 0,
    available: d.available_from || d.available || '—',
    score: match.score || 0,
    image: d.images?.[0] || d.image || '',
    images: d.images || [],
    photos: d.images?.length || 1,
    address: d.address || '',
    lat: d.lat || 0,
    lng: d.lng || 0,
    desc: d.description || '',
    agentTake: match.agent_reasoning || '',
    commutes: d.commutes || [],
    nearby: d.nearby || {},
    reasons: match.match_reasons || [],
    tradeoffs: match.trade_offs || [],
    features: d.features || [],
    details: d.details || {},
    landlord: d.landlord || { initial: '?', name: 'Unknown', sub: '' },
    contract: d.contract || {},
    // Boolean flags for agent feature descriptions
    hasLift: d.has_lift ?? false,
    hasBalcony: d.has_balcony ?? false,
    hasParking: d.has_parking ?? false,
    petsAllowed: d.pets_allowed ?? false,
    furnished: d.furnished ?? false,
    recentlyRenovated: d.recently_renovated ?? false,
    naturalLight: d.natural_light || '',
    streetNoise: d.street_noise || '',
    availableFrom: d.available_from || '',
  }
}

/* ═══════════════════════════════════════════════════════════════ */
/*  HousesPanel                                                   */
/* ═══════════════════════════════════════════════════════════════ */
export function HousesPanel({ matches, onDecision, onCardChange }) {
  const navigate = useNavigate()

  // Convert matches to flat listing shape — all data from Supabase inventory.
  // Batch-generate local descriptions for the first 4 items in parallel if
  // they lack agent_reasoning, so cards aren't blank on queue open.
  const listings = useMemo(() => {
    const rawListings = matches?.filter(m => m.type === 'listing') || []
    const mapped = rawListings.map(matchToListing)

    // Pre-populate descriptions for the first 4 visible cards
    const PREFETCH_COUNT = 4
    for (let i = 0; i < Math.min(PREFETCH_COUNT, rawListings.length); i++) {
      const raw = rawListings[i]
      const card = mapped[i]
      if (!card.agentTake && raw.data) {
        // Check enrichment cache first, then generate locally
        const cached = getCachedEnrichment(raw.id)
        if (cached?.agent_reasoning) {
          card.agentTake = cached.agent_reasoning
          card.reasons = cached.match_reasons ?? card.reasons
          card.tradeoffs = cached.trade_offs ?? card.tradeoffs
        } else {
          const desc = generateLocalDescription(raw.data)
          card.agentTake = desc
          setCachedEnrichment(raw.id, {
            agent_reasoning: desc,
            match_reasons: card.reasons,
            trade_offs: card.tradeoffs,
          })
        }
      }
    }

    return mapped
  }, [matches])

  const [idx, setIdx]       = useState(0)
  const [hist, setHist]     = useState([])
  const [saved, setSaved]   = useState(new Set())
  const [selectedListing, setSelectedListing] = useState(null)

  const total = listings.length
  const listing = idx < total ? listings[idx] : null
  const keptCount = hist.filter(h => h.dir === 'keep').length

  // Notify parent of the current listing so the agent bubble can personalise.
  // Depend on listing.id (stable) instead of the listing object (new ref every render).
  const listingId = listing?.id
  useEffect(() => {
    onCardChange?.(listing, idx, total)
  }, [listingId]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── handlers ────────────────────────────────────────────────── */
  const handlePass = useCallback(() => {
    if (idx >= total) return
    setHist(h => [...h, { idx, dir: 'pass' }])
    onDecision?.(listings[idx].id, 'pass')
    setIdx(i => i + 1)
  }, [idx, total, listings, onDecision])

  const handleKeep = useCallback(() => {
    if (idx >= total) return
    const kept = listings[idx]
    setHist(h => [...h, { idx, dir: 'keep' }])
    onDecision?.(kept.id, 'keep', kept)
    setIdx(i => i + 1)
  }, [idx, total, listings, onDecision])

  const handleUndo = useCallback(() => {
    if (!hist.length) return
    const last = hist[hist.length - 1]
    setHist(h => h.slice(0, -1))
    setIdx(last.idx)
  }, [hist])

  const handleTap = useCallback(() => {
    if (listing) setSelectedListing(listing)
  }, [listing])

  const handleToggleSave = useCallback((id) => {
    setSaved(s => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  /* ── empty state ─────────────────────────────────────────────── */
  if (idx >= total) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 8, textAlign: 'center', padding: '16px 0 32px',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'rgba(109,40,217,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, color: '#6D28D9', marginBottom: 4,
        }}>
          ✦
        </div>
        <p style={{ fontSize: 18, fontWeight: 500, color: '#1C1814', margin: 0 }}>
          All caught up.
        </p>
        <p style={{ fontSize: 13, color: '#6E6660', margin: '4px 0 0' }}>
          Your agent is searching for more listings.
        </p>
        <button
          onClick={() => navigate('/matches?type=listing&status=approved')}
          style={{
            marginTop: 16, padding: '8px 20px', borderRadius: 999,
            border: BORDER, background: 'transparent',
            fontSize: 13, color: '#6E6660', cursor: 'pointer',
          }}
        >
          See all kept &rarr;
        </button>
      </div>
    )
  }

  /* ── render ──────────────────────────────────────────────────── */
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      width: '100%', paddingBottom: 32,
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        width: '100%', maxWidth: 400, marginBottom: 20,
      }}>
        <span style={{ fontSize: 12, color: '#6E6660' }}>
          {keptCount} kept · {total - idx} remaining
        </span>
        <a
          onClick={() => navigate('/matches?type=listing')}
          style={{
            fontSize: 12, color: '#6D28D9', cursor: 'pointer',
            borderBottom: '1px solid rgba(109,40,217,0.16)',
            paddingBottom: 1,
          }}
        >
          View all →
        </a>
      </div>

      {/* Card stack */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: 400, height: 520,
      }}>
        {/* Ghost 2 */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          borderRadius: 22, background: '#F4EFE0', border: BORDER,
          transform: 'translateY(18px) scale(0.91)',
          transformOrigin: 'bottom center',
          opacity: 0.35, pointerEvents: 'none',
        }} />
        {/* Ghost 1 */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          borderRadius: 22, background: '#F4EFE0', border: BORDER,
          transform: 'translateY(9px) scale(0.955)',
          transformOrigin: 'bottom center',
          opacity: 0.60, pointerEvents: 'none',
        }} />
        {/* Active card */}
        <SwipeCard
          key={listing.id}
          listing={listing}
          onPass={handlePass}
          onKeep={handleKeep}
          onTap={handleTap}
          saved={saved.has(listing.id)}
          onToggleSave={handleToggleSave}
        />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 16 }}>
        {/* Pass */}
        <button
          onClick={handlePass}
          style={{
            width: 54, height: 54, borderRadius: '50%',
            border: '1.5px solid rgba(209,54,54,0.22)',
            background: '#F4EFE0', cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#D13636', transition: 'background 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(209,54,54,0.07)' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#F4EFE0' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        {/* Undo */}
        <button
          onClick={handleUndo}
          disabled={hist.length === 0}
          style={{
            width: 38, height: 38, borderRadius: '50%',
            border: BORDER, background: '#F4EFE0',
            cursor: hist.length === 0 ? 'default' : 'pointer',
            padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#6E6660',
            opacity: hist.length === 0 ? 0.28 : 1,
            transition: 'opacity 150ms',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 6h7a3 3 0 110 6H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5.5 3.5L3 6l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Keep */}
        <button
          onClick={handleKeep}
          style={{
            width: 54, height: 54, borderRadius: '50%',
            border: '1.5px solid rgba(26,158,80,0.28)',
            background: '#F4EFE0', cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#1A9E50', transition: 'background 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,158,80,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#F4EFE0' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M4 9.5l3.5 3.5L14 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Hint */}
      <p style={{ fontSize: 10, color: 'rgba(28,24,20,0.26)', margin: '8px 0 0', textAlign: 'center' }}>
        &larr; pass &middot; keep &rarr; &middot; &uarr; undo
      </p>

      {/* Detail sheet */}
      <DetailSheet
        listing={selectedListing}
        open={!!selectedListing}
        compact
        onClose={() => setSelectedListing(null)}
        onPass={() => {
          onDecision?.(selectedListing?.id, 'pass')
          setSelectedListing(null)
          setHist(h => [...h, { idx, dir: 'pass' }])
          setIdx(i => i + 1)
        }}
        onKeep={() => {
          onDecision?.(selectedListing?.id, 'keep')
          setSelectedListing(null)
          setHist(h => [...h, { idx, dir: 'keep' }])
          setIdx(i => i + 1)
        }}
      />
    </div>
  )
}
