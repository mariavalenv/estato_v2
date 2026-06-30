import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { SwipeCard } from '../pages/review/_components/SwipeCard.jsx'
import { normalise } from '../pages/Review.jsx'
import { CREME } from '../lib/landingTheme.js'
import { trackEvent } from '../lib/tracking.js'
import { useWheelSwipe } from '../hooks/useWheelSwipe.js'

const BORDER = '1px solid rgba(28,24,20,0.08)'

/* ── Tinder-style swipe deck for the screening Properties tab ──────
   Reuses the same SwipeCard + gesture used on the /review page. Swipe
   (or click the buttons) left to pass, right to keep; tap a card to
   open its full detail panel. ─────────────────────────────────────── */
export function PropertySwipeDeck({ listings, onOpen, onDismiss }) {
  const cards = useMemo(() => listings.map(normalise), [listings])
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  const [idx, setIdx] = useState(0)
  const [hist, setHist] = useState([])      // stack of previous indices
  const [saved, setSaved] = useState(new Set())
  const [pendingDismiss, setPendingDismiss] = useState(null)  // {id} awaiting an optional reason

  const pendingRef = useRef(null)           // mirror of pendingDismiss for stable callbacks
  const dismissTimerRef = useRef(null)

  // Log the pending dismiss (with reason if given) and hide the prompt.
  const resolveDismiss = useCallback((reason) => {
    const p = pendingRef.current
    if (!p) return
    clearTimeout(dismissTimerRef.current)
    trackEvent('listing_dismiss', p.id, reason ? { reason } : {})
    if (reason) onDismissRef.current?.(p.id, reason)  // feed the reason into assistant memory
    pendingRef.current = null
    setPendingDismiss(null)
  }, [])

  // Drop the pending dismiss WITHOUT logging (used when the user undoes a pass).
  const cancelDismiss = useCallback(() => {
    clearTimeout(dismissTimerRef.current)
    pendingRef.current = null
    setPendingDismiss(null)
  }, [])

  // Reset the deck when the filtered listings change (resolve any pending pass).
  useEffect(() => { resolveDismiss(); setIdx(0); setHist([]) }, [cards, resolveDismiss])

  // On unmount, flush a still-pending dismiss so it isn't lost.
  useEffect(() => () => resolveDismiss(), [resolveDismiss])

  const total = cards.length
  const card = idx < total ? cards[idx] : null

  const advance = useCallback(() => {
    setHist((h) => [...h, idx])
    setIdx((i) => i + 1)
  }, [idx])

  const handlePass = useCallback(() => {
    if (card) {
      resolveDismiss()                          // close out any earlier pending pass first
      pendingRef.current = { id: card.id }
      setPendingDismiss({ id: card.id })
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = setTimeout(() => resolveDismiss(), 4500)  // auto-log w/o reason
    }
    advance()
  }, [advance, card, resolveDismiss])
  const handleKeep = useCallback(() => {
    resolveDismiss()                            // a keep also resolves a prior pending pass
    if (card) {
      setSaved((s) => new Set(s).add(card.id))
      trackEvent('listing_save', card.id, { saved: true })
    }
    advance()
  }, [advance, card, resolveDismiss])

  const handleUndo = useCallback(() => {
    cancelDismiss()                             // taking a pass back must NOT log a dismiss
    setHist((h) => {
      if (!h.length) return h
      setIdx(h[h.length - 1])
      return h.slice(0, -1)
    })
  }, [cancelDismiss])

  const handleTap = useCallback(() => {
    if (card) onOpen?.(listings[idx])
  }, [card, listings, idx, onOpen])

  const handleToggleSave = useCallback((id) => {
    setSaved((s) => {
      const next = new Set(s)
      const nowSaved = !next.has(id)
      nowSaved ? next.add(id) : next.delete(id)
      trackEvent('listing_save', id, { saved: nowSaved })
      return next
    })
  }, [])

  /* keyboard shortcuts */
  useEffect(() => {
    function onKey(e) {
      if (!card) return
      if (e.key === 'ArrowLeft') handlePass()
      else if (e.key === 'ArrowRight') handleKeep()
      else if (e.key === 'ArrowUp') handleUndo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [card, handlePass, handleKeep, handleUndo])

  /* horizontal scroll (trackpad / shift-wheel) → pass / keep, with the card
     tilting live as you scroll (progress is -1..1; 130px = full tilt) */
  const [wheelDx, setWheelDx] = useState(0)
  const deckRef = useWheelSwipe({
    onLeft: handlePass,
    onRight: handleKeep,
    onDown: handleUndo,                 // scroll down → undo the previous card's pass/keep
    onProgress: (p) => setWheelDx(p * 260),
    enabled: !!card,
  })

  const progress = total > 0 ? (Math.min(idx + 1, total) / total) * 100 : 0

  return (
    <div ref={deckRef} style={{
      position: 'relative',
      flex: 1, minHeight: 0, background: CREME,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 22, padding: '20px 20px 24px',
      overscrollBehaviorX: 'none', touchAction: 'pan-y',
    }}>
      <style>{`@keyframes sd-reason-in { from { opacity: 0; transform: translate(-50%, 8px) } to { opacity: 1; transform: translate(-50%, 0) } }`}</style>

      {/* ── Optional "why did you pass?" reason prompt ──────────────── */}
      {pendingDismiss && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px 7px 12px',
          background: '#1C1814', borderRadius: 999, zIndex: 30,
          boxShadow: '0 8px 24px rgba(0,0,0,0.22)', animation: 'sd-reason-in 180ms ease',
        }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginRight: 2 }}>Why pass?</span>
          {[['Too expensive', 'too expensive'], ['Wrong area', 'wrong area'], ['Other', 'other']].map(([label, val]) => (
            <button
              key={val}
              onClick={() => resolveDismiss(val)}
              style={{
                border: 'none', cursor: 'pointer', padding: '5px 11px', borderRadius: 999,
                fontSize: 12, fontWeight: 500, color: '#1C1814', background: '#FAF6EF',
                transition: 'background 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#fff' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#FAF6EF' }}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => resolveDismiss()}
            aria-label="Skip reason"
            style={{
              border: 'none', cursor: 'pointer', width: 24, height: 24, borderRadius: '50%',
              color: 'rgba(255,255,255,0.6)', background: 'transparent', fontSize: 16, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>
      )}

      {!card ? (
        /* ── Empty state ─────────────────────────────────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(201,74,61,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, color: '#C94A3D', marginBottom: 4,
          }}>✦</div>
          <p style={{ fontSize: 18, fontWeight: 500, color: '#1C1814', margin: 0 }}>All caught up.</p>
          <p style={{ fontSize: 13, color: '#6E6660', margin: '4px 0 0' }}>
            Your agent is searching for more listings.
          </p>
        </div>
      ) : (
        <>
          {/* ── Progress ──────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 13, color: '#6E6660' }}>{Math.min(idx + 1, total)} of {total}</span>
            <div style={{ width: 64, height: 2, borderRadius: 1, background: '#EDE7DC', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: '#C94A3D', borderRadius: 1, transition: 'width 350ms ease' }} />
            </div>
          </div>

          {/* ── Card stack ────────────────────────────────────────── */}
          <div style={{ position: 'relative', width: '100%', maxWidth: 380, height: 480 }}>
            {/* Ghost 2 */}
            <div style={{
              position: 'absolute', inset: 0, zIndex: 0,
              borderRadius: 22, background: '#FAF6EF', border: BORDER,
              transform: 'translateY(18px) scale(0.91)', transformOrigin: 'bottom center', opacity: 0.35,
            }} />
            {/* Ghost 1 */}
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1,
              borderRadius: 22, background: '#FAF6EF', border: BORDER,
              transform: 'translateY(9px) scale(0.955)', transformOrigin: 'bottom center', opacity: 0.6,
            }} />
            {/* Active card */}
            <SwipeCard
              key={card.id}
              listing={card}
              onPass={handlePass}
              onKeep={handleKeep}
              onTap={handleTap}
              saved={saved.has(card.id)}
              onToggleSave={handleToggleSave}
              wheelDx={wheelDx}
            />
          </div>

          {/* ── Action buttons ────────────────────────────────────── */}
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
                cursor: hist.length === 0 ? 'default' : 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#6E6660', opacity: hist.length === 0 ? 0.28 : 1, transition: 'opacity 150ms',
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

          {/* ── Hint line ─────────────────────────────────────────── */}
          <p style={{ fontSize: 10, color: 'rgba(28,24,20,0.26)', margin: 0 }}>
            &larr; pass &middot; keep &rarr; &middot; &uarr; undo
          </p>
        </>
      )}
    </div>
  )
}
