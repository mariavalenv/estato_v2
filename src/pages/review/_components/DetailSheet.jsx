import { useState, useEffect, useRef } from 'react'
import { PinkBlob } from '../../../components/ui/PinkBlob.jsx'
import { useAgentReplies } from '../../../hooks/useAgentReplies.js'
import { FLATMATES } from '../../../data/flatmates.js'
import { FlatmateSwipeSheet } from './FlatmateSwipeSheet.jsx'

const BORDER = '1px solid rgba(28,24,20,0.08)'
const MUTED = '#6E6660'
const DARK = '#1C1814'
const FAINT = 'rgba(28,24,20,0.26)'
const TABS = ['Overview', 'Property', 'Area', 'Contact']

/* ═══════════════════════════════════════════════════════════════ */
/*  Section label                                                 */
/* ═══════════════════════════════════════════════════════════════ */
function SectionLabel({ children, color }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
      letterSpacing: '0.09em', color: color || FAINT, margin: '0 0 10px',
    }}>{children}</p>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Agent chat (reusable per tab)                                 */
/* ═══════════════════════════════════════════════════════════════ */
function AgentChat({ listing, placeholder, initialMsg }) {
  const { getReply } = useAgentReplies(listing)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef(null)

  // Seed the opening message once
  useEffect(() => {
    if (initialMsg) {
      setMessages([{ id: 'init', role: 'agent', text: initialMsg }])
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  function send() {
    const txt = input.trim()
    if (!txt || typing) return
    setInput('')
    const userMsg = { id: `u-${Date.now()}`, role: 'user', text: txt }
    setMessages((m) => [...m, userMsg])
    setTyping(true)
    setTimeout(() => {
      const reply = getReply(txt)
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'agent', text: reply }])
      setTyping(false)
    }, 900 + Math.random() * 400)
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{
      background: '#EDE7DC', borderRadius: 16,
      border: BORDER, overflow: 'hidden',
    }}>
      {/* messages */}
      <div style={{
        maxHeight: 220, overflowY: 'auto',
        padding: '14px 14px 0',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {messages.map((m) => m.role === 'agent' ? (
          <div key={m.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <PinkBlob size={24} />
            <div style={{
              background: '#FAF6EF', border: BORDER,
              borderRadius: '10px 10px 10px 3px',
              padding: '8px 12px', fontSize: 13, lineHeight: 1.55,
              maxWidth: 280, color: DARK,
            }}>{m.text}</div>
          </div>
        ) : (
          <div key={m.id} style={{
            alignSelf: 'flex-end',
            background: 'rgba(109,40,217,0.07)',
            border: '1px solid rgba(109,40,217,0.16)',
            borderRadius: '10px 10px 3px 10px',
            padding: '8px 12px', fontSize: 13, lineHeight: 1.55,
            maxWidth: 280, color: DARK,
          }}>{m.text}</div>
        ))}
        {typing && (
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', paddingBottom: 6 }}>
            <PinkBlob size={24} />
            <div style={{
              background: '#FAF6EF', border: BORDER,
              borderRadius: '10px 10px 10px 3px',
              padding: '8px 12px', display: 'flex', gap: 4,
            }}>
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={bottomRef} style={{ height: 6 }} />
      </div>

      {/* input row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px', borderTop: BORDER,
      }}>
        <PinkBlob size={24} />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder || 'Ask about this listing…'}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontSize: 13, color: DARK, fontFamily: 'inherit',
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || typing}
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: input.trim() && !typing ? '#6D28D9' : '#EDE7DC',
            border: 'none', cursor: input.trim() && !typing ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: input.trim() && !typing ? '#fff' : FAINT,
            transition: 'background 150ms',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 11V3M4 5.5L7 3l3 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Commute icons                                                 */
/* ═══════════════════════════════════════════════════════════════ */
const commuteIcons = {
  metro: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="3.5" y="1.75" width="7" height="9.333" rx="1.75" stroke={MUTED} strokeWidth="1.1" />
      <path d="M3.5 8.167h7M5.25 10.5v1.75M8.75 10.5v1.75M5.833 5.25h2.334" stroke={MUTED} strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  walk: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7.583" cy="2.333" r="1.167" stroke={MUTED} strokeWidth="1.1" />
      <path d="M5.25 5.833l1.75 1.167 1.167 3.5M7 7l-1.75 2.333M8.167 7l1.166 2.333" stroke={MUTED} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  shop: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1.75 5.25l1.167-3.5h8.166l1.167 3.5" stroke={MUTED} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.333 5.25v5.833a1.167 1.167 0 001.167 1.167h7a1.167 1.167 0 001.167-1.167V5.25" stroke={MUTED} strokeWidth="1.1" />
      <path d="M5.25 5.25v1.167a1.75 1.75 0 01-3.5 0M8.75 5.25v1.167a1.75 1.75 0 01-3.5 0M12.25 5.25v1.167a1.75 1.75 0 01-3.5 0" stroke={MUTED} strokeWidth="1.1" />
    </svg>
  ),
  park: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 12.25V7M4.667 9.333S2.333 8.167 2.333 5.833a4.667 4.667 0 019.334 0c0 2.334-2.334 3.5-2.334 3.5" stroke={MUTED} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Feature icons for Property tab                                */
/* ═══════════════════════════════════════════════════════════════ */
const S = { stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }

const featureIcons = {
  Furnished: (
    <svg width="14" height="14" viewBox="0 0 14 14" {...S}>
      <path d="M2.333 11.083v-2.916M11.667 11.083v-2.916" />
      <path d="M1.75 8.167h10.5" />
      <rect x="3.5" y="4.083" width="7" height="4.083" rx="1" />
      <path d="M5.25 4.083V2.917M8.75 4.083V2.917" />
    </svg>
  ),
  'A/C': (
    <svg width="14" height="14" viewBox="0 0 14 14" {...S}>
      <path d="M7 1.75v10.5M7 1.75l2.333 2.333M7 1.75L4.667 4.083M7 12.25l2.333-2.333M7 12.25L4.667 9.917M1.75 7h10.5" />
    </svg>
  ),
  Heating: (
    <svg width="14" height="14" viewBox="0 0 14 14" {...S}>
      <path d="M7 1.75c1.75 1.75 1.75 3.5 0 5.25s-1.75 3.5 0 5.25M4.083 3.5c1.167 1.167 1.167 2.333 0 3.5s-1.167 2.333 0 3.5M9.917 3.5c1.167 1.167 1.167 2.333 0 3.5s-1.167 2.333 0 3.5" />
    </svg>
  ),
  Dishwasher: (
    <svg width="14" height="14" viewBox="0 0 14 14" {...S}>
      <rect x="2.333" y="2.333" width="9.333" height="9.333" rx="1.167" />
      <circle cx="7" cy="7.583" r="2.333" />
      <path d="M2.333 4.667h9.333" />
    </svg>
  ),
  Washer: (
    <svg width="14" height="14" viewBox="0 0 14 14" {...S}>
      <rect x="2.333" y="1.75" width="9.333" height="10.5" rx="1.167" />
      <circle cx="7" cy="7.583" r="2.333" />
      <path d="M2.333 4.083h9.333" />
      <circle cx="4.083" cy="2.917" r=".4" fill={MUTED} stroke="none" />
    </svg>
  ),
  'Pets OK': (
    <svg width="14" height="14" viewBox="0 0 14 14" {...S}>
      <circle cx="4.667" cy="3.5" r="1.167" />
      <circle cx="9.333" cy="3.5" r="1.167" />
      <circle cx="3.5" cy="6.417" r="1.167" />
      <circle cx="10.5" cy="6.417" r="1.167" />
      <path d="M5.25 9.333c0-1.167.783-2.333 1.75-2.333s1.75 1.166 1.75 2.333c0 1.167-1.75 2.917-1.75 2.917S5.25 10.5 5.25 9.333z" />
    </svg>
  ),
  'No smoking': (
    <svg width="14" height="14" viewBox="0 0 14 14" {...S}>
      <circle cx="7" cy="7" r="5.25" />
      <path d="M3.267 3.267l7.466 7.466" />
      <path d="M5.25 7h3.5" />
    </svg>
  ),
  Parking: (
    <svg width="14" height="14" viewBox="0 0 14 14" {...S}>
      <path d="M2.917 10.5h8.166M3.5 10.5V7l.875-3.5h5.25L10.5 7v3.5" />
      <circle cx="4.667" cy="10.5" r=".583" />
      <circle cx="9.333" cy="10.5" r=".583" />
      <path d="M3.5 7h7" />
    </svg>
  ),
  Lift: (
    <svg width="14" height="14" viewBox="0 0 14 14" {...S}>
      <rect x="2.917" y="1.75" width="8.167" height="10.5" rx="1.167" />
      <path d="M7 1.75v10.5M5.25 5.25L3.5 3.5l1.75-1.75M8.75 8.75l1.75 1.75-1.75 1.75" />
    </svg>
  ),
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Overview tab                                                  */
/* ═══════════════════════════════════════════════════════════════ */
function OverviewTab({ listing }) {
  const { price, bills, community, score, agentTake, commutes, reasons, tradeoffs } = listing
  const total = price + bills
  const matchLine = score >= 85 ? 'a strong match overall'
                  : score >= 70 ? 'a solid match with minor trade-offs'
                  : 'a reasonable match worth considering'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── What your agent calculated ─────────────────────────── */}
      <div style={{ padding: '20px 20px 0' }}>
        <SectionLabel>What your agent calculated</SectionLabel>

        {/* Calc rows */}
        {[
          { k: 'Monthly rent', v: `€${price.toLocaleString()}` },
          { k: 'Estimated bills', v: `+€${bills} est.` },
          { k: 'Community fee', v: community },
        ].map(({ k, v }) => (
          <div key={k} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '7px 0', borderBottom: BORDER,
          }}>
            <span style={{ fontSize: 13, color: MUTED }}>{k}</span>
            <span style={{ fontSize: 13, color: DARK }}>{v}</span>
          </div>
        ))}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          padding: '8px 0 0',
        }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: DARK }}>True monthly cost</span>
          <span style={{
            fontSize: 13, fontWeight: 500,
            color: total <= 1300 ? '#1A9E50' : DARK,
          }}>~€{total.toLocaleString()}</span>
        </div>

        {/* Agent take */}
        <div style={{ display: 'flex', gap: 9, paddingTop: 12 }}>
          <span style={{
            fontSize: 16, flexShrink: 0,
            background: 'linear-gradient(135deg,#C026D3,#6D28D9,#0EA5E9)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>✦</span>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: DARK, margin: 0 }}
            dangerouslySetInnerHTML={{ __html: agentTake }}
          />
        </div>

        {/* Match score bar */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
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
      </div>

      {/* ── Commute from here ──────────────────────────────────── */}
      <div style={{ padding: '0 20px' }}>
        <SectionLabel>Commute from here</SectionLabel>
        {commutes.map((c, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 0',
            borderBottom: i < commutes.length - 1 ? BORDER : 'none',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: '#EDE7DC',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {commuteIcons[c.mode] || commuteIcons.walk}
            </div>
            <span style={{ flex: 1, fontSize: 13, color: DARK }}>{c.dest}</span>
            <span style={{
              fontSize: 13, fontWeight: 500,
              color: c.rating === 'good' ? '#1A9E50' : c.rating === 'far' ? '#C07A00' : DARK,
            }}>{c.time}</span>
          </div>
        ))}
      </div>

      {/* ── Matched because ────────────────────────────────────── */}
      {reasons.length > 0 && (
        <div style={{ padding: '0 20px' }}>
          <SectionLabel>Matched because</SectionLabel>
          {reasons.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: '#1A9E50', flexShrink: 0, marginTop: 1 }}>✓</span>
              <span style={{ fontSize: 13, color: DARK, lineHeight: 1.45 }}>{r}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Trade-offs ─────────────────────────────────────────── */}
      {tradeoffs.length > 0 && (
        <div style={{ padding: '0 20px' }}>
          <SectionLabel color="#C07A00">Trade-offs to consider</SectionLabel>
          {tradeoffs.map((t, i) => (
            <div key={i} style={{
              display: 'flex', gap: 8, alignItems: 'flex-start',
              marginBottom: 6,
              paddingBottom: i === tradeoffs.length - 1 ? 8 : 0,
            }}>
              <span style={{ fontSize: 10, color: '#C07A00', flexShrink: 0, marginTop: 3 }}>▲</span>
              <span style={{ fontSize: 13, color: MUTED, lineHeight: 1.45 }}>{t}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Ask your agent ─────────────────────────────────────── */}
      <div style={{ padding: '0 20px 20px' }}>
        <SectionLabel>Ask your agent</SectionLabel>
        <AgentChat
          listing={listing}
          placeholder="Ask about this listing…"
          initialMsg={`I have reviewed this listing carefully. It scores ${score}% against your criteria — ${matchLine}. What would you like to know?`}
        />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Property tab                                                  */
/* ═══════════════════════════════════════════════════════════════ */
function PropertyTab({ listing }) {
  const { features, details, contract } = listing

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Features ───────────────────────────────────────────── */}
      <div style={{ padding: '20px 20px 0' }}>
        <SectionLabel>Features</SectionLabel>
        {features.map((f) => (
          <div key={f.label} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 0', borderBottom: BORDER,
            opacity: f.on ? 1 : 0.45,
          }}>
            <span style={{ color: MUTED, display: 'flex', flexShrink: 0 }}>
              {featureIcons[f.label] || null}
            </span>
            <span style={{ flex: 1, fontSize: 13, color: DARK }}>{f.label}</span>
            <span style={{
              fontSize: 12, fontWeight: 500,
              color: f.on ? '#1A9E50' : FAINT,
            }}>
              {f.on ? 'Available' : 'Not included'}
            </span>
          </div>
        ))}
      </div>

      {/* ── Property details ───────────────────────────────────── */}
      {details && (
        <div style={{ padding: '0 20px' }}>
          <SectionLabel>Property details</SectionLabel>
          {Object.entries(details).map(([k, v]) => (
            <div key={k} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '7px 0', borderBottom: BORDER,
            }}>
              <span style={{ fontSize: 13, color: MUTED }}>{k}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: DARK }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Contract & requirements ────────────────────────────── */}
      {contract && (
        <div style={{ padding: '0 20px' }}>
          <SectionLabel>Contract &amp; requirements</SectionLabel>
          {Object.entries(contract).map(([k, v]) => (
            <div key={k} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '7px 0', borderBottom: BORDER,
            }}>
              <span style={{ fontSize: 13, color: MUTED }}>{k}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: DARK }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Ask your agent ─────────────────────────────────────── */}
      <div style={{ padding: '0 20px 20px' }}>
        <SectionLabel>Ask your agent</SectionLabel>
        <AgentChat
          listing={listing}
          placeholder="Ask about features, floor, orientation…"
          initialMsg={`This property has ${listing.features.filter(f => f.on).length} of ${listing.features.length} features on your checklist. Want me to highlight anything specific?`}
        />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Nearby category icons                                         */
/* ═══════════════════════════════════════════════════════════════ */
const nearbyCatIcons = {
  Coffee: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1.75 4.667h8.167v4.666a2.333 2.333 0 01-2.334 2.334H4.083a2.333 2.333 0 01-2.333-2.334V4.667z" stroke={MUTED} strokeWidth="1.1" />
      <path d="M9.917 5.833h.583a1.75 1.75 0 010 3.5h-.583M4.083 1.75v1.75M5.833 1.75v1.75M7.583 1.75v1.75" stroke={MUTED} strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  Restaurants: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M4.667 1.75v10.5M4.667 5.833H2.917a1.167 1.167 0 01-1.167-1.166V1.75M4.667 5.833H6.417a1.167 1.167 0 001.166-1.166V1.75M10.5 1.75c0 2.333-.583 4.083-.583 4.083h1.166s-.583 1.75-.583 4.084v2.333" stroke={MUTED} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Supermarkets: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1.75 5.25l1.167-3.5h8.166l1.167 3.5" stroke={MUTED} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.333 5.25v5.833a1.167 1.167 0 001.167 1.167h7a1.167 1.167 0 001.167-1.167V5.25" stroke={MUTED} strokeWidth="1.1" />
    </svg>
  ),
  Parks: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 12.25V7M4.667 9.333S2.333 8.167 2.333 5.833a4.667 4.667 0 019.334 0c0 2.334-2.334 3.5-2.334 3.5" stroke={MUTED} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Gyms: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1.75 7h10.5M3.5 4.667v4.666M10.5 4.667v4.666M5.25 5.833v2.334M8.75 5.833v2.334" stroke={MUTED} strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Area tab                                                      */
/* ═══════════════════════════════════════════════════════════════ */
function AreaTab({ listing }) {
  const { address, nearby } = listing
  const categories = Object.keys(nearby || {})
  const [activeCat, setActiveCat] = useState(categories[0] || 'Coffee')
  const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_KEY
  const places = nearby?.[activeCat] || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Map */}
      <div style={{ padding: '20px 20px 0' }}>
        <SectionLabel>Map</SectionLabel>
        <div style={{
          borderRadius: 14, overflow: 'hidden', border: BORDER,
          height: 220, position: 'relative',
          background: 'linear-gradient(160deg, #EDE7DC, #D5CFC4)',
        }}>
          {mapsKey ? (
            <iframe
              title="Map"
              width="100%" height="100%" frameBorder="0" style={{ border: 0, display: 'block' }}
              loading="lazy" referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps/embed/v1/place?key=${mapsKey}&q=${encodeURIComponent(address)}&zoom=16`}
              allowFullScreen
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: MUTED,
            }}>
              Map unavailable
            </div>
          )}
          <a
            href={`https://www.google.com/maps/search/amenities+near+${encodeURIComponent(address)}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              position: 'absolute', bottom: 10, right: 10,
              padding: '4px 10px', borderRadius: 999,
              background: '#FAF6EF', color: '#6D28D9',
              border: BORDER, fontSize: 11, textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Open in Maps
          </a>
        </div>
      </div>

      {/* Category pills */}
      <div style={{ padding: '0 20px' }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCat(cat)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 999, whiteSpace: 'nowrap',
              fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0,
              background: activeCat === cat ? '#EDE7DC' : 'transparent',
              border: `1px solid ${activeCat === cat ? 'rgba(28,24,20,0.15)' : 'rgba(28,24,20,0.08)'}`,
              color: activeCat === cat ? DARK : MUTED,
              transition: 'background 150ms, border-color 150ms',
            }}>
              {nearbyCatIcons[cat] || null}
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Place rows */}
      <div style={{ padding: '0 20px 20px' }}>
        {places.map((p, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 0',
            borderBottom: i < places.length - 1 ? BORDER : 'none',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: '#EDE7DC', border: BORDER,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {nearbyCatIcons[activeCat] || null}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, color: DARK, lineHeight: 1.3, margin: 0 }}>{p.name}</p>
              <p style={{ fontSize: 11, color: MUTED, margin: '1px 0 0' }}>{p.type}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: DARK }}>{p.dist}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, color: MUTED }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M5 1.5l1.1 2.2 2.4.35-1.75 1.7.42 2.4L5 7.1l-2.17 1.05.42-2.4L1.5 4.05l2.4-.35L5 1.5z" fill="#C07A00" />
                </svg>
                {p.rating}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Draft panel (shared)                                          */
/* ═══════════════════════════════════════════════════════════════ */
function DraftPanel({ label, draftText, accentLabel }) {
  const [text, setText] = useState(draftText)
  const [sent, setSent] = useState(false)

  function handleSend() {
    setSent(true)
    setTimeout(() => setSent(false), 2000)
  }

  return (
    <div style={{ background: '#EDE7DC', borderRadius: 14, border: BORDER, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: BORDER }}>
        <span style={{ fontSize: 11, color: MUTED }}>{label}</span>
        {accentLabel && (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(109,40,217,0.07)', color: '#6D28D9', border: '1px solid rgba(109,40,217,0.16)' }}>{accentLabel}</span>
        )}
      </div>
      <textarea
        value={text} onChange={e => setText(e.target.value)}
        style={{
          width: '100%', minHeight: 110, padding: '10px 14px',
          background: 'transparent', border: 'none', outline: 'none',
          fontSize: 13, lineHeight: 1.6, fontFamily: 'inherit',
          resize: 'none', color: DARK, boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderTop: BORDER }}>
        <span style={{ fontSize: 11, color: FAINT }}>Edit freely — it is your message</span>
        <button onClick={handleSend} style={{
          padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
          fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
          background: sent ? '#1A9E50' : '#6D28D9', color: '#fff',
          transition: 'background 200ms',
        }}>
          {sent ? '✓ Sent' : 'Send'}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Contact tab                                                   */
/* ═══════════════════════════════════════════════════════════════ */
function ContactTab({ listing, onOpenSwipe }) {
  const { landlord, address, price } = listing
  const [draftOpen, setDraftOpen] = useState(false)

  const draftMsg = `Dear ${landlord?.name || 'Landlord'},\n\nI am writing to express my interest in the property at ${address}. I am looking for a long-term rental and your listing at €${price}/mo fits my criteria well.\n\nWould it be possible to arrange a viewing at your earliest convenience?\n\nThank you for your time.\n\nBest regards`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Landlord */}
      <div style={{ padding: '20px 20px 0' }}>
        <SectionLabel>Landlord</SectionLabel>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 11,
          padding: '12px 14px', background: '#EDE7DC',
          borderRadius: 12, border: BORDER,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: '#E4DDD0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 500, color: MUTED, flexShrink: 0,
          }}>
            {landlord?.initial || '?'}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: DARK, margin: 0 }}>{landlord?.name}</p>
            <p style={{ fontSize: 11, color: MUTED, margin: '1px 0 0' }}>{landlord?.sub}</p>
          </div>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 3,
            padding: '3px 8px', borderRadius: 999, fontSize: 10,
            color: '#1A9E50', background: 'rgba(26,158,80,0.09)',
            border: '1px solid rgba(26,158,80,0.18)',
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2.5 5.5l2 2 3.5-4" stroke="#1A9E50" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Verified
          </span>
        </div>

        {/* Request a viewing */}
        <button
          onClick={() => setDraftOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', padding: '11px 16px', marginTop: 10,
            borderRadius: 12, background: '#EDE7DC', border: BORDER,
            fontSize: 13, color: MUTED, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Request a viewing
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            style={{ transform: draftOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 200ms ease' }}>
            <path d="M3 4.5l3 3 3-3" stroke={MUTED} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Draft panel */}
        <div style={{
          maxHeight: draftOpen ? 400 : 0,
          overflow: 'hidden',
          transition: 'max-height 300ms ease',
          marginTop: draftOpen ? 10 : 0,
        }}>
          <DraftPanel
            label="Message to landlord"
            draftText={draftMsg}
            accentLabel="Drafted by your agent"
          />
        </div>
      </div>

      {/* Also interested — compact list */}
      <div style={{ padding: '0 20px 20px' }}>
        <SectionLabel>Also interested in this listing</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FLATMATES.map((fm, i) => (
            <div
              key={fm.id}
              onClick={() => onOpenSwipe(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '12px 14px', background: '#EDE7DC',
                borderRadius: 12, border: BORDER, cursor: 'pointer',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: '#E4DDD0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 500, color: MUTED, flexShrink: 0,
              }}>
                {fm.initial}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: DARK, margin: 0 }}>{fm.name}</p>
                <p style={{ fontSize: 11, color: MUTED, margin: '1px 0 0' }}>{fm.age} · {fm.occupation}</p>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 500, color: '#6D28D9',
                whiteSpace: 'nowrap',
              }}>
                See all {FLATMATES.length} →
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
/*  DetailSheet                                                   */
/* ═══════════════════════════════════════════════════════════════ */
export function DetailSheet({ listing, open, onClose, onPass, onKeep, compact, zIndex: zIndexProp }) {
  const [tab, setTab] = useState(0)
  const [kept, setKept] = useState(false)
  const [flatmateSwipeOpen, setFlatmateSwipeOpen] = useState(false)
  const [startFlatmateIdx, setStartFlatmateIdx] = useState(0)

  // Reset state when listing changes or sheet opens
  useEffect(() => {
    if (open) { setTab(0); setKept(false); setFlatmateSwipeOpen(false) }
  }, [open, listing?.id])

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  // Escape key to close
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!listing) return null

  const { image, score, photos, address } = listing
  const shortAddr = address?.split(',')[0] || 'Listing'

  function handleKeep() {
    setKept(true)
    setTimeout(() => { onKeep(); onClose() }, 600)
  }

  function handlePass() {
    onPass()
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: zIndexProp || 50,
      pointerEvents: open ? 'auto' : 'none',
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(28,24,20,0.18)',
          backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
          opacity: open ? 1 : 0,
          transition: 'opacity 350ms ease',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'absolute', bottom: 0,
        left: compact ? '50%' : 0,
        right: compact ? 'auto' : 0,
        width: compact ? 'min(520px, 92vw)' : '100%',
        marginLeft: compact ? 0 : undefined,
        transform: compact
          ? (open ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100%)')
          : (open ? 'translateY(0)' : 'translateY(100%)'),
        height: compact ? '85vh' : '92vh',
        background: '#FAF6EF',
        borderRadius: compact ? '22px 22px 0 0' : '22px 22px 0 0',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transition: 'transform 380ms cubic-bezier(.4,0,.2,1)',
        boxShadow: compact ? '0 -4px 40px rgba(28,24,20,0.10)' : 'none',
      }}>

        {/* ── Header ───────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: BORDER, flexShrink: 0,
          position: 'relative',
        }}>
          {/* Handle bar */}
          <div style={{
            position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
            width: 36, height: 4, borderRadius: 999, background: '#EDE7DC',
          }} />
          {/* Title */}
          <span style={{ fontSize: 15, fontWeight: 500, color: DARK }}>{shortAddr}</span>
          {/* Right actions */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Save pill */}
            <button style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 999,
              background: '#EDE7DC', border: BORDER,
              fontSize: 12, color: MUTED, cursor: 'pointer',
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 10.5s-4.5-2.75-4.5-5.75a2.5 2.5 0 015 0 2.5 2.5 0 015 0c0 3-4.5 5.75-4.5 5.75z" stroke={MUTED} strokeWidth="1.1" strokeLinejoin="round" />
              </svg>
              Save
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              style={{
                width: 26, height: 26, borderRadius: '50%',
                background: '#EDE7DC', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: MUTED, padding: 0,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Photo hero ───────────────────────────────────────── */}
        <div style={{
          height: 240, flexShrink: 0, position: 'relative', overflow: 'hidden',
        }}>
          {image ? (
            <img src={image} alt="" style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
            }} />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: 'linear-gradient(160deg, #EDE7DC, #D5CFC4)',
            }} />
          )}
          {/* Score badge */}
          <span style={{
            position: 'absolute', bottom: 12, left: 12,
            padding: '4px 10px', borderRadius: 999,
            fontSize: 11, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap',
            background: score >= 80 ? '#6D28D9' : score >= 65 ? 'rgba(192,122,0,0.85)' : 'rgba(209,54,54,0.85)',
          }}>
            {score}% match
          </span>
          {/* Photo dots */}
          <div style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 5,
          }}>
            {Array.from({ length: Math.min(photos, 5) }).map((_, i) => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i === 0 ? '#fff' : 'rgba(255,255,255,0.5)',
              }} />
            ))}
          </div>
        </div>

        {/* ── Tab bar ──────────────────────────────────────────── */}
        <div style={{
          display: 'flex', borderBottom: BORDER, flexShrink: 0,
          padding: '0 4px',
        }}>
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              style={{
                flex: 1, padding: '11px 4px 10px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                color: tab === i ? '#6D28D9' : MUTED,
                borderBottom: tab === i ? '2px solid #6D28D9' : '2px solid transparent',
                transition: 'color 150ms, border-color 150ms',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Scrollable body ──────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tab === 0 && <OverviewTab listing={listing} />}
          {tab === 1 && <PropertyTab listing={listing} />}
          {tab === 2 && <AreaTab listing={listing} />}
          {tab === 3 && <ContactTab listing={listing} onOpenSwipe={(idx) => { setStartFlatmateIdx(idx); setFlatmateSwipeOpen(true) }} />}
        </div>

        {/* ── Footer ───────────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 10, padding: '14px 20px',
          borderTop: BORDER, flexShrink: 0,
        }}>
          <button
            onClick={handlePass}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 12,
              background: 'transparent',
              border: '1px solid rgba(28,24,20,0.12)',
              color: 'rgba(28,24,20,0.45)',
              fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            Pass
          </button>
          <button
            onClick={handleKeep}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 12,
              background: kept ? '#1A9E50' : '#6D28D9',
              border: 'none', color: '#fff',
              fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'background 200ms ease',
            }}
          >
            {kept ? '✓ Kept' : 'Keep'}
          </button>
        </div>
      </div>

      {/* FlatmateSwipeSheet layered on top */}
      <FlatmateSwipeSheet
        flatmates={FLATMATES}
        listing={listing}
        startIdx={startFlatmateIdx}
        open={flatmateSwipeOpen}
        onClose={() => setFlatmateSwipeOpen(false)}
      />

    </div>
  )
}
