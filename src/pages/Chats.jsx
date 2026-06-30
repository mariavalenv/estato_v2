import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Send, Calendar, CheckCheck } from 'lucide-react'
import { supabase } from '../supabase.js'
import { useChat } from '../hooks/useChat.js'
import { getAllConversations } from '../lib/dashboard/fetchers.js'

/* ── Helpers ─────────────────────────────────────────────────── */

function formatRelativeTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

/* ── Skeletons ───────────────────────────────────────────────── */

function ConvoSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      <div className="w-10 h-10 rounded-full shrink-0" style={{ background: 'var(--background)' }} />
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="h-4 w-1/2 rounded" style={{ background: 'var(--background)' }} />
        <div className="h-3 w-2/3 rounded" style={{ background: 'var(--background)' }} />
      </div>
    </div>
  )
}

function MessageSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6 animate-pulse">
      {[60, 45, 70, 50].map((w, i) => (
        <div
          key={i}
          className="h-10 rounded-2xl"
          style={{
            background: 'var(--surface)',
            width: `${w}%`,
            alignSelf: i % 2 === 0 ? 'flex-start' : 'flex-end',
          }}
        />
      ))}
    </div>
  )
}

/* ── AgentInsightPill ────────────────────────────────────────── */

function AgentInsightPill({ insight }) {
  const [visible, setVisible] = useState(true)
  if (!visible) return null
  return (
    <div
      className="mx-4 mt-3 flex items-center justify-between gap-3 px-4 py-2.5 rounded-card text-meta"
      style={{ background: 'rgba(99,134,241,0.08)', border: '1px solid rgba(99,134,241,0.18)' }}
    >
      <span style={{ color: 'var(--text-secondary)' }}>
        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>✦ Agent: </span>
        {insight}
      </span>
      <button
        onClick={() => setVisible(false)}
        className="shrink-0 transition-opacity hover:opacity-60"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
      >
        ×
      </button>
    </div>
  )
}

/* ── ViewingScheduler ────────────────────────────────────────── */

function ViewingScheduler({ slots, onConfirm }) {
  const [selected, setSelected] = useState(null)
  return (
    <div
      className="mx-4 mb-2 p-4 rounded-card flex flex-col gap-3"
      style={{ background: 'var(--surface)', border: '1px solid rgba(0,0,0,0.07)' }}
    >
      <p className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>
        <Calendar size={14} className="inline mr-1.5" style={{ color: 'var(--accent)' }} />
        Schedule a viewing
      </p>
      <div className="flex flex-col gap-2">
        {slots.map((slot, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className="text-left px-3 py-2 rounded-btn text-body transition-all duration-150"
            style={{
              border: `1px solid ${selected === i ? 'var(--accent)' : 'rgba(0,0,0,0.08)'}`,
              background: selected === i ? 'rgba(99,134,241,0.08)' : 'var(--background)',
              color: selected === i ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {slot}
          </button>
        ))}
      </div>
      <button
        onClick={() => selected !== null && onConfirm(slots[selected])}
        disabled={selected === null}
        className="py-2 rounded-btn text-body font-semibold transition-opacity"
        style={{
          background: 'var(--accent)', color: '#fff', border: 'none',
          cursor: selected === null ? 'not-allowed' : 'pointer',
          opacity: selected === null ? 0.38 : 1,
        }}
      >
        Confirm slot
      </button>
    </div>
  )
}

/* ── MessageInput ────────────────────────────────────────────── */

function MessageInput({ onSend, disabled }) {
  const [value, setValue] = useState('')

  function submit() {
    if (!value.trim() || disabled) return
    onSend(value.trim())
    setValue('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ borderTop: '1px solid rgba(0,0,0,0.07)', background: 'var(--surface)' }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message…"
        disabled={disabled}
        className="flex-1 bg-transparent text-body outline-none"
        style={{ border: 'none', color: 'var(--text-primary)' }}
      />
      <button
        onClick={submit}
        disabled={!value.trim() || disabled}
        className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity"
        style={{
          background: 'var(--accent)', border: 'none',
          cursor: !value.trim() || disabled ? 'not-allowed' : 'pointer',
          opacity: !value.trim() || disabled ? 0.38 : 1,
        }}
      >
        <Send size={15} color="#fff" />
      </button>
    </div>
  )
}

/* ── ChatSurface ─────────────────────────────────────────────── */

function ChatSurface({ conversationId, userId, matchId, otherName }) {
  const { messages, isLoading, sendMessage } = useChat({ matchId: matchId ?? conversationId })
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const agentInsight = matchId
    ? 'Your agents found you have compatible schedules and similar lifestyle preferences.'
    : null

  // Demo viewing slots — in production these would come from agent scheduling
  const hasViewing = false
  const viewingSlots = [
    'Tuesday, 5:00 PM',
    'Wednesday, 11:00 AM',
    'Thursday, 6:30 PM',
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Agent insight pill — shown once */}
      {agentInsight && <AgentInsightPill insight={agentInsight} />}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {isLoading ? (
          <MessageSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-body text-center" style={{ color: 'var(--text-secondary)' }}>
              No messages yet. Send the first one.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === userId
            return (
              <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%] ${isOwn ? 'self-end' : 'self-start'}`}>
                <div
                  className="px-4 py-2.5 rounded-2xl text-body"
                  style={{
                    background: isOwn ? 'var(--accent)' : 'var(--surface)',
                    color: isOwn ? '#fff' : 'var(--text-primary)',
                    borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  }}
                >
                  {msg.content}
                </div>
                <p className="text-meta mt-0.5 px-1" style={{ color: 'var(--text-secondary)' }}>
                  {formatRelativeTime(msg.created_at)}
                  {isOwn && msg._optimistic && ' · sending…'}
                </p>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Viewing scheduler */}
      {hasViewing && (
        <ViewingScheduler
          slots={viewingSlots}
          onConfirm={(slot) => console.log('Confirmed:', slot)}
        />
      )}

      {/* Input */}
      <MessageInput onSend={sendMessage} disabled={isLoading} />
    </div>
  )
}

/* ── ConversationList ────────────────────────────────────────── */

function ConversationList({ conversations, isLoading, selectedId, userId }) {
  if (isLoading) {
    return (
      <div className="flex flex-col">
        {Array.from({ length: 5 }).map((_, i) => <ConvoSkeleton key={i} />)}
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="p-6 text-center">
        <CheckCheck size={28} className="mx-auto mb-2" style={{ color: 'var(--text-secondary)' }} />
        <p className="text-body font-medium" style={{ color: 'var(--text-primary)' }}>No conversations yet</p>
        <p className="text-meta mt-1" style={{ color: 'var(--text-secondary)' }}>
          Once your agent makes mutual matches, conversations will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
      {conversations.map((convo) => {
        const isSelected = convo.id === selectedId
        const isOwnSide  = convo.user_id === userId
        const otherId    = isOwnSide ? convo.other_user_id : convo.user_id
        const initial    = otherId ? otherId.slice(0, 1).toUpperCase() : '?'

        return (
          <Link
            key={convo.id}
            to={`/chats/${convo.id}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors"
            style={{
              background: isSelected ? 'rgba(99,134,241,0.08)' : 'transparent',
              textDecoration: 'none',
            }}
          >
            {/* Avatar */}
            <div
              className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-body font-semibold"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {initial}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-body font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {otherId ? `User ${otherId.slice(0, 6)}` : 'Unknown'}
                </p>
                <span className="text-meta shrink-0 ml-2" style={{ color: 'var(--text-secondary)' }}>
                  {formatRelativeTime(convo.last_message_at)}
                </span>
              </div>
              {convo.last_message && (
                <p className="text-meta truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {convo.last_message}
                </p>
              )}
              {convo.match_id && (
                <span className="text-meta" style={{ color: 'var(--accent)' }}>✦ Matched by agent</span>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}

/* ── Chats Page ──────────────────────────────────────────────── */

export function Chats() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const [userId, setUserId] = useState(null)
  const [conversations, setConversations] = useState([])
  const [convoLoading, setConvoLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { navigate('/'); return }
      setUserId(user.id)
      const data = await getAllConversations(user.id)
      setConversations(data)
      setConvoLoading(false)
    })
  }, [navigate])

  // Find the selected conversation to get its match_id
  const selectedConvo = conversations.find((c) => c.id === conversationId)

  // On mobile: show list if no conversation selected, show chat if one is
  const showMobileList = !conversationId

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--background)' }}>
      {/* Conversation list — hidden on mobile when a chat is open */}
      <div
        className={`flex flex-col shrink-0 ${showMobileList ? 'flex' : 'hidden md:flex'}`}
        style={{
          width: 320,
          borderRight: '1px solid rgba(0,0,0,0.07)',
          background: 'var(--surface)',
          overflowY: 'auto',
        }}
      >
        {/* List header */}
        <div
          className="px-4 py-4"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}
        >
          <p className="text-heading font-semibold" style={{ color: 'var(--text-primary)' }}>Chats</p>
        </div>
        <ConversationList
          conversations={conversations}
          isLoading={convoLoading}
          selectedId={conversationId}
          userId={userId}
        />
      </div>

      {/* Chat surface */}
      <div className={`flex-1 flex flex-col min-w-0 ${showMobileList ? 'hidden md:flex' : 'flex'}`}>
        {conversationId && userId ? (
          <>
            {/* Mobile back button */}
            <div
              className="md:hidden flex items-center gap-2 px-4 py-3"
              style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: 'var(--surface)' }}
            >
              <Link to="/chats" className="flex items-center gap-1 text-body" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                <ArrowLeft size={16} /> Back
              </Link>
            </div>
            <ChatSurface
              conversationId={conversationId}
              userId={userId}
              matchId={selectedConvo?.match_id ?? null}
              otherName={null}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
              Select a conversation to start reading
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
