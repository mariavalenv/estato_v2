import { useState, useEffect } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, Bed, Bath, Maximize2, Clock, Zap, Wifi, Landmark, Send, X } from 'lucide-react'
import { DUMMY_FLATMATES } from '../data/dummyListings'
import { trackEvent, startListingTimer, endListingTimer } from '../lib/tracking.js'
import { useWheelSwipe } from '../hooks/useWheelSwipe.js'

/* ── Image Carousel ─────────────────────────────────────────────────────── */

function Carousel({ images, alt }) {
  const [idx, setIdx] = useState(0)
  if (!images?.length) return null

  const prev = (e) => { e.stopPropagation(); setIdx((i) => (i - 1 + images.length) % images.length) }
  const next = (e) => { e.stopPropagation(); setIdx((i) => (i + 1) % images.length) }

  return (
    <div style={{ position: 'relative', width: '100%', height: 220, overflow: 'hidden', flexShrink: 0 }}>
      <img
        src={images[idx]}
        alt={alt}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'opacity 200ms' }}
      />
      {images.length > 1 && (
        <>
          <button onClick={prev} style={arrowBtn('left')}><ChevronLeft size={14} /></button>
          <button onClick={next} style={arrowBtn('right')}><ChevronRight size={14} /></button>
          <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', gap: 4 }}>
            {images.map((_, i) => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i === idx ? '#fff' : 'rgba(255,255,255,0.4)',
                transition: 'background 200ms',
              }} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function arrowBtn(side) {
  return {
    position: 'absolute', [side]: 10, top: '50%', transform: 'translateY(-50%)',
    width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer',
    background: 'rgba(0,0,0,0.5)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
}

/* ── Flatmate Profile Overlay ────────────────────────────────────────────── */

function FlatmateProfileOverlay({ flatmate, onClose, listingId }) {
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  function handleSend() {
    if (!message.trim()) return
    // Enquiring about this place via one of its flatmates = a contact action.
    trackEvent('listing_contact', listingId, { via: 'flatmate', flatmate_id: flatmate.id })
    // Placeholder — wire to real messaging when available
    setSent(true)
    setTimeout(() => { setSent(false); setMessage('') }, 3000)
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10,
      background: 'var(--background)',
      display: 'flex', flexDirection: 'column',
      animation: 'slideInRight 220ms ease',
    }}>
      <style>{`@keyframes slideInRight { from { transform: translateX(100%); opacity:0 } to { transform: translateX(0); opacity:1 } }`}</style>

      {/* Header */}
      <div style={{
        flexShrink: 0, height: 52, padding: '0 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid rgba(0,0,0,0.07)',
      }}>
        <button onClick={onClose} style={iconBtn}>
          <ArrowLeft size={16} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          {flatmate.name}'s profile
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 100px' }}>
        {/* Avatar + name */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 20 }}>
          <img
            src={flatmate.photo}
            alt={flatmate.name}
            style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
          <div>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{flatmate.name}</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{flatmate.age} · {flatmate.jobTitle}</p>
            <p style={{ fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>{flatmate.company}</p>
          </div>
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
          {flatmate.tags.map((t) => (
            <span key={t} style={tagChip}>{t}</span>
          ))}
        </div>

        {/* Bio */}
        <div style={section}>
          <p style={sectionLabel}>About</p>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-secondary)' }}>{flatmate.bio}</p>
        </div>

        {/* Quick facts */}
        <div style={section}>
          <p style={sectionLabel}>Details</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <FactRow icon="💰" label="Budget" value={flatmate.budget} />
            <FactRow icon="📅" label="Move-in" value={flatmate.moveIn} />
            <FactRow icon="🌍" label="Languages" value={flatmate.languages.join(', ')} />
            <FactRow icon="🏡" label="Lifestyle" value={flatmate.lifestyle} />
          </div>
        </div>
      </div>

      {/* Message bar — pinned to bottom */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '12px 16px',
        background: 'var(--surface)',
        borderTop: '1px solid rgba(0,0,0,0.07)',
        display: 'flex', gap: 10, alignItems: 'center',
      }}>
        {sent ? (
          <p style={{ flex: 1, fontSize: 14, color: 'var(--success)', fontWeight: 500, textAlign: 'center' }}>
            Message sent! ✓
          </p>
        ) : (
          <>
            <input
              type="text"
              placeholder={`Say hi to ${flatmate.name.split(' ')[0]}…`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              style={{
                flex: 1, background: 'var(--background)', border: '1px solid rgba(0,0,0,0.10)',
                borderRadius: 8, padding: '8px 12px', fontSize: 14,
                color: 'var(--text-primary)', outline: 'none',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!message.trim()}
              style={{
                width: 38, height: 38, borderRadius: '50%',
                background: message.trim() ? 'var(--accent)' : 'rgba(99,134,241,0.25)',
                border: 'none', cursor: message.trim() ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 200ms',
              }}
            >
              <Send size={15} color="#fff" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Flatmate Card ─────────────────────────────────────────────────────── */

function FlatmateCard({ flatmate, onClick }) {
  return (
    <div
      onClick={() => onClick(flatmate)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center',
        padding: '12px 10px', borderRadius: 8,
        background: 'var(--surface)', cursor: 'pointer',
        transition: 'opacity 200ms',
        border: '1px solid rgba(0,0,0,0.05)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8' }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
    >
      <img
        src={flatmate.photo}
        alt={flatmate.name}
        style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{flatmate.name}</p>
      <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.3 }}>{flatmate.age} · {flatmate.jobTitle}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
        {flatmate.tags.slice(0, 2).map((t) => (
          <span key={t} style={{ ...tagChip, fontSize: 10, padding: '1px 6px' }}>{t}</span>
        ))}
      </div>
    </div>
  )
}

/* ── Shared micro-components ─────────────────────────────────────────────── */

function FactRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0, minWidth: 60 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function CommuteRow({ item }) {
  const modeIcon = item.mode.includes('tube') || item.mode.includes('metro') ? '🚇'
    : item.mode.includes('walk') ? '🚶'
    : item.mode.includes('tram') ? '🚊'
    : item.mode.includes('cycle') ? '🚲'
    : '🚌'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 14 }}>{modeIcon}</span>
        <span style={{ fontSize: 13, color: 'var(--section-body, var(--text-secondary))', lineHeight: 1.4 }}>{item.destination}</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--section-body, var(--text-primary))', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.time}</span>
    </div>
  )
}

function AmenityChip({ item }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      padding: '8px 10px', borderRadius: 8,
      background: 'var(--surface)',
      border: '1px solid rgba(0,0,0,0.05)',
    }}>
      <span style={{ fontSize: 14 }}>{item.icon}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>{item.name}</span>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.distance}</span>
    </div>
  )
}

/* ── Shared styles ────────────────────────────────────────────────────────── */

const section = { marginBottom: 20 }
const sectionLabel = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
  color: 'var(--section-label, var(--text-secondary))', textTransform: 'uppercase', marginBottom: 10,
}
const tagChip = {
  display: 'inline-block', padding: '3px 8px', borderRadius: 999, fontSize: 11,
  background: 'var(--accent-muted)', color: 'var(--accent)',
}
const iconBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
  padding: 4, borderRadius: 6,
}

/* ── Main Detail Panel ────────────────────────────────────────────────────── */

export function ListingDetailPanel({ listing, onBack, onPass, onKeep }) {
  const [activeFlatmate, setActiveFlatmate] = useState(null)

  // Time spent on this listing: start on open, log listing_view on close.
  useEffect(() => {
    startListingTimer(listing.id)
    return () => endListingTimer(listing.id)
  }, [listing.id])

  // Scroll left → pass · scroll right → keep, same gesture as the swipe deck.
  // Disabled while the flatmate overlay is open so it doesn't fire underneath.
  const [swipe, setSwipe] = useState(0)   // live progress -1..1 for the tint overlay
  const swipeRef = useWheelSwipe({
    onLeft: () => onPass?.(listing),
    onRight: () => onKeep?.(listing),
    onProgress: setSwipe,
    enabled: !activeFlatmate && (!!onPass || !!onKeep),
  })
  const swipeDir = swipe > 0.04 ? 'keep' : swipe < -0.04 ? 'pass' : null
  const swipeStrength = Math.min(1, Math.abs(swipe) / 0.4)   // ramp to full quickly

  const flatmates = (listing.flatmateIds || [])
    .map((id) => DUMMY_FLATMATES.find((f) => f.id === id))
    .filter(Boolean)

  const c = listing.monthlyCosts || {}
  const currency = c.currency || '€'
  const beds = listing.bedrooms === 0 ? 'Studio' : `${listing.bedrooms} bed${listing.bedrooms !== 1 ? 's' : ''}`

  return (
    <div ref={swipeRef} style={{
      position: 'relative',
      flex: 1, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: 'var(--background)',
      borderRadius: 16,
      overscrollBehaviorX: 'none', touchAction: 'pan-y',
      transform: `translateX(${swipe * 110}px) rotate(${swipe * 3}deg)`,
      transition: 'transform 200ms cubic-bezier(.34,1.56,.64,1)',
    }}>
      {/* ── Scroll-swipe feedback: directional tint + PASS/KEEP label ── */}
      {swipeDir && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none',
          borderRadius: 16,
          background: swipeDir === 'keep'
            ? `linear-gradient(to left, rgba(26,158,80,${0.32 * swipeStrength}), transparent 65%)`
            : `linear-gradient(to right, rgba(209,54,54,${0.32 * swipeStrength}), transparent 65%)`,
        }}>
          <span style={{
            position: 'absolute', top: 64,
            [swipeDir === 'keep' ? 'right' : 'left']: 20,
            color: swipeDir === 'keep' ? '#1A9E50' : '#D13636',
            border: `2px solid ${swipeDir === 'keep' ? '#1A9E50' : '#D13636'}`,
            borderRadius: 8, padding: '6px 14px', fontSize: 16, fontWeight: 700,
            letterSpacing: '0.06em', opacity: swipeStrength,
            transform: `rotate(${swipeDir === 'keep' ? -8 : 8}deg)`,
          }}>{swipeDir === 'keep' ? 'KEEP' : 'PASS'}</span>
        </div>
      )}
      {/* ── Header ── */}
      <div style={{
        flexShrink: 0, height: 52, padding: '0 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid rgba(0,0,0,0.07)',
      }}>
        <button onClick={onBack} style={iconBtn}>
          <ArrowLeft size={16} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {listing.title}
        </span>
        {listing.tag && (
          <span style={{ ...tagChip, fontSize: 11, flexShrink: 0 }}>{listing.tag}</span>
        )}
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Images */}
        <div onClick={() => trackEvent('listing_click', listing.id, { section: 'photos' })}>
          <Carousel images={listing.images || [listing.image]} alt={listing.title} />
        </div>

        <div style={{ padding: '20px 20px 32px' }}>

          {/* Price + key stats */}
          <div style={{ marginBottom: 20 }} onClick={() => trackEvent('listing_click', listing.id, { section: 'price' })}>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              {currency}{listing.price.toLocaleString()}/mo
            </p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <StatPill icon={<MapPin size={12} />} label={`${listing.area}, ${listing.city}`} />
              <StatPill icon={<Bed size={12} />} label={beds} />
              {listing.bathrooms && <StatPill icon={<Bath size={12} />} label={`${listing.bathrooms} bath`} />}
              {listing.sqm && <StatPill icon={<Maximize2 size={12} />} label={`${listing.sqm} m²`} />}
            </div>
          </div>

          {/* Description */}
          <div style={section} onClick={() => trackEvent('listing_click', listing.id, { section: 'details' })}>
            <p style={sectionLabel}>About this property</p>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--section-body, var(--text-secondary))' }}>
              {listing.description}
            </p>
          </div>

          {/* Commute */}
          {listing.commute?.length > 0 && (
            <div style={section} onClick={() => trackEvent('listing_click', listing.id, { section: 'map' })}>
              <p style={sectionLabel}>Commute times</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {listing.commute.map((item) => (
                  <CommuteRow key={item.destination} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* Estimated costs */}
          {c.utilities && (
            <div style={section}>
              <p style={sectionLabel}>Estimated monthly costs</p>
              <div style={{
                padding: 12, borderRadius: 8,
                background: 'var(--surface)',
                border: '1px solid rgba(0,0,0,0.05)',
                marginBottom: 12,
              }}>
                <p style={{ fontSize: 11, color: '#ca8a04', lineHeight: 1.5 }}>
                  ⚠️ These are estimates based on typical costs for this type of property and area. They are not official figures and may vary significantly.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CostRow icon={<Zap size={13} />} label={c.utilities.label} amount={`${currency}${c.utilities.amount}/mo`} />
                <CostRow icon={<Wifi size={13} />} label={c.wifi.label} amount={`${currency}${c.wifi.amount}/mo`} />
                {c.councilTax && (
                  <CostRow icon={<Landmark size={13} />} label={c.councilTax.label} amount={`${currency}${c.councilTax.amount}/mo`} />
                )}
              </div>
            </div>
          )}

          {/* Amenities */}
          {listing.amenities?.length > 0 && (
            <div style={section}>
              <p style={sectionLabel}>Nearby amenities</p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                gap: 8,
              }}>
                {listing.amenities.map((a) => (
                  <AmenityChip key={a.name} item={a} />
                ))}
              </div>
            </div>
          )}

          {/* Potential flatmates */}
          {flatmates.length > 0 && (
            <div style={section}>
              <p style={sectionLabel}>Potential flatmates</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                People looking at this property who could be a good match for sharing.
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                gap: 8,
              }}>
                {flatmates.map((f) => (
                  <FlatmateCard key={f.id} flatmate={f} onClick={setActiveFlatmate} />
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Flatmate profile overlay — slides over the panel */}
      {activeFlatmate && (
        <FlatmateProfileOverlay
          flatmate={activeFlatmate}
          onClose={() => setActiveFlatmate(null)}
          listingId={listing.id}
        />
      )}
    </div>
  )
}

/* ── Inline micro helpers ─────────────────────────────────────────────────── */

function StatPill({ icon, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
      {icon}{label}
    </span>
  )
}

function CostRow({ icon, label, amount }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: 'var(--section-body, var(--text-secondary))', display: 'flex', alignItems: 'center' }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--section-body, var(--text-secondary))' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--section-body, var(--text-primary))' }}>{amount}</span>
    </div>
  )
}
