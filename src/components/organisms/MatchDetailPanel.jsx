import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, db } from '../../supabase.js'
import { PinkBlob } from '../ui/PinkBlob.jsx'
import { RejectionModal } from '../matches/RejectionModal.jsx'

/* ── Constants ──────────────────────────────────────────────── */

const BORDER = '1px solid rgba(28,24,20,0.08)'
const MUTED = '#6E6660'
const DARK = '#1C1814'
const FAINT = 'rgba(28,24,20,0.26)'
const SLIDE_THRESHOLD = 0.55 // fraction of track width to trigger

/* ── Helpers ────────────────────────────────────────────────── */

function initials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function SectionLabel({ children, color }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
      letterSpacing: '0.09em', color: color || FAINT, margin: '0 0 8px',
    }}>{children}</p>
  )
}

function ScoreBadge({ score }) {
  const bg =
    score >= 80
      ? '#6D28D9'
      : score >= 60
      ? 'rgba(251,191,36,0.18)'
      : 'rgba(209,54,54,0.12)'
  const color =
    score >= 80 ? '#fff' : score >= 60 ? '#92660A' : '#D13636'

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 14,
        left: 14,
        zIndex: 2,
        padding: '5px 12px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 500,
        background: bg,
        color,
      }}
    >
      {score}% match
    </div>
  )
}

/* ── Image carousel ─────────────────────────────────────────── */

function ImageCarousel({ images }) {
  const [idx, setIdx] = useState(0)
  if (!images?.length) return null

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <img
        src={images[idx]}
        alt=""
        onError={(e) => { e.target.style.display = 'none' }}
        style={{
          width: '100%', height: '100%', objectFit: 'cover', display: 'block',
        }}
      />
      {images.length > 1 && (
        <>
          <button onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)} style={arrowStyle('left')}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M8.5 3L5 7l3.5 4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button onClick={() => setIdx((i) => (i + 1) % images.length)} style={arrowStyle('right')}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5.5 3L9 7l-3.5 4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 5,
          }}>
            {images.slice(0, 6).map((_, i) => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i === idx ? '#fff' : 'rgba(255,255,255,0.45)',
                transition: 'background 200ms',
              }} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function arrowStyle(side) {
  return {
    position: 'absolute', [side]: 10, top: '50%', transform: 'translateY(-50%)',
    width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
    background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 150ms',
  }
}

/* ── Scrollbar injection ─────────────────────────────────────── */

if (typeof document !== 'undefined' && !document.getElementById('mdp-scrollbar')) {
  const s = document.createElement('style')
  s.id = 'mdp-scrollbar'
  s.textContent = `
    .mdp-scroll::-webkit-scrollbar { width: 3px; }
    .mdp-scroll::-webkit-scrollbar-track { background: transparent; }
    .mdp-scroll::-webkit-scrollbar-thumb { background: rgba(28,24,20,0.10); border-radius: 2px; }
  `
  document.head.appendChild(s)
}

/* ── Interested listings for flatmate matches ───────────────── */

function InterestedListingsSection({ listingIds }) {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!listingIds?.length) return
    setLoading(true)
    supabase
      .from('matches')
      .select('id, score, data')
      .in('id', listingIds)
      .then(({ data, error }) => {
        if (error) { console.error('InterestedListings:', error.message); setListings([]) }
        else setListings(data ?? [])
        setLoading(false)
      })
  }, [listingIds?.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!listingIds?.length) return null
  if (loading) {
    return (
      <div>
        <SectionLabel>Interested in {listingIds.length} listings</SectionLabel>
        {[1, 2].map(i => (
          <div key={i} style={{ height: 72, borderRadius: 12, background: '#EDE7DC', marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    )
  }
  if (!listings.length) return null

  return (
    <div>
      <SectionLabel>Interested in {listings.length} listing{listings.length !== 1 ? 's' : ''}</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {listings.map(l => {
          const ld = l.data || {}
          return (
            <div key={l.id} style={{
              display: 'flex', gap: 12, padding: 10, borderRadius: 12,
              background: '#EDE7DC', border: '1px solid rgba(28,24,20,0.06)',
            }}>
              {ld.images?.[0] ? (
                <img src={ld.images[0]} alt="" style={{
                  width: 60, height: 60, borderRadius: 8, objectFit: 'cover', flexShrink: 0,
                }} onError={e => { e.target.style.display = 'none' }} />
              ) : (
                <div style={{
                  width: 60, height: 60, borderRadius: 8, flexShrink: 0,
                  background: 'linear-gradient(135deg, #D5CFC4, #C8C0B4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="rgba(28,24,20,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 8L9 2l7 6" /><path d="M4 7v8h4v-4h2v4h4V7" />
                  </svg>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: DARK }}>
                    {ld.price ? `€${ld.price.toLocaleString()}/mo` : '—'}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 999,
                    background: l.score >= 80 ? 'rgba(109,40,217,0.1)' : 'rgba(28,24,20,0.06)',
                    color: l.score >= 80 ? '#6D28D9' : MUTED,
                  }}>
                    {l.score}%
                  </span>
                </div>
                <p style={{ fontSize: 12, color: MUTED, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[ld.neighbourhood, ld.bedrooms && `${ld.bedrooms} bed${ld.bedrooms !== 1 ? 's' : ''}`, ld.commute_minutes && `${ld.commute_minutes} min`].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Also interested (flatmates who like the same listing) ───── */

function AlsoInterestedSection({ matchId, allMatches }) {
  const people = (() => {
    const flatmates = (allMatches || []).filter(m => m.type === 'flatmate')

    // 1) Flatmates whose interested_listing_ids includes this listing
    const exact = flatmates.filter(m =>
      (m.data?.interested_listing_ids || []).includes(matchId)
    )
    if (exact.length) return exact.slice(0, 6)

    // 2) Fallback — top-scoring flatmates as potential co-tenants
    return [...flatmates]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 4)
  })()

  if (!people.length) return null

  return (
    <div>
      <SectionLabel>Also interested in this listing</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {people.map(p => {
          const pd = p.data || {}
          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 11,
              padding: '10px 14px', background: '#EDE7DC',
              borderRadius: 12, border: BORDER,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: '#E4DDD0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 500, color: MUTED, flexShrink: 0,
              }}>
                {initials(pd.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: DARK, margin: 0 }}>
                  {pd.name || 'Unknown'}
                </p>
                <p style={{ fontSize: 11, color: MUTED, margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[pd.age, pd.job_title].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 999,
                background: p.score >= 80 ? 'rgba(109,40,217,0.1)' : 'rgba(28,24,20,0.06)',
                color: p.score >= 80 ? '#6D28D9' : MUTED, flexShrink: 0,
              }}>
                {p.score}% match
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Swipe-to-contact button ────────────────────────────────── */

function SwipeToContact({ onContact }) {
  const trackRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [offsetX, setOffsetX] = useState(0)
  const [sent, setSent] = useState(false)
  const startXRef = useRef(0)
  const trackWidthRef = useRef(0)

  const handleStart = useCallback((clientX) => {
    if (sent) return
    setDragging(true)
    startXRef.current = clientX
    trackWidthRef.current = trackRef.current?.offsetWidth || 300
  }, [sent])

  const handleMove = useCallback((clientX) => {
    if (!dragging) return
    const dx = Math.max(0, clientX - startXRef.current)
    const max = trackWidthRef.current - 48
    setOffsetX(Math.min(dx, max))
  }, [dragging])

  const handleEnd = useCallback(() => {
    if (!dragging) return
    setDragging(false)
    const max = trackWidthRef.current - 48
    if (offsetX / max >= SLIDE_THRESHOLD) {
      setOffsetX(max)
      setSent(true)
      onContact?.()
    } else {
      setOffsetX(0)
    }
  }, [dragging, offsetX, onContact])

  useEffect(() => {
    if (!dragging) return
    const onMouseMove = (e) => handleMove(e.clientX)
    const onMouseUp = () => handleEnd()
    const onTouchMove = (e) => handleMove(e.touches[0].clientX)
    const onTouchEnd = () => handleEnd()
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('touchmove', onTouchMove)
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [dragging, handleMove, handleEnd])

  const max = (trackRef.current?.offsetWidth || 300) - 48
  const progress = max > 0 ? offsetX / max : 0

  return (
    <div
      ref={trackRef}
      style={{
        position: 'relative',
        height: 48,
        borderRadius: 24,
        background: sent ? '#1A9E50' : '#EDE7DC',
        border: sent ? 'none' : BORDER,
        overflow: 'hidden',
        userSelect: 'none',
        transition: sent ? 'background 300ms ease' : undefined,
      }}
    >
      {/* Progress fill */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, rgba(109,40,217,0.08), rgba(109,40,217,0.18))',
        width: `${progress * 100}%`,
        borderRadius: 24,
        transition: dragging ? 'none' : 'width 300ms ease',
      }} />

      {/* Label */}
      <span style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 500, letterSpacing: '0.02em',
        color: sent ? '#fff' : MUTED,
        opacity: sent ? 1 : Math.max(0.3, 1 - progress * 1.5),
        transition: sent ? 'color 300ms, opacity 300ms' : (dragging ? 'none' : 'opacity 300ms'),
        pointerEvents: 'none',
      }}>
        {sent ? '✓ Request sent' : 'Slide to contact landlord →'}
      </span>

      {/* Thumb */}
      {!sent && (
        <div
          onMouseDown={(e) => handleStart(e.clientX)}
          onTouchStart={(e) => handleStart(e.touches[0].clientX)}
          style={{
            position: 'absolute',
            left: offsetX,
            top: 4,
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: '#6D28D9',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'grab',
            transition: dragging ? 'none' : 'left 300ms ease',
            boxShadow: '0 2px 8px rgba(109,40,217,0.3)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Main panel                                                    */
/* ═══════════════════════════════════════════════════════════════ */

export function MatchDetailPanel({ match, allMatches, onClose, onApprove, onRejectDone, conversationId, onOpenChat }) {
  const [visible, setVisible] = useState(false)
  const [approved, setApproved] = useState(false)
  const [showRejectionModal, setShowRejectionModal] = useState(false)

  const actionsRef = useRef({ onClose, onApprove, onRejectDone })
  useEffect(() => {
    actionsRef.current = { onClose, onApprove, onRejectDone }
  })

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        if (showRejectionModal) setShowRejectionModal(false)
        else actionsRef.current.onClose()
      } else if (e.key === 'a' || e.key === 'A') handleApprove()
      else if (e.key === 'p' || e.key === 'P' || e.key === 'x' || e.key === 'X') handleReject()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showRejectionModal]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleApprove() {
    if (approved) return
    setApproved(true)
    setTimeout(() => {
      actionsRef.current.onApprove(match)
      actionsRef.current.onClose()
    }, 600)
  }

  function handleReject() {
    setShowRejectionModal(true)
  }

  if (!match) return null

  const isListing = match.type === 'listing'
  const d = match.data ?? {}
  const score = match.score ?? 0
  const reasons = match.match_reasons ?? []
  const tradeoffs = match.trade_offs ?? []

  const listingDetails = isListing
    ? [
        d.address && { label: 'Address', value: d.address },
        d.size_sqm && { label: 'Size', value: `${d.size_sqm} m²` },
        d.city && { label: 'City', value: d.city },
        d.bedrooms != null && { label: 'Bedrooms', value: d.bedrooms === 0 ? 'Studio' : d.bedrooms },
        d.bathrooms && { label: 'Bathrooms', value: d.bathrooms },
        d.floor && { label: 'Floor', value: d.floor },
        d.available_from && { label: 'Available', value: d.available_from },
      ].filter(Boolean)
    : []

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          background: 'rgba(28,24,20,0.25)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          width: 'min(920px, calc(100vw - 48px))',
          maxHeight: 'min(92vh, 860px)',
          background: '#FAF6EF',
          borderRadius: 18,
          border: BORDER,
          boxShadow: '0 32px 100px rgba(28,24,20,0.22), 0 8px 32px rgba(28,24,20,0.10)',
          zIndex: 41,
          transform: visible
            ? 'translate(-50%, -50%) scale(1)'
            : 'translate(-50%, -50%) scale(0.96)',
          opacity: visible ? 1 : 0,
          transition: 'transform 300ms cubic-bezier(0.32,0.72,0,1), opacity 250ms ease',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ─────────────────────────────────── */}
        <div
          style={{
            height: 48,
            padding: '0 20px',
            borderBottom: '1px solid rgba(28,24,20,0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span style={{
            fontSize: 11, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: FAINT,
          }}>
            {isListing ? 'Listing' : 'Flatmate'}
          </span>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'transparent',
              border: '1px solid rgba(28,24,20,0.09)',
              color: 'rgba(28,24,20,0.5)',
              fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#EDE7DC' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            ✕
          </button>
        </div>

        {/* ── Two-column layout ──────────────────────── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

          {/* Left: hero image */}
          <div style={{
            width: '46%', flexShrink: 0,
            position: 'relative',
            background: 'linear-gradient(135deg, #EDE7DC 0%, #D5CFC4 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isListing ? (
              <>
                {d.images?.length > 0 ? (
                  <ImageCarousel images={d.images} />
                ) : (
                  <svg width="48" height="48" viewBox="0 0 18 18" fill="none" stroke="rgba(28,24,20,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 8L9 2l7 6" /><path d="M4 7v8h4v-4h2v4h4V7" />
                  </svg>
                )}
                <ScoreBadge score={score} />
              </>
            ) : (
              <>
                <div style={{
                  width: 88, height: 88, borderRadius: '50%',
                  background: '#FAF6EF',
                  border: '1px solid rgba(28,24,20,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, fontWeight: 500, color: MUTED,
                }}>
                  {initials(d.name)}
                </div>
                <ScoreBadge score={score} />
              </>
            )}
          </div>

          {/* Right: scrollable details */}
          <div
            className="mdp-scroll"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '22px 26px 22px 26px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            {/* Title block */}
            {isListing ? (
              <div>
                <p style={{
                  fontSize: 26, fontWeight: 500, color: DARK,
                  margin: 0, lineHeight: 1.2, letterSpacing: '-0.01em',
                }}>
                  {d.price != null ? `€${d.price.toLocaleString()} / mo` : '—'}
                </p>
                <div style={{
                  display: 'flex', gap: 12, fontSize: 13,
                  color: MUTED, marginTop: 6, flexWrap: 'wrap',
                }}>
                  {d.neighbourhood && <span>📍 {d.neighbourhood}</span>}
                  {d.bedrooms != null && (
                    <span>🛏 {d.bedrooms} bed{d.bedrooms !== 1 ? 's' : ''}</span>
                  )}
                  {d.commute_minutes != null && <span>🚇 {d.commute_minutes} min</span>}
                  {d.size_sqm && <span>📐 {d.size_sqm} m²</span>}
                </div>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 24, fontWeight: 500, color: DARK, margin: 0, lineHeight: 1.2 }}>
                  {d.name}
                </p>
                {(d.age || d.job_title) && (
                  <p style={{ fontSize: 14, color: MUTED, margin: '3px 0 0' }}>
                    {[d.age, d.job_title].filter(Boolean).join(' · ')}
                  </p>
                )}
                {d.lifestyle_tags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {d.lifestyle_tags.map((t) => (
                      <span key={t} style={{
                        padding: '3px 10px', borderRadius: 999,
                        background: '#EDE7DC',
                        border: '1px solid rgba(28,24,20,0.08)',
                        fontSize: 12, color: MUTED,
                      }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Match score bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: MUTED }}>Overall match</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#6D28D9' }}>{score}%</span>
              </div>
              <div style={{ height: 4, background: '#EDE7DC', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${score}%`, borderRadius: 2,
                  background: 'linear-gradient(90deg, #818cf8, #6D28D9)',
                  transition: 'width 400ms ease',
                }} />
              </div>
            </div>

            {/* Agent reasoning */}
            {match.agent_reasoning && (
              <div>
                <SectionLabel>Why your agent matched this</SectionLabel>
                <div style={{
                  background: 'rgba(109,40,217,0.06)',
                  border: '1px solid rgba(109,40,217,0.14)',
                  borderRadius: 12,
                  padding: '11px 14px',
                  display: 'flex', gap: 9, alignItems: 'flex-start',
                }}>
                  <PinkBlob size={22} />
                  <p style={{ fontSize: 13, color: DARK, lineHeight: 1.6, margin: 0 }}>
                    {match.agent_reasoning}
                  </p>
                </div>
              </div>
            )}

            {/* Matched because */}
            {reasons.length > 0 && (
              <div>
                <SectionLabel>Matched because</SectionLabel>
                {reasons.map((r, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6,
                  }}>
                    <span style={{ fontSize: 12, color: '#1A9E50', flexShrink: 0, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 13, color: DARK, lineHeight: 1.45 }}>{r}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Trade-offs */}
            {tradeoffs.length > 0 && (
              <div>
                <SectionLabel color="#C07A00">Trade-offs to consider</SectionLabel>
                {tradeoffs.map((t, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6,
                  }}>
                    <span style={{ fontSize: 10, color: '#C07A00', flexShrink: 0, marginTop: 3 }}>▲</span>
                    <span style={{ fontSize: 13, color: MUTED, lineHeight: 1.45 }}>{t}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Details grid */}
            {listingDetails.length > 0 && (
              <div>
                <SectionLabel>Details</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {listingDetails.map(({ label, value }) => (
                    <div key={label}>
                      <p style={{
                        fontSize: 11, color: FAINT,
                        textTransform: 'uppercase', letterSpacing: '0.07em',
                        margin: '0 0 3px',
                      }}>
                        {label}
                      </p>
                      <p style={{ fontSize: 13, color: DARK, fontWeight: 500, margin: 0 }}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description (if available) */}
            {d.description && (
              <div>
                <SectionLabel>About this property</SectionLabel>
                <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.65, margin: 0 }}>
                  {d.description}
                </p>
              </div>
            )}

            {/* Also interested (for listings) */}
            {isListing && <AlsoInterestedSection matchId={match.id} allMatches={allMatches} />}

            {/* Flatmate interested listings */}
            {!isListing && (
              <InterestedListingsSection listingIds={d.interested_listing_ids} />
            )}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────── */}
        <div
          style={{
            borderTop: '1px solid rgba(28,24,20,0.08)',
            padding: '14px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            flexShrink: 0,
          }}
        >
          {/* Contact landlord — when the user has already messaged them, skip
              the swipe-to-contact slider and surface a direct chat shortcut. */}
          {isListing && conversationId ? (
            <button
              onClick={() => onOpenChat?.(conversationId, match)}
              style={{
                height: 48,
                borderRadius: 24,
                background: '#6D28D9',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'inherit',
                letterSpacing: '0.02em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'opacity 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3H2a1 1 0 00-1 1v7a1 1 0 001 1h3l2 2 2-2h5a1 1 0 001-1V4a1 1 0 00-1-1z" />
              </svg>
              Open chat with landlord
            </button>
          ) : isListing && (
            <SwipeToContact onContact={() => {
              handleApprove()
              // Save to favourites
              supabase.auth.getUser().then(({ data }) => {
                const uid = data?.user?.id
                if (uid) db.addFavourite(uid, { id: match.id, ...d }).catch(() => {})
              })
            }} />
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleReject}
              style={{
                flex: 1, padding: 12, borderRadius: 12,
                fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
                background: 'transparent',
                color: 'rgba(28,24,20,0.5)',
                border: '1px solid rgba(28,24,20,0.12)',
                transition: 'background 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(28,24,20,0.04)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              Pass
            </button>
            <button
              onClick={handleApprove}
              disabled={approved}
              style={{
                flex: 1, padding: 12, borderRadius: 12,
                fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
                cursor: approved ? 'default' : 'pointer',
                background: approved ? '#1A9E50' : '#6D28D9',
                color: '#ffffff', border: 'none',
                transition: 'background 250ms, transform 100ms, opacity 150ms',
              }}
              onMouseEnter={(e) => { if (!approved) e.currentTarget.style.opacity = '0.88' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
              onMouseDown={(e) => { if (!approved) e.currentTarget.style.transform = 'scale(0.97)' }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              {approved ? '✓ Approved' : 'Approve'}
            </button>
          </div>
        </div>
      </div>

      {/* Rejection modal — collects reasons for the learning agent */}
      {showRejectionModal && (
        <RejectionModal
          matchId={match.id}
          matchType={match.type}
          onComplete={() => {
            setShowRejectionModal(false)
            actionsRef.current.onRejectDone?.()
          }}
          onCancel={() => setShowRejectionModal(false)}
        />
      )}
    </>
  )
}
