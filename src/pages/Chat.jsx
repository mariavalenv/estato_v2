import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MoreVertical, ArrowUp } from 'lucide-react'

const MATCH = {
  name: 'Lucía M.',
  avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&q=80',
}

const INITIAL_MESSAGES = [
  {
    id: 1,
    type: 'received',
    text: "Hey! I saw we matched on Flatmate. I'm looking for a flatmate in Malasaña — are you familiar with the area?",
    time: '10:14',
  },
  {
    id: 2,
    type: 'system',
    text: '💡 Your agents found you have compatible schedules and similar cleanliness preferences.',
  },
  {
    id: 3,
    type: 'sent',
    text: 'Yes! I love Malasaña. I work from home a few days a week so a quiet flat is important to me.',
    time: '10:16',
  },
  {
    id: 4,
    type: 'received',
    text: "Same here! I'm also WFH most of the time. The flat I'm looking at on Calle del Pez has a dedicated desk space.",
    time: '10:17',
  },
  {
    id: 5,
    type: 'sent',
    text: 'That sounds perfect. Would you be open to a quick call this week?',
    time: '10:19',
  },
]

function Bubble({ msg, prevType }) {
  // Reduce corner radius on the side adjacent to same-sender bubble above
  const sameSenderAbove = prevType === msg.type
  const isReceived = msg.type === 'received'

  const baseRadius = 18
  const tightCorner = 4

  const borderRadius = isReceived
    ? `${sameSenderAbove ? tightCorner : baseRadius}px ${baseRadius}px ${baseRadius}px ${baseRadius}px`
    : `${baseRadius}px ${sameSenderAbove ? tightCorner : baseRadius}px ${baseRadius}px ${baseRadius}px`

  return (
    <div
      className={`flex ${isReceived ? 'justify-start' : 'justify-end'} ${sameSenderAbove ? 'mt-1' : 'mt-3'}`}
    >
      {isReceived && !sameSenderAbove && (
        <img
          src={MATCH.avatar}
          alt={MATCH.name}
          className="w-7 h-7 rounded-full object-cover mr-2 mt-auto shrink-0"
        />
      )}
      {isReceived && sameSenderAbove && <div className="w-7 mr-2 shrink-0" />}

      <div
        className="max-w-xs px-4 py-2.5 text-body"
        style={{
          borderRadius,
          background: isReceived ? 'var(--surface)' : 'var(--accent)',
          color: isReceived ? 'var(--text-primary)' : '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <p>{msg.text}</p>
        {msg.time && (
          <p
            className="text-meta mt-1 text-right"
            style={{ color: isReceived ? 'var(--text-secondary)' : 'rgba(255,255,255,0.65)' }}
          >
            {msg.time}
          </p>
        )}
      </div>
    </div>
  )
}

function SystemMessage({ text }) {
  return (
    <div className="my-4 mx-4">
      <div
        className="w-full rounded-card px-4 py-3 text-body text-center"
        style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
      >
        {text}
      </div>
    </div>
  )
}

export function Chat() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function send() {
    const text = input.trim()
    if (!text) return
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        type: 'sent',
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ])
    setInput('')
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: 'var(--background)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ background: 'var(--surface)', boxShadow: '0 1px 0 rgba(255,255,255,0.06)' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-btn flex items-center justify-center transition-all duration-200 cursor-pointer"
          style={{ background: 'var(--background)', border: 'none', color: 'var(--text-primary)' }}
        >
          <ArrowLeft size={18} />
        </button>

        <img
          src={MATCH.avatar}
          alt={MATCH.name}
          className="w-9 h-9 rounded-full object-cover shrink-0"
        />

        <div className="flex-1 min-w-0">
          <p className="text-body font-semibold leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
            {MATCH.name}
          </p>
          <p className="text-meta" style={{ color: 'var(--text-secondary)' }}>
            Matched via Flatmate
          </p>
        </div>

        <button
          className="w-8 h-8 rounded-btn flex items-center justify-center transition-all duration-200 cursor-pointer"
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}
        >
          <MoreVertical size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Today divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <span className="text-meta" style={{ color: 'var(--text-secondary)' }}>Today</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {messages.map((msg, i) => {
          if (msg.type === 'system') {
            return <SystemMessage key={msg.id} text={msg.text} />
          }
          const prev = messages[i - 1]
          const prevType = prev?.type === 'system' ? null : prev?.type
          return <Bubble key={msg.id} msg={msg} prevType={prevType} />
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 py-3"
        style={{
          background: 'var(--surface)',
          boxShadow: '0 -1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Message…"
          className="flex-1 min-w-0 px-4 py-2.5 rounded-chip text-body outline-none transition-all duration-200"
          style={{
            background: 'var(--background)',
            color: 'var(--text-primary)',
            border: 'none',
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim()}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 cursor-pointer"
          style={{
            background: input.trim() ? 'var(--accent)' : 'var(--background)',
            color: input.trim() ? '#fff' : 'var(--text-secondary)',
            border: 'none',
          }}
        >
          <ArrowUp size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
