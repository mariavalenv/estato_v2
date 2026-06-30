import { useState, useEffect, useCallback } from 'react'
import { SwipePersonCard } from './SwipePersonCard.jsx'
import { PersonDetailSheet } from './PersonDetailSheet.jsx'
import { PinkBlob } from '../../../components/ui/PinkBlob.jsx'

/* ═══════════════════════════════════════════════════════════════ */
/*  FlatmateSwipeSheet                                            */
/* ═══════════════════════════════════════════════════════════════ */
export function FlatmateSwipeSheet({ flatmates, listing, startIdx, open, onClose }) {
  const [idx, setIdx] = useState(startIdx ?? 0)
  const [hist, setHist] = useState([])
  const [saved, setSaved] = useState(new Set())
  const [selected, setSelected] = useState(null) // for PersonDetailSheet

  const total = flatmates.length
  const current = idx < total ? flatmates[idx] : null

  // Reset when sheet opens
  useEffect(() => {
    if (open) {
      setIdx(startIdx ?? 0)
      setHist([])
      setSelected(null)
    }
  }, [open, startIdx])

  const handlePass = useCallback(() => {
    if (idx >= total) return
    setHist(h => [...h, { idx, dir: 'pass' }])
    setIdx(i => i + 1)
  }, [idx, total])

  const handleKeep = useCallback(() => {
    if (idx >= total) return
    setHist(h => [...h, { idx, dir: 'keep' }])
    setIdx(i => i + 1)
  }, [idx, total])

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
    if (!open || selected) return
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
        case 'Escape':
          e.preventDefault(); onClose(); break
        default: break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, selected, handlePass, handleKeep, handleUndo, handleTap, onClose])

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  const connectedCount = hist.filter(h => h.dir === 'keep').length
  const progressPct = total > 0 ? ((idx + 1) / total) * 100 : 0

  const shortAddr = listing?.address?.split(',')[0] || 'Listing'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      pointerEvents: open ? 'auto' : 'none',
    }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(28,24,20,0.22)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        opacity: open ? 1 : 0, transition: 'opacity 350ms ease',
      }} />

      {/* Panel */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '96vh',
        borderRadius: '22px 22px 0 0',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 380ms cubic-bezier(.4,0,.2,1)',
        background: 'transparent',
      }}>

        {/* ── Blurred flat photo background ────────────────────── */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: listing?.image ? `url(${listing.image})` : undefined,
          backgroundColor: listing?.image ? undefined : '#2A1F3D',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(28px) brightness(0.52) saturate(1.2)',
          transform: 'scale(1.08)',
          zIndex: 0,
        }} />

        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(240,235,225,0.12) 0%, rgba(28,24,20,0.60) 100%)',
          zIndex: 1,
        }} />

        {/* ── Topbar ───────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', flexShrink: 0,
          position: 'relative', zIndex: 10,
        }}>
          {/* Left: back */}
          <button onClick={onClose} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: 'rgba(255,255,255,0.82)', padding: 0, fontFamily: 'inherit',
            transition: 'color 150ms',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.82)' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M8.75 3.5L5.25 7l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to listing
          </button>

          {/* Centre: progress */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
              {Math.min(idx + 1, total)} of {total}
            </span>
            <div style={{ width: 64, height: 2, background: 'rgba(255,255,255,0.20)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${progressPct}%`, borderRadius: 2,
                background: '#ffffff', transition: 'width 300ms ease',
              }} />
            </div>
          </div>

          {/* Right: filter icon */}
          <button style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'rgba(255,255,255,0.14)',
            border: '1px solid rgba(255,255,255,0.20)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.70)',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2.333 3.5h9.334M4.083 7h5.834M5.833 10.5h2.334" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ── Flat context label ───────────────────────────────── */}
        <div style={{
          textAlign: 'center', padding: '0 24px 10px',
          flexShrink: 0, position: 'relative', zIndex: 10,
        }}>
          <p style={{
            fontSize: 11, color: 'rgba(255,255,255,0.50)',
            textTransform: 'uppercase', letterSpacing: '0.10em',
            margin: '0 0 2px',
          }}>
            Compatible flatmates for
          </p>
          <p style={{
            fontSize: 14, fontWeight: 500,
            color: 'rgba(255,255,255,0.88)', margin: 0,
          }}>
            {shortAddr} · {listing?.location || ''}
          </p>
        </div>

        {/* ── Stack area ───────────────────────────────────────── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '0 20px 12px',
          position: 'relative', zIndex: 10,
        }}>
          {idx >= total ? (
            /* Empty state */
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 10, textAlign: 'center', padding: '32px 0',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(250,246,239,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 4,
              }}>
                <PinkBlob size={32} />
              </div>
              <p style={{ fontSize: 18, fontWeight: 500, color: '#fff', margin: 0 }}>All caught up.</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.60)', margin: '4px 0 0', maxWidth: 260 }}>
                Your agent is finding more compatible flatmates.
              </p>
              {connectedCount > 0 && (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.80)', margin: '8px 0 0' }}>
                  {connectedCount} connection{connectedCount !== 1 ? 's' : ''} made
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Card stack */}
              <div style={{
                position: 'relative', width: '100%', maxWidth: 400, height: 540,
                flexShrink: 0,
              }}>
                {/* Ghost 2 */}
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 0,
                  borderRadius: 22,
                  background: 'rgba(250,246,239,0.92)',
                  border: '1px solid rgba(255,255,255,0.30)',
                  backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
                  transform: 'translateY(18px) scale(0.910)',
                  transformOrigin: 'bottom center',
                  opacity: 0.45, pointerEvents: 'none',
                }} />
                {/* Ghost 1 */}
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 1,
                  borderRadius: 22,
                  background: 'rgba(250,246,239,0.92)',
                  border: '1px solid rgba(255,255,255,0.30)',
                  backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
                  transform: 'translateY(9px) scale(0.955)',
                  transformOrigin: 'bottom center',
                  opacity: 0.75, pointerEvents: 'none',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 14 }}>
                {/* Pass */}
                <button onClick={handlePass} style={{
                  width: 52, height: 52, borderRadius: '50%',
                  border: '1.5px solid rgba(209,54,54,0.30)',
                  background: 'rgba(250,246,239,0.88)',
                  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                  cursor: 'pointer', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#D13636', transition: 'background 150ms',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(250,246,239,0.96)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(250,246,239,0.88)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>

                {/* Undo */}
                <button onClick={handleUndo} disabled={hist.length === 0} style={{
                  width: 38, height: 38, borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.30)',
                  background: 'rgba(250,246,239,0.70)',
                  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                  cursor: hist.length === 0 ? 'default' : 'pointer', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#6E6660', opacity: hist.length === 0 ? 0.30 : 1,
                  transition: 'opacity 150ms',
                }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 6h7a3 3 0 110 6H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5.5 3.5L3 6l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {/* Connect */}
                <button onClick={handleKeep} style={{
                  width: 52, height: 52, borderRadius: '50%',
                  border: '1.5px solid rgba(26,158,80,0.30)',
                  background: 'rgba(250,246,239,0.88)',
                  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                  cursor: 'pointer', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#1A9E50', transition: 'background 150ms',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(250,246,239,0.96)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(250,246,239,0.88)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M4 9.5l3.5 3.5L14 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', margin: '8px 0 0', textAlign: 'center' }}>
                &larr; pass &middot; connect &rarr; &middot; &uarr; undo
              </p>
            </>
          )}
        </div>
      </div>

      {/* PersonDetailSheet layered on top */}
      <PersonDetailSheet
        flatmate={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onPass={() => { setSelected(null); handlePass() }}
        onKeep={() => { setSelected(null); handleKeep() }}
      />
    </div>
  )
}
