import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUp, Check, MapPin, Bed, MessageCircle, Home, Compass, LayoutGrid, Layers } from 'lucide-react'
import { supabase, db } from '../supabase'
import { inkTint, selectedColors, RED, CREME, buildThemeVars } from '../lib/landingTheme.js'
import { buildSystemPrompt } from '../lib/prompts.js'
import {
  newSessionId, classifyMessage, dualResponse, generateWelcome,
  getCachedResponse, setCachedResponse,
} from '../lib/chat.js'
import { parseFilters, mergeFilters, queryListings, initialFilters } from '../lib/filters.js'
import { loadMemory, saveMemory, seedMemory, updateMemoryFromConversation } from '../lib/memory.js'
import { trackEvent, setSessionId, setUserId } from '../lib/tracking.js'
import { useSwipe } from '../hooks/useSwipe.js'
import { BrandMark } from './ui/BrandMark'

import { ListingDetailPanel } from './ListingDetailPanel'
import { PropertySwipeDeck } from './PropertySwipeDeck'

/* ── Formatting helpers ──────────────────────────────────────── */

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

/* ── Chat sub-components ─────────────────────────────────────── */

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
        padding: '10px 14px', background: sel.fg,
        border: 'none',
        borderRadius: '18px 18px 18px 4px',
        display: 'flex', alignItems: 'center', gap: 4,
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
  // On the white (light) theme, keep the body text black for legibility;
  // on the terracotta theme keep the brand-red accent text.
  const bubbleText = theme?.id === 'light' ? '#000000' : sel.bg
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, maxWidth: '80%' }}>
      <Avatar theme={theme} />
      <div>
        <div style={{
          padding: '12px 16px', background: sel.fg,
          border: 'none',
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

function CompletionCard({ profile, onContinue, theme }) {
  const sel = selectedColors(theme)
  const fields = [
    { label: 'City', value: profile.city || '—' },
    { label: 'Budget', value: formatBudget(profile.budget) },
    { label: 'Timeline', value: profile.move_in_timeline || '—' },
    { label: 'Looking for', value: profile.flat_type || '—' },
  ]
  return (
    <div className="completion-fade-in" style={{
      background: inkTint(theme, 0.04),
      border: `1px solid ${inkTint(theme, 0.12)}`,
      borderRadius: 16, padding: 28, width: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', background: sel.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Check size={20} color={sel.fg} />
        </div>
        <div>
          <p style={{
            fontFamily: 'Archivo Black, Inter, sans-serif',
            fontSize: 17, color: theme.ink, lineHeight: 1.2, textTransform: 'uppercase',
            letterSpacing: '-0.01em',
          }}>
            Your profile is ready
          </p>
          <p style={{ fontSize: 13, color: inkTint(theme, 0.55), marginTop: 4 }}>
            Here's what your agent captured
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {fields.map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontSize: 15, color: inkTint(theme, 0.55), flexShrink: 0 }}>{label}</span>
            <span style={{ fontSize: 15, fontWeight: 500, color: theme.ink, textAlign: 'right' }}>{value}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onContinue}
        style={{
          width: '100%', padding: '14px 0', borderRadius: 999,
          background: sel.bg, border: 'none',
          fontFamily: 'Archivo Black, Inter, sans-serif',
          fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase', color: sel.fg,
          cursor: 'pointer', transition: 'opacity 200ms ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
      >
        Go to dashboard →
      </button>
    </div>
  )
}

/* ── App nav panel ───────────────────────────────────────────── */

function AppNavPanel({ navigate, theme }) {
  const items = [
    {
      img: '/char-man.png',
      label: 'Housemate hunting',
      description: 'Meet your matches',
      path: '/matches',
    },
    {
      img: '/char-dog.png',
      label: 'Chat with Alex',
      description: 'Talk to your personal property agent',
      path: '/chat/new',
    },
    {
      img: '/char-box.png',
      label: 'Activity log',
      description: 'See what happened',
      path: '/activity',
    },
    {
      img: '/char-woman.png',
      label: 'Account',
      description: 'Profile, preferences & settings',
      path: '/account',
    },
  ]

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      maxWidth: 640, width: '100%', margin: '0 auto',
    }}>
      {/* Panel header */}
      <div style={{ flexShrink: 0, padding: '24px 24px 12px' }}>
        <span style={{
          fontFamily: 'Archivo Black, Inter, sans-serif',
          fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.ink,
        }}>
          App features
        </span>
      </div>

      {/* Nav cards */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 24px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {items.map(({ img, label, description, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '12px 4px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'transform 180ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <img
              src={img}
              alt=""
              draggable={false}
              style={{ width: 72, height: 72, objectFit: 'contain', flexShrink: 0, pointerEvents: 'none' }}
            />
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: theme.ink, marginBottom: 2 }}>
                {label}
              </p>
              <p style={{ fontSize: 13, color: inkTint(theme, 0.55), lineHeight: 1.4 }}>
                {description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Listings panel sub-components ──────────────────────────── */

function ListingTile({ listing, onClick, onDismiss, theme }) {
  const sel = selectedColors(theme)
  const currency = listing.monthlyCosts?.currency || (listing.city === 'London' ? '£' : '€')
  const price = listing.isForRent
    ? `${currency}${listing.price.toLocaleString()}/mo`
    : `${currency}${listing.price.toLocaleString()}`
  const beds = listing.bedrooms === 0 ? 'Studio' : `${listing.bedrooms} bed${listing.bedrooms !== 1 ? 's' : ''}`

  // Drag the tile left (pass) or right (keep) to remove it from the grid;
  // a plain tap still opens the detail panel.
  const swipeRef = useSwipe({
    onSwipeLeft: () => onDismiss(listing, 'pass'),
    onSwipeRight: () => onDismiss(listing, 'keep'),
    onTap: () => onClick(listing),
  })

  return (
    <div
      ref={swipeRef}
      style={{
        borderRadius: 14,
        overflow: 'hidden',
        background: CREME,
        cursor: 'pointer',
        touchAction: 'pan-y',
        userSelect: 'none',
        transition: 'transform 200ms ease, filter 200ms ease',
        border: `1px solid ${inkTint(theme, 0.1)}`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(0.96)' }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = 'none' }}
    >
      <img
        src={listing.image}
        alt={listing.title}
        draggable={false}
        style={{ width: '100%', height: 128, objectFit: 'cover', display: 'block' }}
      />
      <div style={{ padding: '10px 12px 12px' }}>
        <p style={{ fontWeight: 700, fontSize: 15, color: theme.ink, marginBottom: 4 }}>
          {price}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: inkTint(theme, 0.6) }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <MapPin size={10} /> {listing.area || listing.city}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Bed size={10} /> {beds}
          </span>
        </div>
        {listing.tag && (
          <span style={{
            display: 'inline-block',
            marginTop: 6,
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 11,
            background: sel.bg,
            color: sel.fg,
          }}>
            {listing.tag}
          </span>
        )}
      </div>
    </div>
  )
}

function ListingsPanel({ listings, loading, onSelectListing, onDismissListing, theme }) {
  const sel = selectedColors(theme)
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      maxWidth: 920, width: '100%', margin: '0 auto',
    }}>
      {/* Panel header */}
      <div style={{
        flexShrink: 0,
        padding: '12px 24px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{
            fontFamily: 'Archivo Black, Inter, sans-serif',
            fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.ink,
          }}>
            {listings.length} properties
          </span>
          <span style={{ fontSize: 12, color: inkTint(theme, 0.55) }}>
            · tap to explore
          </span>
        </div>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div className="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: sel.bg }} />
            <span style={{ fontSize: 12, color: inkTint(theme, 0.6), fontWeight: 500 }}>Refining</span>
          </div>
        )}
      </div>

      {/* Listings grid */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 24px 24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12,
        alignContent: 'start',
      }}>
        {listings.map((l) => (
          <ListingTile key={l.id} listing={l} onClick={onSelectListing} onDismiss={onDismissListing} theme={theme} />
        ))}
      </div>
    </div>
  )
}

/* ── Grid / Swipe view toggle ────────────────────────────────── */

function PropertyViewToggle({ mode, onChange, theme }) {
  const sel = selectedColors(theme)
  const opts = [
    { id: 'grid', label: 'Grid', icon: <LayoutGrid size={13} /> },
    { id: 'swipe', label: 'Swipe', icon: <Layers size={13} /> },
  ]
  return (
    <div style={{
      flexShrink: 0, display: 'flex', justifyContent: 'center',
      padding: '12px 24px 4px',
    }}>
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
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: active ? 600 : 500,
                color: active ? sel.fg : inkTint(theme, 0.55),
                background: active ? sel.bg : 'transparent',
                transition: 'background 150ms, color 150ms',
              }}
            >
              {o.icon}
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────── */

export function ScreeningChat({ initialContext = null, onScreeningComplete, theme, onCycleTheme }) {
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [screeningState, setScreeningState] = useState('idle')
  const [agentError, setAgentError] = useState(null)
  const [profile] = useState(null)  // retained for the (now-unused) completion card
  const [activeFilters, setActiveFilters] = useState(() => initialFilters(initialContext))
  const [listings, setListings] = useState([])
  const [selectedListing, setSelectedListing] = useState(null)
  const [propertyView, setPropertyView] = useState('grid')
  const [activeTab, setActiveTab] = useState('chat')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // ── Session / user / memory, held in refs so async handlers see fresh values.
  const userIdRef = useRef(null)
  const sessionIdRef = useRef(newSessionId())          // fresh conversation per page load
  const memoryRef = useRef(null)                        // current user memory blob
  const systemPromptRef = useRef(buildSystemPrompt(null))
  const activeFiltersRef = useRef(initialFilters(initialContext))
  const messagesRef = useRef([])                        // latest messages for async memory updates
  const assistantCountRef = useRef(0)                   // for the every-5 memory fallback

  useEffect(() => { messagesRef.current = messages }, [messages])

  // Persist a single message to the current session (no-op if logged out).
  async function persistMessage(role, content) {
    const userId = userIdRef.current
    if (!userId || !content) return
    try {
      await db.addSessionMessage(userId, sessionIdRef.current, role, content)
    } catch (err) {
      console.warn('[ScreeningChat] Could not save message:', err)
    }
  }

  // Merge new filters into the active set (cumulative) and re-query listings.
  // `track` is false for the initial profile-derived load (not a user action).
  async function applyFilters(incoming, { track = true } = {}) {
    const next = mergeFilters(activeFiltersRef.current, incoming)
    activeFiltersRef.current = next
    setActiveFilters(next)
    if (track) {
      for (const [filter_key, filter_value] of Object.entries(incoming || {})) {
        if (filter_value != null) trackEvent('filter_applied', null, { filter_key, filter_value })
      }
    }
    const results = await queryListings(next)
    setListings(results)
    return results
  }

  // Append an assistant message, persist it, cache it against the user's message,
  // bump the assistant counter, and run the every-5-messages memory fallback.
  function commitAssistant(content, userMessageForCache) {
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content, timestamp: new Date() }])
    if (userMessageForCache) setCachedResponse(userMessageForCache, content)
    persistMessage('assistant', content)
    assistantCountRef.current += 1
    if (assistantCountRef.current % 5 === 0) flushMemory()
  }

  // Fold a dismissal reason into memory so the assistant adapts (e.g. repeated
  // "too expensive" → nudge to tighten budget). Updates the live system prompt.
  // Swipe a grid tile away: drop it from the list and log the intent
  // (right = keep/save, left = pass/dismiss), matching the swipe deck.
  function handleRemoveListing(listing, dir) {
    setListings((prev) => prev.filter((l) => l.id !== listing.id))
    if (dir === 'keep') trackEvent('listing_save', listing.id, { saved: true })
    else trackEvent('listing_dismiss', listing.id)
  }

  function handleDismiss(_listingId, reason) {
    if (!reason) return
    const mem = memoryRef.current || {}
    const counts = { ...(mem.dismissal_reasons || {}) }
    counts[reason] = (counts[reason] || 0) + 1
    const updated = { ...mem, dismissal_reasons: counts }
    memoryRef.current = updated
    systemPromptRef.current = buildSystemPrompt(updated)
    if (userIdRef.current) saveMemory(userIdRef.current, updated)
  }

  // Ask Claude to fold anything new from the conversation into memory, then save.
  async function flushMemory() {
    const userId = userIdRef.current
    if (!userId) return
    const sessionMsgs = messagesRef.current.map(({ role, content }) => ({ role, content }))
    const updated = await updateMemoryFromConversation(memoryRef.current, sessionMsgs)
    memoryRef.current = updated
    systemPromptRef.current = buildSystemPrompt(updated)
    saveMemory(userId, updated)
  }

  // Short, deterministic confirmation for a pure-filter action (no API call).
  function filterAck(applied, count) {
    const parts = []
    if (applied.budget) parts.push(`under €${applied.budget}`)
    if (applied.property_type) parts.push(`${applied.property_type}s`)
    if (applied.neighbourhood) parts.push(`in ${applied.neighbourhood}`)
    else if (applied.city) parts.push(`in ${applied.city}`)
    if (applied.bedrooms) parts.push(`${applied.bedrooms}+ bed`)
    if (applied.furnished) parts.push('furnished')
    if (applied.pet_friendly) parts.push('pet-friendly')
    if (applied.bills_included) parts.push('bills included')
    if (applied.near_metro) parts.push('near the metro')
    if (applied.orientation) parts.push(`${applied.orientation}-facing`)
    if (applied.min_floor) parts.push(`floor ${applied.min_floor}+`)
    const desc = parts.length ? ` — ${parts.join(', ')}` : ''
    return `Updated your search${desc}. Showing ${count} place${count === 1 ? '' : 's'}. Want me to narrow it further?`
  }

  // Auto-start: agent speaks first
  useEffect(() => {
    // Persist the form data immediately — both locally and to the user's account
    if (initialContext) {
      const preliminary = {
        city: initialContext.city,
        neighbourhoods: initialContext.neighbourhoods,
        move_in_timeline: initialContext.timeline,
        budget: initialContext.budget,
        flat_type: initialContext.flatType,
        bedrooms: initialContext.bedrooms,
        adults: initialContext.adults,
        pets: initialContext.pets,
      }
      localStorage.setItem('estato_user_profile', JSON.stringify(preliminary))

        // Also save to Supabase if there's a logged-in user
        ; (async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) await db.savePreferences(user.id, preliminary)
          } catch (err) {
            console.warn('Could not save preliminary preferences:', err)
          }
        })()
    }

    async function init() {
      // Resolve the current user once; everything downstream keys off this.
      let userId = null
      try {
        const { data: { user } } = await supabase.auth.getUser()
        userId = user?.id ?? null
      } catch { /* logged out — runs without persistence */ }
      userIdRef.current = userId

      // Align event tracking with this chat session + user so events correlate.
      setSessionId(sessionIdRef.current)
      setUserId(userId)

      // Load the initial listings for this user's profile filters.
      queryListings(activeFiltersRef.current).then(setListings).catch(() => {})

      // ── Memory: load it; first visit → seed from the intake profile. ──
      let memory = await loadMemory(userId)
      const isReturning = !!(memory && Object.keys(memory).length)
      if (!isReturning) {
        memory = seedMemory(initialContext)
        if (userId && Object.keys(memory).length) saveMemory(userId, memory)  // baseline
      }
      memoryRef.current = memory
      systemPromptRef.current = buildSystemPrompt(memory)

      // ── Current session: every page load is a fresh session, so this is
      //    normally empty → we generate a welcome. (Robust if a session id is
      //    ever reused: we'd reload just that session's messages instead.) ──
      if (userId) {
        try {
          const existing = await db.getSessionMessages(userId, sessionIdRef.current)
          if (existing.length) {
            setMessages(existing.map(m => ({
              id: crypto.randomUUID(), role: m.role, content: m.content, timestamp: new Date(m.created_at),
            })))
            assistantCountRef.current = existing.filter(m => m.role === 'assistant').length
            setScreeningState('active')
            return
          }
        } catch (err) {
          console.warn('[ScreeningChat] Could not load session:', err)
        }
      }

      // ── Welcome: first message of the session (memory- or profile-aware). ──
      setLoading(true)
      try {
        const welcome = await generateWelcome({
          memory: isReturning ? memory : null,
          profile: isReturning ? null : initialContext,
          system: systemPromptRef.current,
        })
        setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: welcome, timestamp: new Date() }])
        persistMessage('assistant', welcome)
        assistantCountRef.current = 1
        setScreeningState('active')
      } catch (err) {
        console.error('Failed to start chat:', err)
        setAgentError('The assistant couldn\'t connect. Check your API key and try refreshing.')
      } finally {
        setLoading(false)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update memory when the user leaves. beforeunload can't await, so this is
  // fire-and-forget — the every-5-assistant-messages fallback covers cancellation.
  useEffect(() => {
    const handler = () => { flushMemory() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, screeningState])

  async function handleSubmit() {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content: trimmed, timestamp: new Date() }])
    setInput('')
    await persistMessage('user', trimmed)

    // ── 1. Response cache: identical message already handled this session. ──
    const cachedReply = getCachedResponse(trimmed)
    if (cachedReply) {
      commitAssistant(cachedReply)
      return
    }

    setLoading(true)
    try {
      // ── 2. Local parser: confident structured input → skip classification. ──
      const local = parseFilters(trimmed)
      if (local) {
        trackEvent('message_sent', null, { classified_as: 'filter' })
        const results = await applyFilters(local.filters)
        commitAssistant(filterAck(activeFiltersRef.current, results.length), trimmed)
        return
      }

      // ── 3. Classify: filter action vs. question. ──
      const cls = await classifyMessage(trimmed)
      trackEvent('message_sent', null, { classified_as: cls.type })
      if (cls.type === 'filter' && cls.filters) {
        const results = await applyFilters(cls.filters)
        commitAssistant(filterAck(activeFiltersRef.current, results.length), trimmed)
        return
      }

      // ── 4. Question → dual-response (reply + any implied filters). ──
      const { response, filters } = await dualResponse(trimmed, systemPromptRef.current)
      if (filters) await applyFilters(filters)
      commitAssistant(response || "Sorry, I didn't quite catch that — could you rephrase?", trimmed)
    } catch (err) {
      console.error('[ScreeningChat] message handling failed:', err)
      commitAssistant("Sorry — I hit a snag there. Mind trying that again?")
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

  const tabs = [
    { id: 'app', label: 'App', icon: <Compass size={16} /> },
    { id: 'chat', label: 'Chat', icon: <MessageCircle size={16} /> },
    { id: 'properties', label: 'Properties', icon: <Home size={16} /> },
  ]

  const sel = selectedColors(theme)

  return (
    <>
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
        .live-dot { animation: screening-live-pulse 1.6s ease-in-out infinite; }
        .typing-dot {
          display: inline-block; width: 6px; height: 6px; border-radius: 50%;
          background: ${sel.bg};
          animation: screening-typing-bounce 1.2s ease-in-out infinite;
        }
        .completion-fade-in { animation: screening-fade-up 0.4s ease forwards; }
        .screening-input::placeholder { color: ${inkTint(theme, 0.4)}; }
        .screening-input:focus { outline: none; }
        .sc-tab-btn { transition: color 180ms ease, background 180ms ease; }
      `}</style>

      <BrandMark theme={theme} onCycle={onCycleTheme} onHome={() => navigate('/dashboard')} />

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: theme.bg,
        color: theme.ink,
        fontFamily: 'Inter, SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
        transition: 'background 0.5s ease',
      }}>
        {/* ── Top header bar ── */}
        <header style={{
          position: 'relative',
          flexShrink: 0,
          height: 64,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: `1px solid ${inkTint(theme, 0.08)}`,
        }}>
          {/* Tab bar — centred segmented control */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: inkTint(theme, 0.03),
            border: `1px solid ${inkTint(theme, 0.12)}`,
            borderRadius: 999,
            padding: 4,
          }}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  className="sc-tab-btn"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 16px',
                    borderRadius: 999,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? sel.fg : inkTint(theme, 0.55),
                    background: isActive ? sel.bg : 'transparent',
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Live indicator — pinned right */}
          <div style={{
            position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div className="live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: sel.bg }} />
            <span style={{
              fontSize: 11, color: inkTint(theme, 0.6), fontWeight: 600,
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>Live</span>
          </div>
        </header>

        {/* ── Tab content ── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* App nav tab */}
          {activeTab === 'app' && (
            <AppNavPanel navigate={navigate} theme={theme} />
          )}

          {/* Chat tab */}
          {activeTab === 'chat' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', maxWidth: 720, width: '100%', margin: '0 auto' }}>
              {/* Message thread */}
              <main style={{
                flex: 1, overflowY: 'auto', padding: '24px 24px 16px',
                display: 'flex', flexDirection: 'column', gap: 16,
              }}>
                {messages.map((msg) =>
                  msg.role === 'assistant'
                    ? <AgentBubble key={msg.id} message={msg} theme={theme} />
                    : <UserBubble key={msg.id} message={msg} theme={theme} />
                )}
                {loading && <TypingIndicator theme={theme} />}
                {agentError && (
                  <div style={{
                    padding: '12px 16px', borderRadius: 10,
                    background: inkTint(theme, 0.05), border: `1px solid ${inkTint(theme, 0.18)}`,
                    fontSize: 13, color: theme.ink, lineHeight: 1.5,
                  }}>
                    {agentError}
                  </div>
                )}
                {screeningState === 'complete' && profile && (
                  <div style={{ paddingTop: 8, paddingBottom: 32 }}>
                    <CompletionCard profile={profile} theme={theme} onContinue={() => { onScreeningComplete?.(); navigate('/dashboard') }} />
                  </div>
                )}
                <div ref={bottomRef} />
              </main>

              {/* Input bar */}
              {screeningState !== 'complete' && (
                <footer style={{
                  flexShrink: 0, padding: '16px 24px 24px',
                  borderTop: `1px solid ${inkTint(theme, 0.1)}`,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <input
                    ref={inputRef}
                    className="screening-input"
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={(e) => { e.currentTarget.style.borderColor = RED }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = inkTint(theme, 0.12) }}
                    placeholder="Type your answer..."
                    disabled={loading}
                    style={{
                      flex: 1, background: CREME,
                      border: `1px solid ${inkTint(theme, 0.12)}`,
                      borderRadius: 999, padding: '12px 18px',
                      fontSize: 15, lineHeight: 1.5,
                      color: '#111111', caretColor: '#111111',
                    }}
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={!input.trim() || loading}
                    aria-label="Send"
                    style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: sel.bg, border: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                      opacity: !input.trim() || loading ? 0.38 : 1,
                      transition: 'opacity 200ms ease',
                    }}
                  >
                    <ArrowUp size={18} color={sel.fg} />
                  </button>
                </footer>
              )}
            </div>
          )}

          {/* Properties tab */}
          {activeTab === 'properties' && (
            selectedListing ? (
              <div style={{
                flex: 1, overflow: 'hidden', display: 'flex',
                background: CREME, padding: '20px 0',
              }}>
                <div style={{
                  ...buildThemeVars(theme), '--surface': CREME, '--surface-raised': CREME, '--section-label': theme?.id === 'terracotta' ? CREME : 'var(--text-secondary)', '--section-body': theme?.id === 'terracotta' ? CREME : '#000000', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
                  maxWidth: 880, width: '95%', margin: '0 auto'
                }}>
                  <ListingDetailPanel
                    listing={selectedListing}
                    onBack={() => setSelectedListing(null)}
                    onPass={(l) => { trackEvent('listing_dismiss', l.id); setSelectedListing(null) }}
                    onKeep={(l) => { trackEvent('listing_save', l.id, { saved: true }); setSelectedListing(null) }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <PropertyViewToggle mode={propertyView} onChange={setPropertyView} theme={theme} />
                {propertyView === 'swipe' ? (
                  <PropertySwipeDeck
                    listings={listings}
                    onOpen={setSelectedListing}
                    onDismiss={handleDismiss}
                  />
                ) : (
                  <ListingsPanel
                    listings={listings}
                    loading={loading}
                    onSelectListing={setSelectedListing}
                    onDismissListing={handleRemoveListing}
                    theme={theme}
                  />
                )}
              </div>
            )
          )}
        </div>
      </div>
    </>
  )
}
