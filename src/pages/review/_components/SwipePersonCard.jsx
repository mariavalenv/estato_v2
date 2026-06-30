import { useState, useCallback } from 'react'
import { useSwipe } from '../../../hooks/useSwipe.js'

const BORDER = '1px solid rgba(28,24,20,0.08)'
const MUTED = '#6E6660'
const DARK = '#1C1814'
const FAINT = 'rgba(28,24,20,0.26)'
const ICON_CLR = 'rgba(28,24,20,0.26)'

function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi) }

/* ── tiny inline SVGs ────────────────────────────────────────── */
const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M3 4.5l3 3 3-3" stroke={FAINT} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const WalletIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1.75" y="3.5" width="10.5" height="8.167" rx="1.167" stroke={ICON_CLR} strokeWidth="1.1" />
    <path d="M1.75 5.833h10.5" stroke={ICON_CLR} strokeWidth="1.1" />
    <circle cx="10.5" cy="8.167" r=".583" fill={ICON_CLR} />
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

const SparkleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1.75l1.167 3.5L11.667 7l-3.5 1.75L7 12.25 5.833 8.75 2.333 7l3.5-1.75L7 1.75z" stroke={ICON_CLR} strokeWidth="1.1" strokeLinejoin="round" />
  </svg>
)

const HeartIcon = ({ filled }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill={filled ? '#D13636' : 'none'}>
    <path d="M8 13.5s-5.5-3.5-5.5-7A3 3 0 018 4a3 3 0 015.5 2.5c0 3.5-5.5 7-5.5 7z" stroke={filled ? '#D13636' : MUTED} strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
)

/* ── Detail row ──────────────────────────────────────────────── */
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

/* ── SwipePersonCard ─────────────────────────────────────────── */
export function SwipePersonCard({ flatmate, onPass, onKeep, onTap, saved, onToggleSave }) {
  const [dx, setDx] = useState(0)
  const handleDrag = useCallback((x) => setDx(x), [])

  const cardRef = useSwipe({
    onSwipeLeft: onPass,
    onSwipeRight: onKeep,
    onTap,
    onDrag: handleDrag,
  })

  const { initial, name, age, occupation, score, compat, budget, budgetMatch,
    schedule, scheduleMatch, movein, lease, cleanScore, cleanLabel,
    tags, desc } = flatmate

  const compatLabel = compat
    ? compat.charAt(0).toUpperCase() + compat.slice(1)
    : score >= 85 ? 'Strong match' : score >= 70 ? 'Good match' : 'Fair match'

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
    }}>

      {/* ── Person hero ──────────────────────────────────────── */}
      <div style={{
        height: 268, flexShrink: 0, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, #E8E2D6 0%, #CEC8BC 100%)',
      }}>
        {/* Subtle purple radial tint */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(109,40,217,0.08), transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Bottom fade into card surface */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 96,
          background: 'linear-gradient(to top, rgba(250,246,239,1) 0%, rgba(250,246,239,0) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Centre content */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 10, position: 'relative', zIndex: 2,
          width: '100%', height: '100%',
          justifyContent: 'center',
        }}>
          {/* Avatar */}
          <div style={{
            width: 88, height: 88, borderRadius: '50%',
            background: '#FAF6EF',
            border: '3px solid rgba(250,246,239,0.95)',
            boxShadow: '0 4px 24px rgba(28,20,14,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, fontWeight: 500, color: MUTED,
          }}>
            {initial}
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 500, color: DARK, margin: 0, marginTop: 2 }}>{name}</p>
            <p style={{ fontSize: 12, color: MUTED, margin: '2px 0 0' }}>{age} · {occupation}</p>
          </div>
        </div>

        {/* Score badge */}
        <span style={{
          position: 'absolute', top: 12, left: 12, zIndex: 2,
          display: 'inline-block', padding: '4px 10px', borderRadius: 999,
          fontSize: 11, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap',
          background: score >= 85 ? '#6D28D9' : score >= 70 ? 'rgba(192,122,0,0.85)' : 'rgba(109,40,217,0.60)',
        }}>
          {score}% match
        </span>

        {/* Save button */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSave?.(flatmate.id) }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: 12, right: 12, zIndex: 2,
            width: 30, height: 30, borderRadius: '50%',
            background: 'rgba(250,246,239,0.90)', backdropFilter: 'blur(4px)',
            border: 'none', cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <HeartIcon filled={saved} />
        </button>
      </div>

      {/* ── PASS overlay ─────────────────────────────────────── */}
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

      {/* ── CONNECT overlay ──────────────────────────────────── */}
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
          }}>CONNECT</span>
        </div>
      )}

      {/* ── Card body ────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Compatibility line */}
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          padding: '11px 16px 9px', borderBottom: BORDER,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 21, fontWeight: 500, color: DARK }}>{score}%</span>
            <span style={{ fontSize: 13, color: MUTED }}> compatible</span>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 500,
            color: score >= 85 ? '#1A9E50' : score >= 70 ? MUTED : '#C07A00',
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            {score >= 85 && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 8V2M3 4l2-2 2 2" stroke="#1A9E50" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {compatLabel}
          </span>
        </div>

        {/* Detail rows */}
        <Row icon={<WalletIcon />} label="Budget" value={budget || '—'}
          extra={budgetMatch || ''}
          valueColor={budgetMatch === 'matches yours' ? '#1A9E50' : DARK} />
        <Row icon={<ClockIcon />} label="Schedule" value={schedule || '—'}
          extra={scheduleMatch || ''}
          valueColor={scheduleMatch === 'same as you' ? '#1A9E50' : DARK} />
        <Row icon={<CalIcon />} label="Move-in" value={movein || '—'}
          extra={lease || ''} />
        <Row icon={<SparkleIcon />} label="Cleanliness" value={`${cleanScore} / 5`}
          extra={cleanLabel?.toLowerCase() || ''}
          valueColor={cleanScore >= 4.5 ? '#1A9E50' : DARK} />

        {/* Tags */}
        <div style={{
          padding: '8px 16px 0', borderTop: BORDER,
          display: 'flex', flexWrap: 'wrap', gap: 4,
        }}>
          {(tags || []).slice(0, 4).map(t => (
            <span key={t} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 999,
              background: '#EDE7DC', border: BORDER, color: MUTED,
            }}>{t}</span>
          ))}
        </div>

        {/* Description */}
        <div style={{
          padding: '8px 16px 10px',
          fontSize: 12, color: MUTED, lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {desc || flatmate.bio}
        </div>

        {/* Tap hint */}
        <div style={{
          padding: '6px 16px 11px', textAlign: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>
          <ChevronDown />
          <span style={{ fontSize: 11, color: ICON_CLR }}>Tap to see full profile</span>
        </div>
      </div>
    </div>
  )
}
