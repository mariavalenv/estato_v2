import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MoreVertical, ArrowUp } from 'lucide-react'
import { useChat } from '../hooks/useChat.js'
import { getMatchById } from '../lib/dashboard/fetchers.js'
import { supabase } from '../supabase.js'

/* ── Bubble ──────────────────────────────────────────────────── */
function Bubble({ msg, prevType, currentUserId }) {
  const isSent = msg.sender_id === currentUserId
  const sameSenderAbove = isSent ? prevType === 'sent' : prevType === 'received'
  const isOptimistic = Boolean(msg._optimistic)

  const baseRadius = 18
  const tightCorner = 4

  const borderRadius = isSent
    ? `${baseRadius}px ${sameSenderAbove ? tightCorner : baseRadius}px ${baseRadius}px ${baseRadius}px`
    : `${sameSenderAbove ? tightCorner : baseRadius}px ${baseRadius}px ${baseRadius}px ${baseRadius}px`

  const time = msg.created_at
    ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div
      className={`flex ${isSent ? 'justify-end' : 'justify-start'} ${sameSenderAbove ? 'mt-1' : 'mt-3'}`}
    >
      <div
        className="max-w-xs px-4 py-2.5 text-body"
        style={{
          borderRadius,
          background: isSent ? 'var(--accent)' : 'var(--surface)',
          color: isSent ? '#fff' : 'var(--text-primary)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          opacity: isOptimistic ? 0.7 : 1,
        }}
      >
        <p>{msg.content}</p>
        {time && (
          <p
            className="text-meta mt-1 text-right"
            style={{ color: isSent ? 'rgba(255,255,255,0.65)' : 'var(--text-secondary)' }}
          >
            {time}
          </p>
        )}
      </div>
    </div>
  )
}

/* ── System Message ──────────────────────────────────────────── */
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

/* ── Skeleton ────────────────────────────────────────────────── */
function ChatSkeleton() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
        Loading conversation…
      </p>
    </div>
  )
}

/* ── Chat Page ───────────────────────────────────────────────── */
export function Chat() {
  const navigate = useNavigate()
  const { matchId } = useParams()
  const [input, setInput] = useState('')
  const [matchData, setMatchData] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const bottomRef = useRef(null)

  const { messages, isLoading, sendMessage, userId } = useChat({ matchId })

  // Resolve current user and match metadata for header display
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null)
      if (user && matchId) {
        getMatchById(matchId, user.id).then(setMatchData)
      }
    })
  }, [matchId])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text) return
    setInput('')
    await sendMessage(text)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // Derive header info from match data
  const otherName =
    matchData?.type === 'flatmate'
      ? matchData.data?.name ?? 'Flatmate'
      : matchData?.data?.address ?? 'Match'

  const otherAvatar =
    matchData?.type === 'flatmate' ? matchData.data?.avatar ?? null : null

  const matchLabel =
    matchData?.type === 'flatmate' ? 'Matched via Flatmate' : 'Matched via Listing'

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--background)' }}>
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

        {otherAvatar && (
          <img
            src={otherAvatar}
            alt={otherName}
            className="w-9 h-9 rounded-full object-cover shrink-0"
          />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-body font-semibold leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
            {otherName}
          </p>
          <p className="text-meta" style={{ color: 'var(--text-secondary)' }}>
            {matchLabel}
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
        {isLoading ? (
          <ChatSkeleton />
        ) : (
          <>
            {/* Agent insight banner */}
            {matchData && (
              <SystemMessage
                text={`💡 Your agents matched you based on compatibility score ${matchData.score}%.`}
              />
            )}

            {/* Date divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <span className="text-meta" style={{ color: 'var(--text-secondary)' }}>Today</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {messages.length === 0 && (
              <p className="text-center text-body py-8" style={{ color: 'var(--text-secondary)' }}>
                No messages yet. Say hello!
              </p>
            )}

            {messages.map((msg, i) => {
              const prev = messages[i - 1]
              const prevIsSent = prev?.sender_id === currentUserId
              const prevType = prev ? (prevIsSent ? 'sent' : 'received') : null
              return (
                <Bubble
                  key={msg.id}
                  msg={msg}
                  prevType={prevType}
                  currentUserId={currentUserId}
                />
              )
            })}

            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input bar */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 py-3"
        style={{ background: 'var(--surface)', boxShadow: '0 -1px 0 rgba(255,255,255,0.06)' }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Message…"
          className="flex-1 min-w-0 px-4 py-2.5 rounded-chip text-body outline-none transition-all duration-200"
          style={{ background: 'var(--background)', color: 'var(--text-primary)', border: 'none' }}
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
