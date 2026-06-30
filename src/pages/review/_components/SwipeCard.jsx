import { useState, useCallback } from 'react'
import { useSwipe } from '../../../hooks/useSwipe.js'

const BUDGET = 1200
const BORDER = '1px solid rgba(28,24,20,0.08)'
const MUTED = '#6E6660'
const ICON_CLR = 'rgba(28,24,20,0.26)'
const DARK = '#1C1814'

function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi) }

/* ── tiny inline SVGs ──────────────────────────────────────────── */
const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M3 4.5l3 3 3-3" stroke="rgba(28,24,20,0.26)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const PinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 7.583a1.75 1.75 0 100-3.5 1.75 1.75 0 000 3.5z" stroke={ICON_CLR} strokeWidth="1.1" />
    <path d="M11.083 5.833c0 3.792-4.083 6.417-4.083 6.417S2.917 9.625 2.917 5.833a4.083 4.083 0 118.166 0z" stroke={ICON_CLR} strokeWidth="1.1" />
  </svg>
)

const BedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M1.75 10.5V7.583a1.167 1.167 0 011.167-1.166h8.166A1.167 1.167 0 0112.25 7.583V10.5" stroke={ICON_CLR} strokeWidth="1.1" strokeLinecap="round" />
    <path d="M1.75 10.5V11.667M12.25 10.5V11.667M1.75 6.417V4.083a1.167 1.167 0 011.167-1.166h2.916" stroke={ICON_CLR} strokeWidth="1.1" strokeLinecap="round" />
    <rect x="4.667" y="3.5" width="2.333" height="2.333" rx=".583" stroke={ICON_CLR} strokeWidth="1.1" />
  </svg>
)

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="5.25" stroke={ICON_CLR} strokeWidth="1.1" />
    <path d="M7 4.083V7l2.333 1.167" stroke={ICON_CLR} strokeWidth="1.1" strokeLinecap="round" />
  </svg>
)

const CalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1.75" y="2.917" width="10.5" height="9.333" rx="1.167" stroke={ICON_CLR} strokeWidth="1.1" />
    <path d="M1.75 5.833h10.5M4.667 1.75v2.333M9.333 1.75v2.333" stroke={ICON_CLR} strokeWidth="1.1" strokeLinecap="round" />
  </svg>
)

const HeartIcon = ({ filled }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill={filled ? '#D13636' : 'none'}>
    <path d="M8 13.5s-5.5-3.5-5.5-7A3 3 0 018 4a3 3 0 015.5 2.5c0 3.5-5.5 7-5.5 7z" stroke={filled ? '#D13636' : MUTED} strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
)

const HouseIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.22 }}>
    <path d="M4 16l12-10 12 10M7 14v12h18V14" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="12" y="20" width="8" height="6" stroke={MUTED} strokeWidth="2" />
  </svg>
)

/* ── Detail row ────────────────────────────────────────────────── */
function Row({ icon, label, value, extra, valueColor }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 16px', borderBottom: BORDER,
    }}>
      <span style={{ flexShrink: 0, display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: 12, color: MUTED, minWidth: 68 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: valueColor || DARK, flex: 1 }}>{value}</span>
      {extra && <span style={{ fontSize: 11, color: ICON_CLR, marginLeft: 'auto', whiteSpace: 'nowrap' }}>{extra}</span>}
    </div>
  )
}

/* ── SwipeCard ─────────────────────────────────────────────────── */
export function SwipeCard({ listing, onPass, onKeep, onTap, saved, onToggleSave, style, wheelDx = 0 }) {
  const [dragDx, setDragDx] = useState(0)

  const handleDrag = useCallback((x) => setDragDx(x), [])

  const cardRef = useSwipe({
    onSwipeLeft: onPass,
    onSwipeRight: onKeep,
    onTap,
    onDrag: handleDrag,
  })

  // Effective horizontal offset: pointer-drag while dragging, otherwise the
  // trackpad scroll progress (so scroll-swipe gets the same tilt + overlay).
  const dx = dragDx || wheelDx

  const { price, score, image, photos, location, beds, sqm, floor,
    commute, commutes, available, contract, desc } = listing

  const diff = Math.abs(price - BUDGET)
  const underBudget = price <= BUDGET

  const commuteColor = commute <= 20 ? '#1A9E50' : commute <= 30 ? DARK : '#C07A00'
  const firstDest = commutes?.[0]?.dest?.split('(')[0]?.trim() || ''

  const minLease = contract?.['Min. lease'] || ''

  /* overlay */
  const overlayOpacity = clamp((Math.abs(dx) - 20) / 80, 0, 1)
  const dir = dx > 20 ? 'keep' : dx < -20 ? 'pass' : null

  return (
    <div ref={cardRef} style={{
      position: 'absolute', inset: 0, zIndex: 2,
      background: '#FAF6EF',
      border: BORDER,
      borderRadius: 22, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      cursor: 'grab', willChange: 'transform',
      userSelect: 'none', touchAction: 'none',
      // While scroll-swiping (no pointer drag) tilt the card to match progress.
      // It springs back via the transition when wheelDx returns to 0.
      ...(dragDx ? null : {
        transform: `translateX(${wheelDx}px) rotate(${wheelDx * 0.06}deg)`,
        transition: 'transform 200ms cubic-bezier(.34,1.56,.64,1)',
      }),
      ...style,
    }}>

      {/* ── Photo area ─────────────────────────────────────────── */}
      <div style={{ height: 242, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        {image ? (
          <img src={image} alt="" style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
          }} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(160deg, #EDE7DC, #D5CFC4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HouseIcon />
          </div>
        )}
        {/* bottom gradient */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 64,
          background: 'linear-gradient(to top, rgba(0,0,0,0.25), transparent)',
          pointerEvents: 'none',
        }} />

        {/* Score badge */}
        <span style={{
          position: 'absolute', top: 12, left: 12,
          display: 'inline-block', padding: '4px 10px', borderRadius: 999,
          fontSize: 11, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap',
          background: score >= 80 ? '#6D28D9' : score >= 65 ? 'rgba(192,122,0,0.85)' : 'rgba(209,54,54,0.85)',
        }}>
          {score}% match
        </span>

        {/* Save button */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSave?.(listing.id) }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: 12, right: 12,
            width: 30, height: 30, borderRadius: '50%',
            background: 'rgba(250,246,239,0.9)', backdropFilter: 'blur(4px)',
            border: 'none', cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <HeartIcon filled={saved} />
        </button>

        {/* Photo count */}
        <span style={{
          position: 'absolute', bottom: 12, right: 12,
          padding: '3px 8px', borderRadius: 999,
          background: 'rgba(0,0,0,0.5)', color: '#fff',
          fontSize: 11, fontWeight: 500,
        }}>
          1 / {photos}
        </span>
      </div>

      {/* ── PASS overlay ───────────────────────────────────────── */}
      {dir === 'pass' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 8, borderRadius: 22,
          background: `linear-gradient(to right, rgba(209,54,54,${0.12 * overlayOpacity}), transparent 60%)`,
          pointerEvents: 'none',
        }}>
          <span style={{
            position: 'absolute', top: 20, left: 16,
            color: '#D13636', border: '1.5px solid #D13636', borderRadius: 6,
            padding: '4px 12px', fontSize: 14, fontWeight: 600,
            opacity: overlayOpacity, letterSpacing: '0.04em',
          }}>PASS</span>
        </div>
      )}

      {/* ── KEEP overlay ───────────────────────────────────────── */}
      {dir === 'keep' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 8, borderRadius: 22,
          background: `linear-gradient(to left, rgba(26,158,80,${0.10 * overlayOpacity}), transparent 60%)`,
          pointerEvents: 'none',
        }}>
          <span style={{
            position: 'absolute', top: 20, right: 16,
            color: '#1A9E50', border: '1.5px solid #1A9E50', borderRadius: 6,
            padding: '4px 12px', fontSize: 14, fontWeight: 600,
            opacity: overlayOpacity, letterSpacing: '0.04em',
          }}>KEEP</span>
        </div>
      )}

      {/* ── Card body ──────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Price line */}
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          padding: '12px 16px 10px', borderBottom: BORDER,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span style={{ fontSize: 21, fontWeight: 500, color: DARK }}>€{price.toLocaleString()}</span>
            <span style={{ fontSize: 13, color: MUTED }}> / mo</span>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 500,
            color: underBudget ? '#1A9E50' : '#C07A00',
            display: 'flex', alignItems: 'center', gap: 2,
          }}>
            {underBudget ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 8V2M2.5 4.5L5 2l2.5 2.5" stroke="#1A9E50" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 2v6M2.5 5.5L5 8l2.5-2.5" stroke="#C07A00" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            )}
            {underBudget ? `−€${diff} under budget` : `+€${diff} over target`}
          </span>
        </div>

        {/* Detail rows */}
        <Row icon={<PinIcon />} label="Location" value={`${location}, Madrid`} />
        <Row icon={<BedIcon />} label="Size" value={`${beds} beds · ${sqm} m²`} extra={`${floor} floor`} />
        <Row icon={<ClockIcon />} label="Commute" value={`${commute} min`} valueColor={commuteColor} extra={firstDest ? `to ${firstDest}` : undefined} />
        <Row icon={<CalIcon />} label="Available" value={`From ${available}`} extra={minLease} />

        {/* Description */}
        <div style={{
          padding: '8px 16px 10px', borderTop: BORDER,
          fontSize: 12, color: MUTED, lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {desc}
        </div>

        {/* Tap hint */}
        <div style={{
          padding: '7px 16px 12px', textAlign: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>
          <ChevronDown />
          <span style={{ fontSize: 11, color: ICON_CLR }}>Tap to see full details</span>
        </div>
      </div>
    </div>
  )
}
