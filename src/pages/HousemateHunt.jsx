import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUp, MessageCircle, Compass, Users, LayoutGrid, Layers, Sparkles } from 'lucide-react'
import { FLATMATES } from '../data/flatmates.js'
import { useLandingTheme, selectedColors, inkTint, RED, CREME } from '../lib/landingTheme.js'
import { BrandMark } from '../components/ui/BrandMark'
import { PersonSwipeDeck } from '../components/PersonSwipeDeck'
import { PersonDetailSheet } from './review/_components/PersonDetailSheet.jsx'

/* ── Housemate-hunting screen ──────────────────────────────────────
   The people twin of ScreeningChat. Same shell — a centred App / Chat
   / Flatmates segmented control with a LIVE badge — but the third tab
   browses potential housemates (grid + swipe) instead of properties,
   and the agent chat talks about profiles and filters the pool.
   ──────────────────────────────────────────────────────────────── */

function formatTime(date) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/* Pull the leading number out of a budget string like "€1,200 / mo". */
function budgetNum(str) {
  const m = String(str || '').replace(/[.,]/g, (c) => (c === ',' ? '' : c)).match(/\d+/)
  return m ? parseInt(m[0], 10) : null
}

/* Apply an agent-issued filter to the flatmate pool. */
function filterPeople(list, f) {
  if (!f) return list
  return list.filter((p) => {
    if (f.max_budget) {
      const b = budgetNum(p.budget)
      if (b != null && b > f.max_budget) return false
    }
    if (f.min_clean && (p.cleanScore ?? 0) < f.min_clean) return false
    if (f.schedule) {
      const s = (p.schedule || '').toLowerCase()
      if (f.schedule === 'early' && !s.includes('early')) return false
      if (f.schedule === 'night' && !s.includes('night')) return false
    }
    if (f.tag) {
      const hay = [...(p.tags || []), p.occupation, p.desc].join(' ').toLowerCase()
      if (!hay.includes(String(f.tag).toLowerCase())) return false
    }
    return true
  })
}

/* ── Chat bubbles ─────────────────────────────────────────────── */

function Avatar() {
  return (
    <div style={{
      width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
      background: 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <img src="/logo-dog.png" alt="Estato" draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', mixBlendMode: 'multiply' }} />
    </div>
  )
}

function TypingIndicator({ theme }) {
  const sel = selectedColors(theme)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, maxWidth: '80%' }}>
      <Avatar theme={theme} />
      <div style={{
        padding: '10px 14px', background: sel.fg, border: 'none',
        borderRadius: '18px 18px 18px 4px', display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <span className="typing-dot" />
        <span className="typing-dot" style={{ animationDelay: '150ms' }} />
        <span className="typing-dot" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

function AgentBubble({ message, theme }) {
  const sel = selectedColors(theme)
  const bubbleText = theme?.id === 'light' ? '#000000' : sel.bg
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, maxWidth: '80%' }}>
      <Avatar theme={theme} />
      <div>
        <div style={{
          padding: '12px 16px', background: sel.fg, border: 'none',
          borderRadius: '18px 18px 18px 4px',
          fontSize: 15, lineHeight: 1.5, color: bubbleText, whiteSpace: 'pre-wrap',
        }}>
          {message.content}
        </div>
        <p style={{ marginTop: 4, marginLeft: 4, fontSize: 11, color: inkTint(theme, 0.45) }}>
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  )
}

function UserBubble({ message, theme }) {
  const sel = selectedColors(theme)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 'auto', maxWidth: '80%' }}>
      <div style={{
        padding: '12px 16px', background: sel.bg,
        borderRadius: '18px 18px 4px 18px',
        fontSize: 15, lineHeight: 1.5, color: sel.fg, whiteSpace: 'pre-wrap',
      }}>
        {message.content}
      </div>
      <p style={{ marginTop: 4, marginRight: 4, fontSize: 11, color: inkTint(theme, 0.45) }}>
        {formatTime(message.timestamp)}
      </p>
    </div>
  )
}

/* ── App nav panel ───────────────────────────────────────────── */

function AppNavPanel({ navigate, theme }) {
  const items = [
    { img: '/char-house.png', label: 'Flat hunting', description: 'Find your next place', path: '/screening' },
    { img: '/char-dog.png', label: 'Chat with Alex', description: 'Talk to your personal property agent', path: '/chat/new' },
    { img: '/char-box.png', label: 'Activity log', description: 'See what happened', path: '/activity' },
    { img: '/char-woman.png', label: 'Account', description: 'Profile, preferences & settings', path: '/account' },
  ]
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', maxWidth: 640, width: '100%', margin: '0 auto' }}>
      <div style={{ flexShrink: 0, padding: '24px 24px 12px' }}>
        <span style={{
          fontFamily: 'Archivo Black, Inter, sans-serif',
          fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.ink,
        }}>
          App features
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map(({ img, label, description, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '12px 4px',
              background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
              transition: 'transform 180ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <img src={img} alt="" draggable={false} style={{ width: 72, height: 72, objectFit: 'contain', flexShrink: 0, pointerEvents: 'none' }} />
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: theme.ink, marginBottom: 2 }}>{label}</p>
              <p style={{ fontSize: 13, color: inkTint(theme, 0.55), lineHeight: 1.4 }}>{description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Flatmate grid ──────────────────────────────────────────── */

function PersonTile({ person, onClick, theme }) {
  const sel = selectedColors(theme)
  return (
    <button
      onClick={() => onClick(person)}
      style={{
        textAlign: 'left', borderRadius: 14, overflow: 'hidden', background: CREME,
        cursor: 'pointer', border: `1px solid ${inkTint(theme, 0.1)}`, padding: 0,
        transition: 'transform 200ms ease, filter 200ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(0.97)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      {/* Hero */}
      <div style={{
        height: 132, position: 'relative',
        background: 'linear-gradient(160deg, #E8E2D6 0%, #CEC8BC 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: '#FAF6EF',
          border: '3px solid rgba(250,246,239,0.95)', boxShadow: '0 4px 18px rgba(28,20,14,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 500, color: '#6E6660',
        }}>
          {person.initial}
        </div>
        <span style={{
          position: 'absolute', top: 10, left: 10,
          padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 500, color: '#fff',
          background: person.score >= 85 ? '#6D28D9' : person.score >= 70 ? 'rgba(192,122,0,0.9)' : 'rgba(109,40,217,0.6)',
        }}>
          {person.score}% match
        </span>
      </div>
      {/* Body */}
      <div style={{ padding: '10px 12px 12px' }}>
        <p style={{ fontWeight: 700, fontSize: 15, color: theme.ink, marginBottom: 2 }}>{person.name}</p>
        <p style={{ fontSize: 12, color: inkTint(theme, 0.6), marginBottom: 8 }}>
          {person.age} · {person.occupation}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {(person.tags || []).slice(0, 3).map((t) => (
            <span key={t} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 999,
              background: inkTint(theme, 0.06), border: `1px solid ${inkTint(theme, 0.1)}`,
              color: inkTint(theme, 0.65),
            }}>{t}</span>
          ))}
        </div>
      </div>
    </button>
  )
}

function PeopleGrid({ people, loading, onSelect, theme }) {
  const sel = selectedColors(theme)
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', maxWidth: 920, width: '100%', margin: '0 auto' }}>
      <div style={{ flexShrink: 0, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{
            fontFamily: 'Archivo Black, Inter, sans-serif',
            fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.ink,
          }}>
            {people.length} flatmate{people.length === 1 ? '' : 's'}
          </span>
          <span style={{ fontSize: 12, color: inkTint(theme, 0.55) }}>· tap to explore</span>
        </div>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div className="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: sel.bg }} />
            <span style={{ fontSize: 12, color: inkTint(theme, 0.6), fontWeight: 500 }}>Refining</span>
          </div>
        )}
      </div>
      <div style={{
        flex: 1, overflowY: 'auto', padding: '8px 24px 24px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12, alignContent: 'start',
      }}>
        {people.map((p) => <PersonTile key={p.id} person={p} onClick={onSelect} theme={theme} />)}
        {people.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '48px 0', textAlign: 'center', color: inkTint(theme, 0.55), fontSize: 14 }}>
            No housemates match that filter yet — try loosening it in the chat.
          </div>
        )}
      </div>
    </div>
  )
}

/* ── View toggle ─────────────────────────────────────────────── */

function ViewToggle({ mode, onChange, theme }) {
  const sel = selectedColors(theme)
  const opts = [
    { id: 'grid', label: 'Grid', icon: <LayoutGrid size={13} /> },
    { id: 'swipe', label: 'Swipe', icon: <Layers size={13} /> },
  ]
  return (
    <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', padding: '12px 24px 4px' }}>
      <div style={{
        display: 'inline-flex', gap: 2, padding: 3, borderRadius: 999,
        background: inkTint(theme, 0.06), border: `1px solid ${inkTint(theme, 0.08)}`,
      }}>
        {opts.map((o) => {
          const active = mode === o.id
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px',
                borderRadius: 999, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: active ? 600 : 500,
                color: active ? sel.fg : inkTint(theme, 0.55),
                background: active ? sel.bg : 'transparent',
                transition: 'background 150ms, color 150ms',
              }}
            >
              {o.icon}{o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────── */

const WELCOME = "Hey — I'm helping you find a housemate. I've lined up a few people whose budget, schedule and lifestyle look close to yours. Open the Flatmates tab to swipe through them, or tell me what matters most — quiet evenings, an early riser, someone under a certain budget — and I'll narrow the pool."

export function HousemateHunt() {
  const navigate = useNavigate()
  const { theme, cycle } = useLandingTheme()
  const sel = selectedColors(theme)

  const [activeTab, setActiveTab] = useState('chat')
  const [view, setView] = useState('grid')
  const [filter, setFilter] = useState(null)
  const [selected, setSelected] = useState(null)

  const [messages, setMessages] = useState([
    { id: 'welcome', role: 'assistant', content: WELCOME, timestamp: new Date() },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const people = filterPeople(FLATMATES, filter)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSubmit() {
    const text = input.trim()
    if (!text || loading) return
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() }])
    setInput('')
    setLoading(true)

    const summary = FLATMATES.map((p) =>
      `${p.name} — ${p.age}, ${p.occupation}, budget ${p.budget}, ${p.schedule}, cleanliness ${p.cleanScore}/5, tags: ${(p.tags || []).join(', ')}`
    ).join('\n')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 320,
          system: `You are Estato, a warm, concise housemate-matching agent. The user is choosing a flatmate. Here is the current pool of candidates:\n${summary}\n\nHelp them think about compatibility — budget, schedule, cleanliness, lifestyle. If they ask to narrow the pool, emit a filter on its own line as FILTER:{...} using only these keys: max_budget (number), min_clean (number 0-5), schedule ("early" or "night"), tag (a lifestyle keyword like "wfh", "non-smoker", "pet"). To clear filters emit FILTER:null. Keep replies to 2-3 sentences, friendly and specific. Refer to candidates by first name.`,
          messages: [
            ...messages.filter((m) => m.id !== 'welcome').map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: text },
          ],
        }),
      })
      const data = await res.json()
      const reply = data.content?.[0]?.text ?? "Sorry, I hit a snag — mind trying that again?"

      const fm = reply.match(/FILTER:(\{.*?\}|null)/)
      if (fm) {
        const parsed = fm[1] === 'null' ? null : JSON.parse(fm[1])
        setFilter(parsed)
      }
      const clean = reply.replace(/FILTER:(\{.*?\}|null)/g, '').trim()
      if (clean) {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: clean, timestamp: new Date() }])
      }
    } catch {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: "Couldn't reach the agent right now — try again in a moment.", timestamp: new Date() }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  const tabs = [
    { id: 'app', label: 'App', icon: <Compass size={16} /> },
    { id: 'chat', label: 'Chat', icon: <MessageCircle size={16} /> },
    { id: 'flatmates', label: 'Flatmates', icon: <Users size={16} /> },
  ]

  return (
    <>
      <style>{`
        @keyframes hh-live-pulse { 0%,100% { opacity: 1; transform: scale(1) } 50% { opacity: 0.35; transform: scale(0.72) } }
        @keyframes hh-typing-bounce { 0%,60%,100% { opacity: 0.2; transform: translateY(0) } 30% { opacity: 1; transform: translateY(-3px) } }
        .live-dot { animation: hh-live-pulse 1.6s ease-in-out infinite; }
        .typing-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${sel.bg}; animation: hh-typing-bounce 1.2s ease-in-out infinite; }
        .hh-input::placeholder { color: ${inkTint(theme, 0.4)}; }
        .hh-input:focus { outline: none; }
      `}</style>

      <BrandMark theme={theme} onCycle={cycle} onHome={() => navigate('/dashboard')} />

      <div style={{
        display: 'flex', flexDirection: 'column', height: '100dvh',
        background: theme.bg, color: theme.ink,
        fontFamily: 'Inter, SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
        transition: 'background 0.5s ease',
      }}>
        {/* ── Top header bar ── */}
        <header style={{
          position: 'relative', flexShrink: 0, height: 64, padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderBottom: `1px solid ${inkTint(theme, 0.08)}`,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: inkTint(theme, 0.03), border: `1px solid ${inkTint(theme, 0.12)}`,
            borderRadius: 999, padding: 4,
          }}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
                    borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? sel.fg : inkTint(theme, 0.55),
                    background: isActive ? sel.bg : 'transparent',
                    transition: 'color 180ms ease, background 180ms ease',
                  }}
                >
                  {tab.icon}{tab.label}
                </button>
              )
            })}
          </div>

          <div style={{
            position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div className="live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: sel.bg }} />
            <span style={{ fontSize: 11, color: inkTint(theme, 0.6), fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Live</span>
          </div>
        </header>

        {/* ── Tab content ── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {activeTab === 'app' && <AppNavPanel navigate={navigate} theme={theme} />}

          {activeTab === 'chat' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', maxWidth: 720, width: '100%', margin: '0 auto' }}>
              <main style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {messages.map((msg) =>
                  msg.role === 'assistant'
                    ? <AgentBubble key={msg.id} message={msg} theme={theme} />
                    : <UserBubble key={msg.id} message={msg} theme={theme} />
                )}
                {loading && <TypingIndicator theme={theme} />}
                {filter && (
                  <button
                    onClick={() => { setFilter(null); setActiveTab('flatmates') }}
                    style={{
                      alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                      background: inkTint(theme, 0.05), border: `1px solid ${inkTint(theme, 0.14)}`,
                      fontSize: 12, color: inkTint(theme, 0.7),
                    }}
                  >
                    <Sparkles size={12} /> {people.length} match{people.length === 1 ? '' : 'es'} · clear filter
                  </button>
                )}
                <div ref={bottomRef} />
              </main>

              <footer style={{
                flexShrink: 0, padding: '16px 24px 24px',
                borderTop: `1px solid ${inkTint(theme, 0.1)}`,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <input
                  ref={inputRef}
                  className="hh-input"
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={(e) => { e.currentTarget.style.borderColor = RED }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = inkTint(theme, 0.12) }}
                  placeholder="Ask about a housemate, or narrow the pool…"
                  disabled={loading}
                  style={{
                    flex: 1, background: CREME, border: `1px solid ${inkTint(theme, 0.12)}`,
                    borderRadius: 999, padding: '12px 18px', fontSize: 15, lineHeight: 1.5,
                    color: '#111111', caretColor: '#111111',
                  }}
                />
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim() || loading}
                  aria-label="Send"
                  style={{
                    width: 44, height: 44, borderRadius: '50%', background: sel.bg, border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                    opacity: !input.trim() || loading ? 0.38 : 1, transition: 'opacity 200ms ease',
                  }}
                >
                  <ArrowUp size={18} color={sel.fg} />
                </button>
              </footer>
            </div>
          )}

          {activeTab === 'flatmates' && (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <ViewToggle mode={view} onChange={setView} theme={theme} />
              {view === 'swipe' ? (
                <PersonSwipeDeck people={people} onOpen={setSelected} />
              ) : (
                <PeopleGrid people={people} loading={loading} onSelect={setSelected} theme={theme} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Profile detail sheet (overlay) */}
      <PersonDetailSheet
        flatmate={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onPass={() => setSelected(null)}
        onKeep={() => setSelected(null)}
      />
    </>
  )
}
