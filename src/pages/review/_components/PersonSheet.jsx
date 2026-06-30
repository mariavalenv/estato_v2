import { useState, useEffect, useRef } from 'react'
import { PinkBlob } from '../../../components/ui/PinkBlob.jsx'

const BORDER = '1px solid rgba(28,24,20,0.08)'
const MUTED = '#6E6660'
const DARK = '#1C1814'
const FAINT = 'rgba(28,24,20,0.26)'
const P_TABS = ['Profile', 'Lifestyle', 'Message']

/* ── helpers ───────────────────────────────────────────────────── */
function SectionLabel({ children, color }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
      letterSpacing: '0.09em', color: color || FAINT, margin: '0 0 10px',
    }}>{children}</p>
  )
}

/* ── flatmate-specific agent replies ───────────────────────────── */
function useFlatmateReplies(fm) {
  function getReply(text) {
    const l = text.toLowerCase()
    if (l.includes('clean'))            return fm.cleanNote
    if (l.includes('work') || l.includes('schedule')) {
      const wh = fm.routine.find(r => r.label === 'Work hours')
      return wh ? `${fm.name.split(' ')[0]} works ${wh.val}.` : 'I don\'t have specific work schedule details.'
    }
    if (l.includes('guest') || l.includes('party')) {
      const g = fm.habits.find(h => h.label === 'Guests')
      const p = fm.habits.find(h => h.label === 'Parties')
      return `Guests: ${g?.val || 'Unknown'}. Parties: ${p?.val || 'Unknown'}.`
    }
    if (l.includes('budget') || l.includes('money')) {
      return `${fm.name.split(' ')[0]}'s budget ceiling is ${fm.looking['Budget ceiling']}.`
    }
    if (l.includes('pet') || l.includes('cat') || l.includes('dog'))
      return `Regarding pets: ${fm.looking['Pets']}.`
    if (l.includes('area') || l.includes('location'))
      return `They are looking in: ${fm.looking['Areas']}.`
    return `Good question. The main compatibility factor is: ${fm.reasons?.[0]?.toLowerCase() || 'similar lifestyle preferences'}.`
  }
  return { getReply }
}

/* ── Agent chat (flatmate variant) ─────────────────────────────── */
function FlatmateChat({ flatmate, placeholder, initialMsg }) {
  const { getReply } = useFlatmateReplies(flatmate)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (initialMsg) setMessages([{ id: 'init', role: 'agent', text: initialMsg }])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  function send() {
    const txt = input.trim()
    if (!txt || typing) return
    setInput('')
    setMessages(m => [...m, { id: `u-${Date.now()}`, role: 'user', text: txt }])
    setTyping(true)
    setTimeout(() => {
      setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'agent', text: getReply(txt) }])
      setTyping(false)
    }, 900 + Math.random() * 400)
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{ background: '#EDE7DC', borderRadius: 16, border: BORDER, overflow: 'hidden' }}>
      <div style={{ maxHeight: 220, overflowY: 'auto', padding: '14px 14px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map(m => m.role === 'agent' ? (
          <div key={m.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <PinkBlob size={24} />
            <div style={{ background: '#FAF6EF', border: BORDER, borderRadius: '10px 10px 10px 3px', padding: '8px 12px', fontSize: 13, lineHeight: 1.55, maxWidth: 280, color: DARK }}>{m.text}</div>
          </div>
        ) : (
          <div key={m.id} style={{ alignSelf: 'flex-end', background: 'rgba(109,40,217,0.07)', border: '1px solid rgba(109,40,217,0.16)', borderRadius: '10px 10px 3px 10px', padding: '8px 12px', fontSize: 13, lineHeight: 1.55, maxWidth: 280, color: DARK }}>{m.text}</div>
        ))}
        {typing && (
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', paddingBottom: 6 }}>
            <PinkBlob size={24} />
            <div style={{ background: '#FAF6EF', border: BORDER, borderRadius: '10px 10px 10px 3px', padding: '8px 12px', display: 'flex', gap: 4 }}>
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={bottomRef} style={{ height: 6 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: BORDER }}>
        <PinkBlob size={24} />
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
          placeholder={placeholder || 'Ask about compatibility…'}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: DARK, fontFamily: 'inherit' }}
        />
        <button onClick={send} disabled={!input.trim() || typing} style={{
          width: 28, height: 28, borderRadius: '50%',
          background: input.trim() && !typing ? '#6D28D9' : '#EDE7DC',
          border: 'none', cursor: input.trim() && !typing ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: input.trim() && !typing ? '#fff' : FAINT, transition: 'background 150ms',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 11V3M4 5.5L7 3l3 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/* ── Draft panel ───────────────────────────────────────────────── */
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
        value={text}
        onChange={e => setText(e.target.value)}
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
/*  Profile tab                                                   */
/* ═══════════════════════════════════════════════════════════════ */
function ProfileTab({ flatmate }) {
  const { bio, reasons, tradeoffs, looking } = flatmate
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ padding: '20px 20px 0' }}>
        <SectionLabel>About</SectionLabel>
        <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.65, margin: 0 }}>{bio}</p>
      </div>

      {reasons.length > 0 && (
        <div style={{ padding: '0 20px' }}>
          <SectionLabel>Why your agent matched you</SectionLabel>
          {reasons.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: '#1A9E50', flexShrink: 0, marginTop: 1 }}>✓</span>
              <span style={{ fontSize: 13, color: DARK, lineHeight: 1.45 }}>{r}</span>
            </div>
          ))}
        </div>
      )}

      {tradeoffs.length > 0 && (
        <div style={{ padding: '0 20px' }}>
          <SectionLabel color="#C07A00">Things to discuss</SectionLabel>
          {tradeoffs.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: '#C07A00', flexShrink: 0, marginTop: 3 }}>▲</span>
              <span style={{ fontSize: 13, color: MUTED, lineHeight: 1.45 }}>{t}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '0 20px 20px' }}>
        <SectionLabel>Looking for</SectionLabel>
        {Object.entries(looking).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: BORDER }}>
            <span style={{ fontSize: 13, color: MUTED }}>{k}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: DARK }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Lifestyle tab                                                 */
/* ═══════════════════════════════════════════════════════════════ */
function LifestyleTab({ flatmate }) {
  const { routine, habits, cleanScore, cleanLabel, cleanNote } = flatmate
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ padding: '20px 20px 0' }}>
        <SectionLabel>Daily routine</SectionLabel>
        {routine.map((r, i) => (
          <div key={i} style={{ display: 'flex', padding: '7px 0', borderBottom: BORDER }}>
            <span style={{ fontSize: 12, color: MUTED, minWidth: 90 }}>{r.label}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: DARK }}>{r.val}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 20px' }}>
        <SectionLabel>Habits &amp; preferences</SectionLabel>
        {habits.map((h, i) => (
          <div key={i} style={{ display: 'flex', padding: '7px 0', borderBottom: BORDER }}>
            <span style={{ fontSize: 12, color: MUTED, minWidth: 90 }}>{h.label}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: DARK }}>{h.val}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        <SectionLabel>Cleanliness</SectionLabel>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: MUTED }}>{cleanLabel}</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#6D28D9' }}>{cleanScore}/5</span>
        </div>
        <div style={{ height: 4, background: '#EDE7DC', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${(cleanScore / 5) * 100}%`, borderRadius: 2,
            background: 'linear-gradient(90deg, #818cf8, #6D28D9)',
          }} />
        </div>
        <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginTop: 8 }}>{cleanNote}</p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Message tab                                                   */
/* ═══════════════════════════════════════════════════════════════ */
function MessageTab({ flatmate }) {
  const firstName = flatmate.name.split(' ')[0]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ padding: '20px 20px 0' }}>
        <SectionLabel>Message to flatmate</SectionLabel>
        <DraftPanel
          label={`Message to ${firstName}`}
          draftText={flatmate.draftMsg}
          accentLabel="Drafted by your agent"
        />
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        <SectionLabel>Ask your agent about this match</SectionLabel>
        <FlatmateChat
          flatmate={flatmate}
          placeholder="Ask about compatibility…"
          initialMsg={`${firstName} is a ${flatmate.age}-year-old ${flatmate.occupation.toLowerCase()} with a ${flatmate.score}% compatibility score. Their strongest match factor is: ${flatmate.reasons[0]?.toLowerCase() || 'similar lifestyle'}. What would you like to know?`}
        />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
/*  PersonSheet                                                   */
/* ═══════════════════════════════════════════════════════════════ */
export function PersonSheet({ flatmate, open, onClose }) {
  const [tab, setTab] = useState(0)
  const [connected, setConnected] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (open) { setTab(0); setConnected(false); setToast(null) }
  }, [open, flatmate?.id])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!flatmate) return null

  const { initial, name, age, occupation, score, tags } = flatmate

  function handleConnect() {
    setConnected(true)
    setToast(`Connection request sent to ${name}`)
    setTimeout(() => { setToast(null); onClose() }, 800)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, pointerEvents: open ? 'auto' : 'none' }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(28,24,20,0.18)',
        backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
        opacity: open ? 1 : 0, transition: 'opacity 350ms ease',
      }} />

      {/* Panel */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '66vh', background: '#FAF6EF',
        borderRadius: '22px 22px 0 0',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 380ms cubic-bezier(.4,0,.2,1)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: BORDER, flexShrink: 0, position: 'relative',
        }}>
          <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 36, height: 4, borderRadius: 999, background: '#EDE7DC' }} />
          <span style={{ fontSize: 15, fontWeight: 500, color: DARK }}>{name}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
            <button onClick={onClose} style={{
              width: 26, height: 26, borderRadius: '50%',
              background: '#EDE7DC', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: MUTED, padding: 0,
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Hero */}
        <div style={{
          padding: '20px 20px 16px', borderBottom: BORDER,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(135deg,#EAE4D8,#D5CFC4)',
              border: BORDER,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 500, color: MUTED,
            }}>
              {initial}
            </div>
            <span style={{
              position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
              padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap',
              fontSize: 11, fontWeight: 500, color: '#fff', background: '#6D28D9',
            }}>
              {score}% match
            </span>
          </div>
          <div>
            <p style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.01em', color: DARK, margin: 0 }}>{name}</p>
            <p style={{ fontSize: 13, color: MUTED, margin: '2px 0 0' }}>{age} · {occupation} · Madrid</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
              {tags.map(t => (
                <span key={t} style={{
                  fontSize: 11, padding: '3px 9px', borderRadius: 999,
                  background: '#EDE7DC', border: BORDER, color: MUTED,
                }}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: BORDER, flexShrink: 0, padding: '0 4px' }}>
          {P_TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} style={{
              flex: 1, padding: '11px 4px 10px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
              color: tab === i ? '#6D28D9' : MUTED,
              borderBottom: tab === i ? '2px solid #6D28D9' : '2px solid transparent',
              transition: 'color 150ms, border-color 150ms',
            }}>
              {t}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tab === 0 && <ProfileTab flatmate={flatmate} />}
          {tab === 1 && <LifestyleTab flatmate={flatmate} />}
          {tab === 2 && <MessageTab flatmate={flatmate} />}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 10, padding: '14px 20px',
          borderTop: BORDER, flexShrink: 0, position: 'relative',
        }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px 0', borderRadius: 12,
            background: 'transparent', border: '1px solid rgba(28,24,20,0.12)',
            color: 'rgba(28,24,20,0.45)', fontSize: 14, fontWeight: 500,
            fontFamily: 'inherit', cursor: 'pointer',
          }}>
            Not a fit
          </button>
          <button onClick={handleConnect} style={{
            flex: 1, padding: '12px 0', borderRadius: 12,
            background: connected ? '#1A9E50' : '#6D28D9',
            border: 'none', color: '#fff', fontSize: 14, fontWeight: 500,
            fontFamily: 'inherit', cursor: 'pointer',
            transition: 'background 200ms ease',
          }}>
            {connected ? '✓ Connected' : 'Connect'}
          </button>

          {/* Toast */}
          {toast && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 20, right: 20,
              marginBottom: 8, padding: '10px 14px', borderRadius: 10,
              background: DARK, color: '#fff', fontSize: 12, textAlign: 'center',
              animation: 'fadeIn 200ms ease',
            }}>
              {toast}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
