import { useState, useCallback, useEffect } from 'react'
import { SwipePersonCard } from '../pages/review/_components/SwipePersonCard.jsx'
import { CREME } from '../lib/landingTheme.js'
import { useWheelSwipe } from '../hooks/useWheelSwipe.js'

const BORDER = '1px solid rgba(28,24,20,0.08)'

/* ── Tinder-style swipe deck for the Flatmates tab ─────────────────
   The housemate twin of PropertySwipeDeck — same stack, buttons and
   gestures, but the deck is people (SwipePersonCard) instead of
   listings. Swipe / button left to pass, right to connect; tap a card
   to open the full profile. ──────────────────────────────────────── */
export function PersonSwipeDeck({ people, onOpen, onKeep, onPass }) {
  const [idx, setIdx] = useState(0)
  const [hist, setHist] = useState([])      // stack of previous indices
  const [saved, setSaved] = useState(new Set())

  // Reset when the filtered list changes.
  useEffect(() => { setIdx(0); setHist([]) }, [people])

  const total = people.length
  const person = idx < total ? people[idx] : null

  const advance = useCallback(() => {
    setHist((h) => [...h, idx])
    setIdx((i) => i + 1)
  }, [idx])

  const handlePass = useCallback(() => {
    if (person) onPass?.(person)
    advance()
  }, [advance, person, onPass])

  const handleKeep = useCallback(() => {
    if (person) {
      setSaved((s) => new Set(s).add(person.id))
      onKeep?.(person)
    }
    advance()
  }, [advance, person, onKeep])

  const handleUndo = useCallback(() => {
    setHist((h) => {
      if (!h.length) return h
      setIdx(h[h.length - 1])
      return h.slice(0, -1)
    })
  }, [])

  const handleTap = useCallback(() => {
    if (person) onOpen?.(person)
  }, [person, onOpen])

  const handleToggleSave = useCallback((id) => {
    setSaved((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  /* keyboard shortcuts */
  useEffect(() => {
    function onKey(e) {
      if (!person) return
      if (e.key === 'ArrowLeft') handlePass()
      else if (e.key === 'ArrowRight') handleKeep()
      else if (e.key === 'ArrowUp') handleUndo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [person, handlePass, handleKeep, handleUndo])

  /* horizontal scroll (trackpad / shift-wheel) → pass / connect */
  const deckRef = useWheelSwipe({
    onLeft: handlePass,
    onRight: handleKeep,
    onDown: handleUndo,
    enabled: !!person,
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
      {!person ? (
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
            Your agent is searching for more housemates.
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
            <SwipePersonCard
              key={person.id}
              flatmate={person}
              onPass={handlePass}
              onKeep={handleKeep}
              onTap={handleTap}
              saved={saved.has(person.id)}
              onToggleSave={handleToggleSave}
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

            {/* Connect */}
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
            &larr; pass &middot; connect &rarr; &middot; &uarr; undo
          </p>
        </>
      )}
    </div>
  )
}
