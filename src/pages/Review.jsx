import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { DUMMY_LISTINGS } from '../data/dummyListings.js'
import { supabase, db } from '../supabase.js'
import { getAgentPermissions } from '../lib/dashboard/fetchers.js'
import { MatchCard } from '../components/ui/MatchCard'
import { SwipeCard } from './review/_components/SwipeCard.jsx'
import { DetailSheet } from './review/_components/DetailSheet.jsx'

const BORDER = '1px solid rgba(28,24,20,0.08)'

/* ── Normalise any listing source into the shape SwipeCard expects ── */
export function normalise(raw) {
  // Supabase match record — listing details nested under .data
  if (raw.data && typeof raw.data === 'object') {
    const d = raw.data
    const commute0 = Array.isArray(d.commute) ? d.commute[0] : null
    return {
      id: raw.id,
      price: d.price ?? 0,
      bills: d.bills ?? d.estimated_bills ?? 0,
      community: d.community ?? d.community_fee ?? 'Unknown',
      location: d.neighbourhood ?? d.area ?? '',
      beds: d.bedrooms ?? d.beds ?? 0,
      sqm: d.size_sqm ?? d.sqm ?? 0,
      floor: d.floor ?? '',
      commute: d.commute_minutes ?? (commute0 ? parseInt(commute0.time) || 0 : 0),
      commutes: d.commutes ?? (Array.isArray(d.commute) ? d.commute.map(c => ({
        dest: c.destination ?? c.dest ?? '', mode: c.mode ?? '', time: c.time ?? '', rating: 'good',
      })) : []),
      available: d.available_from ?? d.available ?? '',
      score: raw.score ?? 0,
      image: d.images?.[0] ?? d.image ?? '',
      images: d.images ?? (d.image ? [d.image] : []),
      photos: d.images?.length ?? d.photos ?? 0,
      address: d.address ?? '',
      desc: d.description ?? d.desc ?? '',
      agentTake: raw.agent_reasoning ?? '',
      reasons: raw.match_reasons ?? [],
      tradeoffs: raw.trade_offs ?? [],
      contract: d.contract ?? {},
      features: d.features ?? [],
      details: d.details ?? {},
      nearby: d.nearby ?? {},
      landlord: d.landlord ?? null,
    }
  }

  // Already-flat record (e.g. listings.js) — return as-is
  if (raw.score != null && raw.location != null) return raw

  // DUMMY_LISTINGS shape — remap field names
  const commute0 = Array.isArray(raw.commute) ? raw.commute[0] : null
  return {
    id: raw.id,
    price: raw.price ?? 0,
    bills: raw.bills ?? 0,
    community: 'Unknown',
    location: raw.area ?? raw.city ?? '',
    beds: raw.bedrooms ?? 0,
    sqm: raw.sqm ?? 0,
    floor: '',
    commute: commute0 ? parseInt(commute0.time) || 0 : 0,
    commutes: Array.isArray(raw.commute) ? raw.commute.map(c => ({
      dest: c.destination ?? '', mode: c.mode ?? '', time: c.time ?? '', rating: 'good',
    })) : [],
    available: '',
    score: Math.floor(Math.random() * 15) + 78,
    image: raw.image ?? raw.images?.[0] ?? '',
    images: raw.images ?? (raw.image ? [raw.image] : []),
    photos: raw.images?.length ?? 0,
    address: raw.title ?? '',
    desc: raw.description ?? '',
    agentTake: '',
    reasons: [],
    tradeoffs: [],
    contract: {},
    features: [],
    details: {},
    nearby: raw.amenities ? {
      Nearby: raw.amenities.map(a => ({ name: a.name, type: a.type, dist: a.distance, rating: 4.5 })),
    } : {},
    landlord: null,
  }
}

export function Review() {
  const navigate = useNavigate()
  const { state: locState } = useLocation()

  /* ── user + permissions ───────────────────────────────────────── */
  const [userId, setUserId] = useState(null)
  const [agentPerms, setAgentPerms] = useState(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        getAgentPermissions(user.id).then(setAgentPerms)
      }
    })
  }, [])

  /* ── data fetch ──────────────────────────────────────────────── */
  const [listings, setListings] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from('matches')
          .select('*')
          .eq('type', 'listing')
          .eq('status', 'pending')
          .order('score', { ascending: false })
          .limit(50)
        if (data?.length) setListings(data.map(normalise))
        else setListings(DUMMY_LISTINGS.map(normalise))
      } catch {
        setListings(DUMMY_LISTINGS.map(normalise))
      }
      setLoading(false)
    }
    load()
  }, [])

  /* ── state ───────────────────────────────────────────────────── */
  const startIdx = listings.length > 0 && locState?.startAt
    ? Math.max(0, listings.findIndex(l => l.id === locState.startAt))
    : 0
  const [idx, setIdx]           = useState(0)
  const [hist, setHist]         = useState([])      // [{ idx, dir }]
  const [saved, setSaved]       = useState(new Set())
  const [overlayDir, setOverlayDir] = useState(null) // 'pass'|'keep'|null
  const [sheetListing, setSheetListing] = useState(null)

  // Set start index once listings load
  useEffect(() => {
    if (!loading && startIdx > 0) setIdx(startIdx)
  }, [loading, startIdx])

  const total = listings.length
  const listing = idx < total ? listings[idx] : null

  useEffect(() => {
    document.body.style.background = '#F0EBE1'
    return () => { document.body.style.background = '' }
  }, [])

  const progress = total > 0 ? ((Math.min(idx + 1, total)) / total) * 100 : 0

  /* ── handlers ────────────────────────────────────────────────── */
  const advance = useCallback((dir) => {
    if (idx >= total) return
    const current = listings[idx]
    setHist((h) => [...h, { idx, dir }])
    setIdx((i) => i + 1)
    setOverlayDir(null)

    // Fire-and-forget save to Supabase
    if (current?.id && userId) {
      const action = dir === 'keep' ? 'approved' : 'rejected'
      supabase.from('user_match_actions').upsert({
        user_id: userId,
        match_id: current.id,
        action,
      }).then(null, () => {})

      // On keep: auto-save to favourites
      if (dir === 'keep') {
        db.addFavourite(userId, current).catch(() => {})

        // Auto-contact landlord only if permission is enabled
        if (agentPerms?.can_contact_landlords) {
          const location = current.location || current.neighbourhood || 'the listing'
          const introMessage = `Hi! I'm interested in your listing in ${location}. Is it still available?`

          supabase.from('conversations').insert({
            match_id: current.id,
            user_id: userId,
            last_message: introMessage,
            last_message_at: new Date().toISOString(),
          }).select('id').single().then(({ data: conv }) => {
            if (conv?.id) {
              supabase.from('messages').insert({
                conversation_id: conv.id,
                sender_id: userId,
                content: introMessage,
              }).then(null, () => {})
            }
          }).catch(() => {})
        }
      }
    }
  }, [idx, total, listings, userId, agentPerms])

  const handlePass = useCallback(() => advance('pass'), [advance])
  const handleKeep = useCallback(() => advance('keep'), [advance])

  const handleUndo = useCallback(() => {
    if (hist.length === 0) return
    const last = hist[hist.length - 1]
    setHist((h) => h.slice(0, -1))
    setIdx(last.idx)
    setOverlayDir(null)
  }, [hist])

  const handleTap = useCallback(() => {
    if (listing) setSheetListing(listing)
  }, [listing])

  const handleToggleSave = useCallback((id) => {
    setSaved((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  /* ── keyboard shortcuts ──────────────────────────────────────── */
  useEffect(() => {
    function onKey(e) {
      if (idx >= total || sheetListing) return
      if (e.key === 'ArrowLeft' || e.key === 'a') handlePass()
      else if (e.key === 'ArrowRight' || e.key === 'd') handleKeep()
      else if (e.key === 'ArrowUp' || e.key === 'u') handleUndo()
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleTap() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, total, handlePass, handleKeep, handleUndo, handleTap, sheetListing])

  /* ── render ──────────────────────────────────────────────────── */
  return (
    <div
      style={{
        background: '#F0EBE1',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Topbar ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          flexShrink: 0,
        }}
      >
        {/* Left — back */}
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 0, fontSize: 13, color: '#6E6660',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="#6E6660" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Houses
        </button>

        {/* Centre — progress */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 13, color: '#6E6660' }}>
            {Math.min(idx + 1, total)} of {total}
          </span>
          <div style={{ width: 64, height: 2, borderRadius: 1, background: '#EDE7DC', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: '#6D28D9', borderRadius: 1,
              transition: 'width 350ms ease',
            }} />
          </div>
        </div>

        {/* Right — icon buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{
            width: 30, height: 30, borderRadius: '50%',
            background: '#FAF6EF', border: BORDER,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1.75 3.5h10.5M3.5 7h7M5.25 10.5h3.5" stroke="#6E6660" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
          <button style={{
            width: 30, height: 30, borderRadius: '50%',
            background: '#FAF6EF', border: BORDER,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1.75" y="2" width="4.5" height="4.5" rx="1" stroke="#6E6660" strokeWidth="1.2" />
              <rect x="7.75" y="2" width="4.5" height="4.5" rx="1" stroke="#6E6660" strokeWidth="1.2" />
              <rect x="1.75" y="7.5" width="4.5" height="4.5" rx="1" stroke="#6E6660" strokeWidth="1.2" />
              <rect x="7.75" y="7.5" width="4.5" height="4.5" rx="1" stroke="#6E6660" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Stage ──────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 20px 12px',
          gap: 24,
        }}
      >
        {loading ? (
          /* ── Loading spinner ─────────────────────────────────── */
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            border: '2.5px solid #EDE7DC',
            borderTopColor: '#6D28D9',
            animation: 'spin 0.7s linear infinite',
          }} />
        ) : idx >= total ? (
          /* ── Empty state ──────────────────────────────────────── */
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 8, textAlign: 'center',
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
              onClick={() => navigate('/matches')}
              style={{
                marginTop: 16, padding: '8px 20px', borderRadius: 999,
                border: BORDER, background: 'transparent',
                fontSize: 13, color: '#6E6660', cursor: 'pointer',
              }}
            >
              View kept listings &rarr;
            </button>
          </div>
        ) : (
          <>
            {/* ── Card stack ────────────────────────────────────── */}
            <div style={{
              position: 'relative',
              width: '100%', maxWidth: 380, height: 480,
            }}>
              {/* Ghost 2 */}
              <div style={{
                position: 'absolute', inset: 0, zIndex: 0,
                borderRadius: 22, background: '#FAF6EF', border: BORDER,
                transform: 'translateY(18px) scale(0.91)',
                transformOrigin: 'bottom center',
                opacity: 0.35,
              }} />
              {/* Ghost 1 */}
              <div style={{
                position: 'absolute', inset: 0, zIndex: 1,
                borderRadius: 22, background: '#FAF6EF', border: BORDER,
                transform: 'translateY(9px) scale(0.955)',
                transformOrigin: 'bottom center',
                opacity: 0.60,
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

            {/* ── Action buttons ─────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              {/* Pass */}
              <button
                onClick={handlePass}
                style={{
                  width: 54, height: 54, borderRadius: '50%',
                  border: '1.5px solid rgba(209,54,54,0.22)',
                  background: '#FAF6EF', cursor: 'pointer', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#D13636', transition: 'background 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(209,54,54,0.07)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#FAF6EF' }}
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
                  border: BORDER, background: '#FAF6EF',
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
                  background: '#FAF6EF', cursor: 'pointer', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#1A9E50', transition: 'background 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(26,158,80,0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#FAF6EF' }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 9.5l3.5 3.5L14 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {/* ── Hint line ──────────────────────────────────────── */}
            <p style={{ fontSize: 10, color: 'rgba(28,24,20,0.26)', margin: 0 }}>
              &larr; pass &middot; keep &rarr; &middot; &uarr; undo
            </p>
          </>
        )}
      </div>

      {/* ── Detail sheet ───────────────────────────────────────── */}
      <DetailSheet
        listing={sheetListing}
        open={!!sheetListing}
        onClose={() => setSheetListing(null)}
        onPass={() => { setSheetListing(null); handlePass() }}
        onKeep={() => { setSheetListing(null); handleKeep() }}
      />
    </div>
  )
}

/* ── Shared SwipeCard / SwipeStack (used by Matches page too) ── */

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max)
}

function toCardShape(match) {
  const d = match.data
  if (match.type === 'listing') {
    return {
      type: 'listing',
      image: d.images?.[0] ?? '',
      images: d.images ?? [],
      matchPct: match.score,
      price: `€${d.price?.toLocaleString()} / mo`,
      neighbourhood: d.neighbourhood,
      beds: `${d.bedrooms} bed${d.bedrooms !== 1 ? 's' : ''}`,
      commute: d.commute_minutes != null ? `${d.commute_minutes} min` : '—',
      address: d.address,
      sqm: d.size_sqm,
      reasons: match.match_reasons ?? [],
      tradeoffs: match.trade_offs ?? [],
      agentReasoning: match.agent_reasoning ?? '',
      matchId: match.id,
    }
  }
  return {
    type: 'flatmate',
    image: d.avatar ?? '',
    images: [d.avatar ?? ''],
    matchPct: match.score,
    name: d.name,
    age: String(d.age ?? ''),
    jobTitle: d.job_title ?? '',
    tags: d.lifestyle_tags ?? [],
    reasons: match.match_reasons ?? [],
    tradeoffs: match.trade_offs ?? [],
    agentReasoning: match.agent_reasoning ?? '',
    matchId: match.id,
  }
}

function OldSwipeCard({ match, onDecide, isTop, onExpand, swipeDisabled }) {
  const cardRef = useRef(null)
  const dragState = useRef(null)
  const [dx, setDx] = useState(0)
  const [phase, setPhase] = useState('idle')

  const card = toCardShape(match)
  const overlayOpacity = clamp((Math.abs(dx) - 20) / 80, 0, 1)
  const direction = dx > 0 ? 'keep' : dx < 0 ? 'pass' : null

  function onPointerDown(e) {
    if (!isTop || phase !== 'idle' || swipeDisabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragState.current = {
      startX: e.clientX, startY: e.clientY,
      lastX: e.clientX, lastTime: Date.now(), velocity: 0, axis: null,
    }
    setPhase('dragging')
  }

  function onPointerMove(e) {
    if (phase !== 'dragging' || !dragState.current) return
    const now = Date.now()
    const dt = now - dragState.current.lastTime || 1
    const rawDx = e.clientX - dragState.current.startX
    const rawDy = e.clientY - dragState.current.startY
    if (!dragState.current.axis && (Math.abs(rawDx) > 8 || Math.abs(rawDy) > 8)) {
      dragState.current.axis = Math.abs(rawDx) > Math.abs(rawDy) ? 'x' : 'y'
    }
    if (dragState.current.axis === 'y') return
    dragState.current.velocity = (e.clientX - dragState.current.lastX) / dt
    dragState.current.lastX = e.clientX
    dragState.current.lastTime = now
    setDx(rawDx)
  }

  function onPointerUp(e) {
    if (phase !== 'dragging' || !dragState.current) return
    const rawDx = e.clientX - dragState.current.startX
    const rawDy = e.clientY - dragState.current.startY
    const totalMove = Math.abs(rawDx) + Math.abs(rawDy)
    if (totalMove < 8 && onExpand) {
      dragState.current = null; setPhase('idle'); onExpand(match); return
    }
    if (dragState.current.axis === 'y') {
      if ((e.clientY - dragState.current.startY) < -60 && onExpand) onExpand(match)
      dragState.current = null; setPhase('idle'); return
    }
    const vel = dragState.current.velocity
    if (Math.abs(dx) > 100 || Math.abs(vel) > 0.5) {
      triggerFly(dx > 0 ? 'keep' : 'pass')
    } else {
      triggerSnap()
    }
    dragState.current = null
  }

  function triggerFly(action) {
    setPhase('flying')
    setTimeout(() => onDecide(match.id, action), 300)
  }

  function triggerSnap() {
    setPhase('snapping'); setDx(0)
    setTimeout(() => setPhase('idle'), 200)
  }

  useEffect(() => {
    if (cardRef.current) {
      cardRef.current._triggerFly = triggerFly
      cardRef.current._triggerSnap = triggerSnap
    }
  })

  let transform = '', transition = ''
  if (phase === 'dragging') { transform = `translateX(${dx}px) rotate(${dx * 0.05}deg)`; transition = 'none' }
  else if (phase === 'flying') { transform = `translateX(${dx >= 0 ? '120vw' : '-120vw'}) rotate(${dx >= 0 ? '25deg' : '-25deg'})`; transition = 'transform 300ms ease-in' }
  else if (phase === 'snapping') { transform = 'translateX(0) rotate(0deg)'; transition = 'transform 200ms cubic-bezier(0.34,1.56,0.64,1)' }
  else { transform = 'translateX(0) rotate(0deg)'; transition = 'none' }

  return (
    <div
      ref={cardRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'absolute', inset: 0,
        cursor: isTop ? (phase === 'dragging' ? 'grabbing' : 'grab') : 'default',
        transform, transition, userSelect: 'none', touchAction: 'none',
      }}
    >
      <MatchCard card={card} density="standard" />
      {direction === 'pass' && (
        <div style={{ position: 'absolute', inset: 0, borderRadius: 16, background: `rgba(248,113,113,${0.15 * overlayOpacity})`, pointerEvents: 'none' }}>
          <span style={{ position: 'absolute', top: 16, right: 16, color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 6, padding: '4px 10px', fontSize: 13, fontWeight: 600, opacity: overlayOpacity, background: 'transparent' }}>PASS</span>
        </div>
      )}
      {direction === 'keep' && (
        <div style={{ position: 'absolute', inset: 0, borderRadius: 16, background: `rgba(52,211,105,${0.10 * overlayOpacity})`, pointerEvents: 'none' }}>
          <span style={{ position: 'absolute', top: 16, left: 16, color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 6, padding: '4px 10px', fontSize: 13, fontWeight: 600, opacity: overlayOpacity, background: 'transparent' }}>KEEP</span>
        </div>
      )}
    </div>
  )
}

export function SwipeStack({ queue, onDecide, onExpand, swipeDisabled }) {
  const visible = queue.slice(0, 3)
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 380, height: 420, margin: '0 auto' }}>
      {visible.map((match, i) => {
        const isTop = i === 0
        const scale = i === 0 ? 1 : i === 1 ? 0.95 : 0.90
        const translateY = i === 0 ? 0 : i === 1 ? 10 : 20
        const zIndex = 3 - i
        return (
          <div key={match.id} style={{ position: 'absolute', inset: 0, zIndex, transform: `scale(${scale}) translateY(${translateY}px)`, transition: isTop ? 'none' : 'transform 250ms ease-out', transformOrigin: 'bottom center' }}>
            {isTop ? (
              <OldSwipeCard match={match} onDecide={onDecide} isTop onExpand={onExpand} swipeDisabled={swipeDisabled} />
            ) : (
              <div style={{ pointerEvents: 'none' }}>
                <MatchCard card={toCardShape(match)} density="standard" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
