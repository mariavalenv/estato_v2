import { useState, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { SwipePersonCard } from '../../review/_components/SwipePersonCard.jsx'
import { PersonDetailSheet } from '../../review/_components/PersonDetailSheet.jsx'
import { getCachedEnrichment, setCachedEnrichment } from '../../../lib/enrichmentCache.js'

const BORDER = '1px solid rgba(28,24,20,0.08)'

/**
 * Generate a local description for a flatmate from structured data.
 */
function generateLocalFlatmateDescription(d) {
  const parts = []
  if (d.name && d.job_title) parts.push(`${d.name}, ${d.age ?? ''}yo ${d.job_title}`)
  const tags = d.lifestyle_tags?.slice(0, 3) ?? []
  if (tags.length) parts.push(tags.join(', '))
  if (d.budget_max) parts.push(`budget up to €${d.budget_max}/mo`)
  if (d.preferred_neighbourhoods?.length) parts.push(`looking in ${d.preferred_neighbourhoods.slice(0, 2).join(', ')}`)
  return parts.join('. ') + '.'
}

/* ── Convert a Supabase match object to flat flatmate shape ───── */
function matchToFlatmate(match) {
  const d = match.data || {}
  return {
    id: match.id,
    initial: (d.name || '?')[0].toUpperCase(),
    name: d.name || 'Flatmate',
    age: d.age || '—',
    occupation: d.job_title || d.jobTitle || d.occupation || '—',
    score: match.score || 0,
    compat: d.compat || '',
    budget: d.budget || (d.budget_max ? `€${d.budget_max}/mo` : '—'),
    budgetMatch: d.budget_match || d.budgetMatch || '',
    schedule: d.schedule || '—',
    scheduleMatch: d.schedule_match || d.scheduleMatch || '',
    movein: d.move_in || d.movein || '—',
    lease: d.lease || d.lease_length || '',
    cleanScore: d.clean_score ?? d.cleanScore ?? 0,
    cleanLabel: d.clean_label || d.cleanLabel || '',
    tags: d.lifestyle_tags || d.tags || [],
    desc: d.description || d.desc || '',
    bio: d.bio || d.description || d.desc || '',
    reasons: match.match_reasons || [],
    tradeoffs: match.trade_offs || d.tradeoffs || [],
    looking: d.looking || {},
    routine: d.routine || [],
    habits: d.habits || [],
    interestedListingIds: d.interested_listing_ids || d.interestedListingIds || [],
    cleanNote: d.clean_note || d.cleanNote || '',
    draftMsg: d.draft_msg || d.draftMsg || '',
    agent_reasoning: match.agent_reasoning || '',
  }
}

/* ═══════════════════════════════════════════════════════════════ */
/*  FlatmatesPanel                                                */
/* ═══════════════════════════════════════════════════════════════ */
export function FlatmatesPanel({ matches, onDecision, onCardChange }) {
  const navigate = useNavigate()

  const flatmates = useMemo(() => {
    const raw = matches?.filter(m => m.type === 'flatmate') || []
    const mapped = raw.map(matchToFlatmate)

    // Pre-populate descriptions for the first 4 visible cards
    const PREFETCH_COUNT = 4
    for (let i = 0; i < Math.min(PREFETCH_COUNT, raw.length); i++) {
      const rawMatch = raw[i]
      const card = mapped[i]
      if (!card.agent_reasoning && rawMatch.data) {
        const cached = getCachedEnrichment(rawMatch.id)
        if (cached?.agent_reasoning) {
          card.agent_reasoning = cached.agent_reasoning
          card.reasons = cached.match_reasons ?? card.reasons
          card.tradeoffs = cached.trade_offs ?? card.tradeoffs
        } else {
          const desc = generateLocalFlatmateDescription(rawMatch.data)
          card.agent_reasoning = desc
          setCachedEnrichment(rawMatch.id, {
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
  const [selected, setSelected] = useState(null)

  const total = flatmates.length
  const current = idx < total ? flatmates[idx] : null
  const connectedCount = hist.filter(h => h.dir === 'keep').length

  // Notify parent of the current flatmate so the agent bubble can personalise
  const currentId = current?.id
  useEffect(() => {
    onCardChange?.(current, idx, total)
  }, [currentId]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── handlers ────────────────────────────────────────────────── */
  const handlePass = useCallback(() => {
    if (idx >= total) return
    setHist(h => [...h, { idx, dir: 'pass' }])
    onDecision?.(flatmates[idx].id, 'pass')
    setIdx(i => i + 1)
  }, [idx, total, flatmates, onDecision])

  const handleKeep = useCallback(() => {
    if (idx >= total) return
    const kept = flatmates[idx]
    setHist(h => [...h, { idx, dir: 'keep' }])
    onDecision?.(kept.id, 'keep', kept)
    setIdx(i => i + 1)
  }, [idx, total, flatmates, onDecision])

  const handleUndo = useCallback(() => {
    if (!hist.length) return
    const last = hist[hist.length - 1]
    setHist(h => h.slice(0, -1))
    setIdx(last.idx)
  }, [hist])

  const handleTap = useCallback(() => {
    if (current) setSelected(current)
  }, [current])

  const handleToggleSave = useCallback((id) => {
    setSaved(s => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  // Keyboard navigation (only when PersonDetailSheet is NOT open)
  useEffect(() => {
    if (selected) return
    function onKey(e) {
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
          e.preventDefault(); handlePass(); break
        case 'ArrowRight':
        case 'd':
          e.preventDefault(); handleKeep(); break
        case 'ArrowUp':
        case 'u':
          e.preventDefault(); handleUndo(); break
        case ' ':
        case 'Enter':
          e.preventDefault(); handleTap(); break
        default: break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, handlePass, handleKeep, handleUndo, handleTap])

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
          Your agent is finding more compatible flatmates.
        </p>
        {connectedCount > 0 && (
          <p style={{ fontSize: 12, color: '#6E6660', margin: '4px 0 0' }}>
            {connectedCount} connection{connectedCount !== 1 ? 's' : ''} made
          </p>
        )}
        <button
          onClick={() => navigate('/matches?filter=connected')}
          style={{
            marginTop: 16, padding: '8px 20px', borderRadius: 999,
            border: BORDER, background: 'transparent',
            fontSize: 13, color: '#6E6660', cursor: 'pointer',
          }}
        >
          See all connections &rarr;
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
          {connectedCount} connected · {total - idx} remaining
        </span>
        <a
          onClick={() => navigate('/matches?type=flatmate')}
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
        <SwipePersonCard
          key={current.id}
          flatmate={current}
          onPass={handlePass}
          onKeep={handleKeep}
          onTap={handleTap}
          saved={saved.has(current.id)}
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

        {/* Connect */}
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
        &larr; pass &middot; connect &rarr; &middot; &uarr; undo
      </p>

      {/* Person detail sheet */}
      <PersonDetailSheet
        flatmate={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onPass={() => {
          onDecision?.(selected?.id, 'pass')
          setSelected(null)
          setHist(h => [...h, { idx, dir: 'pass' }])
          setIdx(i => i + 1)
        }}
        onKeep={() => {
          onDecision?.(selected?.id, 'keep')
          setSelected(null)
          setHist(h => [...h, { idx, dir: 'keep' }])
          setIdx(i => i + 1)
        }}
      />
    </div>
  )
}
