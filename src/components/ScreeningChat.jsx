import { useState, useEffect, useRef } from 'react'
import { ArrowUp, Check } from 'lucide-react'

/* ── Helpers ─────────────────────────────────────────────────── */

const SILENT_START = { role: 'user', content: 'Start screening' }

async function callScreeningAPI(displayMessages) {
  const apiMessages = [
    SILENT_START,
    ...displayMessages.map(({ role, content }) => ({ role, content })),
  ]
  const res = await fetch('/api/screening', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: apiMessages }),
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

function formatTime(date) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatBudget(budget) {
  if (!budget) return '—'
  if (budget.min && budget.max) return `€${budget.min.toLocaleString()} – €${budget.max.toLocaleString()} / mo`
  if (budget.max) return `Up to €${budget.max.toLocaleString()} / mo`
  if (budget.min) return `From €${budget.min.toLocaleString()} / mo`
  return '—'
}

/* ── Sub-components ──────────────────────────────────────────── */

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, maxWidth: '75%' }}>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        ✦
      </div>
      <div
        style={{
          padding: '10px 14px',
          background: 'var(--surface)',
          borderRadius: '18px 18px 18px 4px',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span className="typing-dot" />
        <span className="typing-dot" style={{ animationDelay: '150ms' }} />
        <span className="typing-dot" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

function AgentBubble({ message }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, maxWidth: '75%' }}>
      {/* Avatar */}
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        ✦
      </div>
      <div>
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--surface)',
            borderRadius: '18px 18px 18px 4px',
            fontSize: 15,
            lineHeight: 1.5,
            color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {message.content}
        </div>
        <p style={{ marginTop: 4, marginLeft: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  )
}

function UserBubble({ message }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 'auto', maxWidth: '75%' }}>
      <div
        style={{
          padding: '12px 16px',
          background: 'var(--accent)',
          borderRadius: '18px 18px 4px 18px',
          fontSize: 15,
          lineHeight: 1.5,
          color: '#fff',
          whiteSpace: 'pre-wrap',
        }}
      >
        {message.content}
      </div>
      <p style={{ marginTop: 4, marginRight: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
        {formatTime(message.timestamp)}
      </p>
    </div>
  )
}

function CompletionCard({ profile }) {
  const fields = [
    { label: 'City', value: profile.city || '—' },
    { label: 'Budget', value: formatBudget(profile.budget) },
    { label: 'Timeline', value: profile.move_in_timeline || '—' },
    { label: 'Looking for', value: profile.flat_type || '—' },
  ]

  return (
    <div
      className="completion-fade-in"
      style={{
        background: 'var(--surface)',
        borderRadius: 12,
        padding: 24,
        boxShadow: '0 4px 16px 0 rgba(0,0,0,0.16)',
        maxWidth: 400,
        width: '100%',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(52,211,105,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Check size={20} color="var(--success)" />
        </div>
        <div>
          <p style={{ fontSize: 19, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
            ✦ Your profile is ready
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Here's what your agent captured
          </p>
        </div>
      </div>

      {/* Summary fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {fields.map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontSize: 15, color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
            <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', textAlign: 'right' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={() => console.log('Find my matches →', profile)}
        style={{
          width: '100%',
          padding: '12px 0',
          borderRadius: 8,
          background: 'var(--accent)',
          border: 'none',
          fontSize: 15,
          fontWeight: 600,
          color: '#fff',
          cursor: 'pointer',
          transition: 'opacity 200ms ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
      >
        Find my matches
      </button>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────── */

export function ScreeningChat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [screeningState, setScreeningState] = useState('idle') // 'idle' | 'active' | 'complete'
  const [profile, setProfile] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-start: send silent opener, display agent's first question
  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        const data = await callScreeningAPI([])
        setMessages([
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.message,
            timestamp: new Date(),
          },
        ])
        setScreeningState('active')
      } catch (err) {
        console.error('Failed to start screening:', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  // Scroll to bottom whenever messages or loading state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, screeningState])

  async function handleSubmit() {
    const trimmed = input.trim()
    if (!trimmed || loading || screeningState === 'complete') return

    const userMsg = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const data = await callScreeningAPI(updatedMessages)

      const agentMsg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, agentMsg])

      if (data.type === 'complete') {
        localStorage.setItem('estato_user_profile', JSON.stringify(data.profile))
        setTimeout(() => {
          setProfile(data.profile)
          setScreeningState('complete')
        }, 1500)
      }
    } catch (err) {
      console.error('Screening API error:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <>
      {/* Component-scoped animations */}
      <style>{`
        @keyframes screening-live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(0.72); }
        }
        @keyframes screening-typing-bounce {
          0%, 60%, 100% { opacity: 0.2; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
        @keyframes screening-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .live-dot {
          animation: screening-live-pulse 1.6s ease-in-out infinite;
        }
        .typing-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--text-secondary);
          animation: screening-typing-bounce 1.2s ease-in-out infinite;
        }
        .completion-fade-in {
          animation: screening-fade-up 0.4s ease forwards;
        }
        .screening-input::placeholder {
          color: var(--text-secondary);
        }
        .screening-input:focus {
          outline: none;
        }
      `}</style>

      <div
        style={{
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--background)',
          fontFamily: 'Inter, SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <header
          style={{
            flexShrink: 0,
            height: 56,
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          {/* Logo */}
          <span
            style={{
              letterSpacing: '0.15em',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-primary)',
              textTransform: 'uppercase',
            }}
          >
            ✦ ESTATO
          </span>

          {/* Label */}
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Agent Screening
          </span>

          {/* Live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              className="live-dot"
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--success)',
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>Live</span>
          </div>
        </header>

        {/* ── Message thread ──────────────────────────────────── */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 24px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {messages.map((msg) =>
            msg.role === 'assistant'
              ? <AgentBubble key={msg.id} message={msg} />
              : <UserBubble key={msg.id} message={msg} />
          )}

          {loading && <TypingIndicator />}

          {screeningState === 'complete' && profile && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, paddingBottom: 32 }}>
              <CompletionCard profile={profile} />
            </div>
          )}

          <div ref={bottomRef} />
        </main>

        {/* ── Input bar ───────────────────────────────────────── */}
        {screeningState !== 'complete' && (
          <footer
            style={{
              flexShrink: 0,
              padding: '16px 24px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              background: 'var(--surface)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <input
              ref={inputRef}
              className="screening-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer..."
              disabled={loading}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                fontSize: 15,
                lineHeight: 1.5,
                color: 'var(--text-primary)',
                caretColor: 'var(--accent)',
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || loading}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'var(--accent)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                opacity: !input.trim() || loading ? 0.38 : 1,
                transition: 'opacity 200ms ease',
              }}
              aria-label="Send"
            >
              <ArrowUp size={18} color="#fff" />
            </button>
          </footer>
        )}
      </div>
    </>
  )
}
