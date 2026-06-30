import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  SlidersHorizontal, ChevronDown, ChevronRight, X,
  CheckCircle2, AlertCircle, RefreshCw, Send, MessageCircle, Heart,
} from 'lucide-react'
import { supabase } from '../supabase.js'
import { useDensity } from '../contexts/DensityContext'
import { MatchCard } from '../components/ui/MatchCard'
import { MatchDetailPanel } from '../components/organisms/MatchDetailPanel'
import { RejectionModal } from '../components/matches/RejectionModal'
import { useMatches } from '../hooks/useMatches.js'
import { getMatchById } from '../lib/dashboard/fetchers.js'
import { SwipeStack } from './Review.jsx'
import { PinkBlob } from '../components/ui/PinkBlob'
import { useAssistant } from '../contexts/AssistantContext'
import { db } from '../supabase.js'

// Build a stable shape for a "contacted" listing card so MatchCard can show
// a chat shortcut + interested count instead of needing the user to swipe.
function decorateCardShape(card, ctx) {
  if (!ctx) return card
  const { conversationId, interestedCount } = ctx
  return { ...card, conversationId: conversationId ?? null, interestedCount: interestedCount ?? 0 }
}

/* ── Helpers ─────────────────────────────────────────────────── */

function toCardShape(match) {
  const d = match.data
  if (match.type === 'listing') {
    return {
      type: 'listing',
      image: d.images?.[0] ?? '',
      images: d.images ?? [],
      matchPct: match.score,
      price: `€${d.price?.toLocaleString()} / mo`,
      neighbourhood: d.neighbourhood,
      beds: `${d.bedrooms} bed${d.bedrooms !== 1 ? 's' : ''}`,
      commute: `${d.commute_minutes} min`,
      address: d.address,
      sqm: d.size_sqm,
      reasons: match.match_reasons ?? [],
      tradeoffs: match.trade_offs ?? [],
      agentReasoning: match.agent_reasoning ?? '',
      matchId: match.id,
    }
  }
  return {
    type: 'flatmate',
    image: d.avatar ?? '',
    images: [d.avatar ?? ''],
    matchPct: match.score,
    name: d.name,
    age: String(d.age ?? ''),
    jobTitle: d.job_title ?? '',
    tags: d.lifestyle_tags ?? [],
    reasons: match.match_reasons ?? [],
    tradeoffs: match.trade_offs ?? [],
    agentReasoning: match.agent_reasoning ?? '',
    matchId: match.id,
  }
}

/* ── Memoized grid — avoids re-rendering all cards on unrelated state changes */

const cardShapeCache = new WeakMap()
function getCachedCardShape(match) {
  if (cardShapeCache.has(match)) return cardShapeCache.get(match)
  const shape = toCardShape(match)
  cardShapeCache.set(match, shape)
  return shape
}

const MemoizedGrid = memo(function MemoizedGrid({
  matches, density, onSelect, convoByMatchId, interestedCountByListing, onOpenChat,
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {matches.map((match) => (
        <MemoizedGridItem
          key={match.id}
          match={match}
          density={density}
          onSelect={onSelect}
          conversationId={convoByMatchId?.[match.id] ?? null}
          interestedCount={interestedCountByListing?.[match.id] ?? 0}
          onOpenChat={onOpenChat}
        />
      ))}
    </div>
  )
})

const MemoizedGridItem = memo(function MemoizedGridItem({
  match, density, onSelect, conversationId, interestedCount, onOpenChat,
}) {
  const handleSelect = useCallback(() => onSelect(match), [match, onSelect])
  const handleOpenChat = useCallback(
    (e) => { e?.stopPropagation?.(); onOpenChat?.(conversationId, match) },
    [onOpenChat, conversationId, match],
  )
  const card = useMemo(
    () => decorateCardShape(getCachedCardShape(match), { conversationId, interestedCount }),
    [match, conversationId, interestedCount],
  )
  return (
    <div className="transition-transform hover:-translate-y-0.5">
      <MatchCard
        card={card}
        density={density}
        onSelect={handleSelect}
        onOpenChat={conversationId ? handleOpenChat : undefined}
      />
    </div>
  )
})

/* ── Skeleton ────────────────────────────────────────────────── */

function CardSkeleton() {
  return (
    <div className="rounded-card overflow-hidden shadow-card animate-pulse" style={{ background: 'var(--surface)' }}>
      <div className="w-full h-44" style={{ background: 'var(--background)' }} />
      <div className="p-4 flex flex-col gap-3">
        <div className="h-5 w-2/3 rounded" style={{ background: 'var(--background)' }} />
        <div className="h-4 w-1/2 rounded" style={{ background: 'var(--background)' }} />
        <div className="h-4 w-3/4 rounded" style={{ background: 'var(--background)' }} />
      </div>
    </div>
  )
}

/* ── FilterBar ───────────────────────────────────────────────── */

const TYPE_OPTIONS   = [{ value: 'listing', label: 'Listings' }, { value: 'flatmate', label: 'Flatmates' }]
const STATUS_OPTIONS = [{ value: '',        label: 'All statuses' }, { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }, { value: 'contacted', label: 'Contacted' }]
const SORT_OPTIONS   = [{ value: 'score',   label: 'Best match' }, { value: 'price_asc', label: 'Price ↑' }, { value: 'price_desc', label: 'Price ↓' }, { value: 'date', label: 'Newest' }]

/* ── View toggle icons ───────────────────────────────────────── */
function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" />
    </svg>
  )
}

function StackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="3" rx="1.5" fill="currentColor" opacity="0.4" />
      <rect x="2" y="7" width="12" height="3" rx="1.5" fill="currentColor" opacity="0.7" />
      <rect x="2" y="11" width="12" height="3" rx="1.5" fill="currentColor" />
    </svg>
  )
}

function HeartIcon() {
  return <Heart size={15} fill="currentColor" strokeWidth={0} />
}

function FilterBar({ typeFilter, statusFilter, sortFilter, onType, onStatus, onSort, viewMode, onViewMode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      {/* Type toggle pills */}
      <div className="flex gap-1 p-1 rounded-btn" style={{ background: 'var(--surface)' }}>
        {TYPE_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => onType(o.value)}
            className="px-3 py-1 rounded text-meta font-medium transition-all duration-150"
            style={{
              border: 'none', cursor: 'pointer',
              background: typeFilter === o.value ? 'var(--accent)' : 'transparent',
              color: typeFilter === o.value ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Status select */}
      <div className="relative">
        <select
          value={statusFilter}
          onChange={(e) => onStatus(e.target.value)}
          className="text-meta pl-3 pr-8 py-1.5 rounded-btn appearance-none cursor-pointer"
          style={{
            background: 'var(--surface)', border: '1px solid rgba(0,0,0,0.08)',
            color: 'var(--text-secondary)', outline: 'none',
          }}
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-secondary)' }} />
      </div>

      {/* Sort select */}
      <div className="relative">
        <select
          value={sortFilter}
          onChange={(e) => onSort(e.target.value)}
          className="text-meta pl-3 pr-8 py-1.5 rounded-btn appearance-none cursor-pointer"
          style={{
            background: 'var(--surface)', border: '1px solid rgba(0,0,0,0.08)',
            color: 'var(--text-secondary)', outline: 'none',
          }}
        >
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <SlidersHorizontal size={13} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-secondary)' }} />
      </div>

      {/* View mode toggle */}
      <div
        className="flex ml-auto"
        style={{
          border: '1px solid var(--border)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {[
          { mode: 'grid',      Icon: GridIcon,  label: 'Grid view' },
          { mode: 'review',    Icon: StackIcon, label: 'Swipe review' },
          { mode: 'favorites', Icon: HeartIcon, label: 'Favorites' },
        ].map(({ mode, Icon, label }, i, arr) => (
          <button
            key={mode}
            onClick={() => onViewMode(mode)}
            style={{
              width: 32,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: 'pointer',
              background: viewMode === mode ? 'var(--surface-raised)' : 'transparent',
              color: viewMode === mode
                ? (mode === 'favorites' ? 'var(--accent)' : 'var(--text-primary)')
                : 'var(--text-secondary)',
              borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
              transition: 'background 150ms, color 150ms',
            }}
            aria-label={label}
          >
            <Icon />
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── ApprovalPanel ───────────────────────────────────────────── */

function ApprovalPanel({ matchId, userId, onApprove, onRefinement, onClose }) {
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [showRejectionModal, setShowRejectionModal] = useState(false)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    if (!matchId || !userId) return
    setLoading(true)
    getMatchById(matchId, userId).then((m) => { setMatch(m); setLoading(false) })
  }, [matchId, userId])

  async function handleApprove() {
    setActing(true)
    await onApprove(matchId)
    setActing(false)
    onClose()
  }

  async function handleRefinement() {
    if (!note.trim()) return
    setActing(true)
    await onRefinement(matchId, note.trim())
    setActing(false)
    onClose()
  }

  const skeletonStyle = { background: 'var(--background)' }

  return (
    <div
      className="fixed inset-y-0 right-0 z-40 flex flex-col overflow-y-auto shadow-2xl"
      style={{ width: 420, background: 'var(--surface)', borderLeft: '1px solid rgba(0,0,0,0.07)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <p className="text-heading font-semibold" style={{ color: 'var(--text-primary)' }}>
          Review match
        </p>
        <button onClick={onClose} className="p-1 rounded transition-opacity hover:opacity-60" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <X size={18} style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4 p-6 animate-pulse">
          <div className="w-full h-48 rounded-card" style={skeletonStyle} />
          <div className="h-5 w-1/2 rounded" style={skeletonStyle} />
          <div className="h-4 w-2/3 rounded" style={skeletonStyle} />
          <div className="h-4 w-full rounded" style={skeletonStyle} />
        </div>
      ) : !match ? (
        <div className="p-6 flex flex-col items-center gap-3">
          <AlertCircle size={24} style={{ color: 'var(--text-secondary)' }} />
          <p className="text-body" style={{ color: 'var(--text-secondary)' }}>Match not found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5 p-6 pb-10">
          {/* Card preview */}
          <MatchCard card={toCardShape(match)} density="detailed" />

          {/* Agent reasoning */}
          {match.agent_reasoning && (
            <div className="p-4 rounded-card" style={{ background: 'var(--background)', borderLeft: '2px solid var(--accent)' }}>
              <p className="text-meta font-medium mb-1" style={{ color: 'var(--accent)' }}>Agent reasoning</p>
              <p className="text-body italic" style={{ color: 'var(--text-secondary)' }}>"{match.agent_reasoning}"</p>
            </div>
          )}

          {/* Status badge */}
          {match.status !== 'pending' && (
            <div className="flex items-center gap-2 text-body">
              <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />
              <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                Status: {match.status}
              </span>
            </div>
          )}

          {/* Actions */}
          {match.status === 'pending' && (
            <div className="flex flex-col gap-3">
              <button
                onClick={handleApprove}
                disabled={acting}
                className="w-full py-2.5 rounded-btn text-body font-semibold transition-opacity hover:opacity-88"
                style={{ background: 'var(--accent)', color: '#fff', border: 'none', cursor: acting ? 'not-allowed' : 'pointer', opacity: acting ? 0.5 : 1 }}
              >
                Approve outreach
              </button>
              <button
                onClick={() => setShowRejectionModal(true)}
                disabled={acting}
                className="w-full py-2.5 rounded-btn text-body font-medium transition-opacity hover:opacity-70"
                style={{ background: 'var(--background)', color: 'var(--text-secondary)', border: '1px solid rgba(0,0,0,0.08)', cursor: acting ? 'not-allowed' : 'pointer' }}
              >
                Pass
              </button>
              {!showNoteInput ? (
                <button
                  onClick={() => setShowNoteInput(true)}
                  className="text-body text-center transition-opacity hover:opacity-70"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)' }}
                >
                  Ask agent to refine
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="What should the agent adjust? (e.g. 'Commute is too long')"
                    rows={3}
                    className="w-full p-3 rounded-btn text-body resize-none"
                    style={{
                      background: 'var(--background)', border: '1px solid rgba(0,0,0,0.1)',
                      color: 'var(--text-primary)', outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleRefinement}
                    disabled={!note.trim() || acting}
                    className="py-2 rounded-btn text-body font-medium transition-opacity hover:opacity-88"
                    style={{ background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', opacity: !note.trim() ? 0.4 : 1 }}
                  >
                    Send to agent
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showRejectionModal && match && (
        <RejectionModal
          matchId={matchId}
          matchType={match.type}
          onComplete={onClose}
          onCancel={() => setShowRejectionModal(false)}
        />
      )}
    </div>
  )
}

/* ── RejectedMatchesSection ──────────────────────────────────── */

function RejectedMatchesSection({ matches, density, onSelect }) {
  const [open, setOpen] = useState(false)
  if (!matches.length) return null

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-body transition-opacity hover:opacity-70 mb-4"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0 }}
      >
        <ChevronRight
          size={16}
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }}
        />
        {matches.length} rejected match{matches.length !== 1 ? 'es' : ''} — tap to audit
      </button>
      {open && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {matches.map((match) => (
            <div key={match.id} className="cursor-pointer opacity-50 hover:opacity-80 transition-opacity" onClick={() => onSelect(match.id)}>
              <MatchCard card={toCardShape(match)} density={density} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Matches Page ────────────────────────────────────────────── */

export function Matches() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { density } = useDensity()

  const [userId, setUserId] = useState(null)
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'review' | 'favorites'
  const [selectedMatch, setSelectedMatch] = useState(null)

  // URL-driven filter state
  const typeFilter   = searchParams.get('type') ?? ''
  const statusFilter = searchParams.get('status') ?? ''
  const sortFilter   = searchParams.get('sort') ?? 'score'
  const openMatchId  = searchParams.get('match') ?? null

  const setParam = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })
  }, [setSearchParams])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate('/'); return }
      setUserId(user.id)
    })
  }, [navigate])

  // Review mode swipes through pending matches; favorites mode shows the ones
  // the user already swiped right on (approved) plus their saved favourites.
  const viewModeFilters =
    viewMode === 'review'
      ? { type: typeFilter || undefined, status: 'pending', sort: sortFilter }
      : viewMode === 'favorites'
      ? { type: typeFilter || undefined, status: 'approved', sort: sortFilter }
      : { type: typeFilter || undefined, status: statusFilter || undefined, sort: sortFilter }

  const { matches, isLoading, approveMatch, rejectMatch, requestRefinement } = useMatches({ userId, filters: viewModeFilters })

  // ── Conversations the user has already started ──────────────────────────
  // If the user has texted the landlord for a listing, we don't want to make
  // them swipe through it again — instead the card gets a direct "Open chat"
  // shortcut and the listing is removed from the review/swipe queue.
  const [convoByMatchId, setConvoByMatchId] = useState({})
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase
      .from('conversations')
      .select('id, match_id, updated_at')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (cancelled || !data) return
        // Newest conversation per listing wins.
        const sorted = [...data].sort(
          (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0),
        )
        const map = {}
        for (const row of sorted) {
          if (row.match_id != null && !(row.match_id in map)) map[row.match_id] = row.id
        }
        setConvoByMatchId(map)
      })
    return () => { cancelled = true }
  }, [userId])

  // ── Favourites (mirror the dashboard's "Saved" bubble) ────────────────────
  // The dashboard's favourites sub-tab pulls from the `favourites` table via
  // db.getFavourites. Those rows never end up in `matches.status='approved'`,
  // so the Matches grid would show "No matches yet" even though the user has
  // saved listings on the dashboard. We pull them here and merge them in as
  // approved matches when the user is filtering by approved (or no status).
  const [favourites, setFavourites] = useState([])
  useEffect(() => {
    if (!userId) return
    db.getFavourites(userId).then(setFavourites).catch(() => setFavourites([]))
  }, [userId])

  const favouriteMatches = useMemo(() => {
    return favourites.map((f) => {
      const ld = f.listing_data ?? {}
      const isFlatmate = ld.type === 'flatmate'
      // Normalise the dashboard's listing card shape into the supabase
      // matches.data shape that toCardShape() reads.
      const data = isFlatmate
        ? {
            avatar: ld.avatar ?? ld.image ?? '',
            name: ld.name ?? '',
            age: ld.age,
            job_title: ld.job_title ?? ld.jobTitle ?? '',
            lifestyle_tags: ld.lifestyle_tags ?? ld.tags ?? [],
          }
        : {
            images: ld.images ?? (ld.image ? [ld.image] : []),
            price: ld.price,
            neighbourhood: ld.neighbourhood ?? ld.location ?? '',
            bedrooms: ld.bedrooms ?? ld.beds,
            commute_minutes: ld.commute_minutes ?? ld.commute,
            address: ld.address,
            size_sqm: ld.size_sqm ?? ld.sqm,
          }
      return {
        id: ld.match_id ?? ld.id ?? `fav-${f.id}`,
        type: isFlatmate ? 'flatmate' : 'listing',
        status: 'approved',
        score: ld.matchPct ?? ld.score ?? null,
        match_reasons: ld.reasons ?? ld.match_reasons ?? [],
        trade_offs: ld.tradeoffs ?? ld.trade_offs ?? [],
        agent_reasoning: ld.agentReasoning ?? ld.agent_reasoning ?? '',
        created_at: f.created_at,
        data,
      }
    })
  }, [favourites])

  const { activeMatches, rejectedMatches } = useMemo(() => {
    const active = []
    const rejected = []
    for (const m of matches) {
      if (m.status === 'rejected') rejected.push(m)
      else active.push(m)
    }

    // Merge favourites into active matches when the current view should
    // include approved items, deduping by id and respecting the type filter.
    const includeFavs = viewMode === 'favorites' || !statusFilter || statusFilter === 'approved'
    if (includeFavs) {
      const seen = new Set(active.map((m) => m.id))
      for (const fm of favouriteMatches) {
        if (typeFilter && fm.type !== typeFilter) continue
        if (seen.has(fm.id)) continue
        seen.add(fm.id)
        active.push(fm)
      }
    }

    return { activeMatches: active, rejectedMatches: rejected }
  }, [matches, favouriteMatches, statusFilter, typeFilter, viewMode])

  // Count of flatmates whose `interested_listing_ids` includes each listing —
  // mirrors the AlsoInterestedSection logic in MatchDetailPanel so the card
  // can surface "X others interested" without opening the detail view.
  const interestedCountByListing = useMemo(() => {
    const map = {}
    for (const m of matches) {
      if (m.type !== 'flatmate') continue
      const ids = m.data?.interested_listing_ids || []
      for (const id of ids) {
        map[id] = (map[id] ?? 0) + 1
      }
    }
    return map
  }, [matches])

  const cardDensity = density === 'detailed' ? 'detailed' : 'standard'

  /* ── SwipeStack decide handler (inline review mode) ──────── */
  const [swipeDecided, setSwipeDecided] = useState(new Set())
  const [swipeQueue, setSwipeQueue] = useState([])

  useEffect(() => {
    if (!isLoading && viewMode === 'review') {
      // Skip listings the user has already messaged the landlord about — no
      // need to swipe through them again.
      setSwipeQueue(
        matches.filter((m) => !swipeDecided.has(m.id) && !convoByMatchId[m.id]),
      )
    }
  }, [matches, isLoading, viewMode, convoByMatchId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Reset swipe state when switching into review mode
    if (viewMode === 'review') {
      setSwipeDecided(new Set())
      setSwipeQueue([])
    }
  }, [viewMode])

  const handleSwipeDecide = useCallback(async (matchId, action) => {
    setSwipeQueue((q) => q.filter((m) => m.id !== matchId))
    setSwipeDecided((d) => new Set([...d, matchId]))
    if (action === 'keep') await approveMatch(matchId)
    else await rejectMatch(matchId)
  }, [approveMatch, rejectMatch])

  /* ── Agent assistant panel state ─────────────────────────── */
  const { open: assistantOpen, setOpen: setAssistantOpen } = useAssistant()
  const [assistantMessages, setAssistantMessages] = useState([])
  const [assistantInput, setAssistantInput] = useState('')
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [clientFilter, setClientFilter] = useState(null) // { field, op, value } or null
  const assistantEndRef = useRef(null)

  useEffect(() => {
    assistantEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [assistantMessages])

  const filteredActiveMatches = useMemo(() => clientFilter
    ? activeMatches.filter((m) => {
        const d = m.data
        switch (clientFilter.field) {
          case 'max_price': return (d.price ?? Infinity) <= clientFilter.value
          case 'min_beds': return (d.bedrooms ?? 0) >= clientFilter.value
          case 'max_commute': return (d.commute_minutes ?? Infinity) <= clientFilter.value
          case 'neighbourhood': return (d.neighbourhood ?? '').toLowerCase().includes(clientFilter.value.toLowerCase())
          default: return true
        }
      })
    : activeMatches
  , [activeMatches, clientFilter])

  const sendAssistantMessage = useCallback(async () => {
    const text = assistantInput.trim()
    if (!text || assistantLoading) return
    setAssistantInput('')
    setAssistantMessages((prev) => [...prev, { role: 'user', text }])
    setAssistantLoading(true)

    // Build a compact summary of current matches for context (no extra API calls to Supabase)
    const matchSummary = activeMatches.slice(0, 20).map((m) => {
      const d = m.data
      if (m.type === 'listing') {
        return `ID:${m.id} €${d.price}/mo ${d.neighbourhood} ${d.bedrooms}bed ${d.commute_minutes}min`
      }
      return `ID:${m.id} ${d.name} ${d.age} ${d.job_title}`
    }).join('\n')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          system: `You are a helpful real estate assistant. The user is browsing their matched listings. Here are their current matches:\n${matchSummary}\n\nYou can suggest filters. If the user wants to filter, respond with a JSON block on its own line like: FILTER:{"field":"max_price","value":1200} — valid fields: max_price, min_beds, max_commute, neighbourhood. If the user wants to clear filters say FILTER:null. Keep answers short and friendly.`,
          messages: [
            ...assistantMessages.map((m) => ({ role: m.role, content: m.text })),
            { role: 'user', content: text },
          ],
        }),
      })
      const data = await res.json()
      const reply = data.content?.[0]?.text ?? 'Sorry, something went wrong.'

      // Check for filter instruction
      const filterMatch = reply.match(/FILTER:(\{.*?\}|null)/)
      if (filterMatch) {
        const parsed = filterMatch[1] === 'null' ? null : JSON.parse(filterMatch[1])
        setClientFilter(parsed)
      }

      const cleanReply = reply.replace(/FILTER:\{.*?\}|FILTER:null/g, '').trim()
      if (cleanReply) {
        setAssistantMessages((prev) => [...prev, { role: 'assistant', text: cleanReply }])
      }
    } catch {
      setAssistantMessages((prev) => [...prev, { role: 'assistant', text: "Couldn't reach the assistant right now." }])
    } finally {
      setAssistantLoading(false)
    }
  }, [assistantInput, assistantLoading, assistantMessages, activeMatches])

  return (
    <div className="flex flex-col min-h-screen">
      {/* Filter bar */}
      <FilterBar
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        sortFilter={sortFilter}
        onType={(v) => setParam('type', v)}
        onStatus={(v) => setParam('status', v)}
        onSort={(v) => setParam('sort', v)}
        viewMode={viewMode}
        onViewMode={setViewMode}
      />

      {/* Main content */}
      <div className="flex-1 px-6 py-6 flex flex-col gap-8">
        {viewMode === 'review' ? (
          /* ── Inline swipe review ─────────────────────────── */
          isLoading ? (
            <div
              style={{
                width: '100%',
                maxWidth: 380,
                height: 420,
                margin: '0 auto',
                borderRadius: 16,
                background: 'var(--surface)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ) : swipeQueue.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div
                style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'var(--accent-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, color: 'var(--accent)',
                }}
              >
                ✦
              </div>
              <p className="text-heading font-medium" style={{ color: 'var(--text-primary)' }}>
                You're all caught up.
              </p>
              <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
                Your agent is searching for more matches.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
              <SwipeStack queue={swipeQueue} onDecide={handleSwipeDecide} />
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.02em' }}>
                ← pass &nbsp;·&nbsp; keep →
              </p>
            </div>
          )
        ) : (
          /* ── Grid view ───────────────────────────────────── */
          <>
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
              </div>
            ) : filteredActiveMatches.length === 0 ? (
              <div
                className="rounded-card p-10 flex flex-col items-center gap-3 text-center"
                style={{ background: 'var(--surface)' }}
              >
                {viewMode === 'favorites'
                  ? <Heart size={28} style={{ color: 'var(--text-secondary)' }} />
                  : <AlertCircle size={28} style={{ color: 'var(--text-secondary)' }} />}
                <p className="text-heading font-medium" style={{ color: 'var(--text-primary)' }}>
                  {viewMode === 'favorites'
                    ? 'No favorites yet'
                    : clientFilter ? 'No matches for this filter' : 'No matches yet'}
                </p>
                <p className="text-body max-w-xs" style={{ color: 'var(--text-secondary)' }}>
                  {viewMode === 'favorites'
                    ? 'Swipe right on a match or save a listing and it will show up here.'
                    : clientFilter
                    ? 'Try adjusting your criteria or ask the assistant to clear filters.'
                    : 'Your agent is still searching. Matches will appear here once it has evaluated enough options.'}
                </p>
              </div>
            ) : (
              <MemoizedGrid
                matches={filteredActiveMatches}
                density={cardDensity}
                onSelect={setSelectedMatch}
                convoByMatchId={convoByMatchId}
                interestedCountByListing={interestedCountByListing}
                onOpenChat={(conversationId) => navigate(`/chats/${conversationId}`)}
              />
            )}

            {/* Rejected section — only in the full grid, not the favorites view */}
            {!isLoading && viewMode === 'grid' && (
              <RejectedMatchesSection
                matches={rejectedMatches}
                density={cardDensity}
                onSelect={(id) => setParam('match', id)}
              />
            )}
          </>
        )}
      </div>

      {/* Detail panel — triggered by clicking a grid card */}
      {selectedMatch && (
        <MatchDetailPanel
          match={selectedMatch}
          allMatches={activeMatches}
          onClose={() => setSelectedMatch(null)}
          onApprove={(match) => { approveMatch(match.id); setSelectedMatch(null) }}
          onRejectDone={() => { setSelectedMatch(null) }}
          conversationId={convoByMatchId[selectedMatch.id] ?? null}
          onOpenChat={(conversationId) => {
            setSelectedMatch(null)
            navigate(`/chats/${conversationId}`)
          }}
        />
      )}

      {/* Approval panel drawer — triggered by URL param (rejected section deep-link) */}
      {viewMode === 'grid' && openMatchId && userId && !selectedMatch && (
        <>
          <div
            className="fixed inset-0 z-30"
            style={{ background: 'rgba(0,0,0,0.3)' }}
            onClick={() => setParam('match', '')}
          />
          <ApprovalPanel
            matchId={openMatchId}
            userId={userId}
            onApprove={approveMatch}
            onRefinement={requestRefinement}
            onClose={() => setParam('match', '')}
          />
        </>
      )}

      {/* ── Assistant FAB + chat box ──────────────────────────── */}
      <div style={{ position: 'fixed', bottom: 24, left: 24, zIndex: 40 }}>
        {/* Chat box (above FAB) */}
        {assistantOpen && (
          <div
            style={{
              position: 'absolute',
              bottom: 64,
              left: 0,
              width: 340,
              height: 420,
              background: 'var(--surface)',
              border: '1px solid rgba(28,24,20,0.1)',
              borderRadius: 18,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'chatPopUp 200ms ease-out',
            }}
          >
            {/* Header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(28,24,20,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <PinkBlob size={20} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                Ask about your matches
              </span>
              {clientFilter && (
                <button
                  onClick={() => setClientFilter(null)}
                  style={{
                    fontSize: 10,
                    padding: '2px 7px',
                    borderRadius: 999,
                    border: '1px solid rgba(109,40,217,0.2)',
                    background: 'rgba(109,40,217,0.06)',
                    color: '#6D28D9',
                    cursor: 'pointer',
                  }}
                >
                  Clear filter
                </button>
              )}
              <button
                onClick={() => setAssistantOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 2 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {assistantMessages.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 24 }}>
                  Ask me anything about your listings — or tell me to filter them.
                </p>
              )}
              {assistantMessages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    padding: '8px 12px',
                    borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                    background: msg.role === 'user' ? '#1C1814' : 'var(--background)',
                    color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  {msg.text}
                </div>
              ))}
              {assistantLoading && (
                <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px' }}>
                  <PinkBlob size={16} />
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Thinking…</span>
                </div>
              )}
              <div ref={assistantEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(28,24,20,0.08)', display: 'flex', gap: 6 }}>
              <input
                value={assistantInput}
                onChange={(e) => setAssistantInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendAssistantMessage() }}
                placeholder="e.g. Show me flats under €1,200"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(28,24,20,0.1)',
                  background: 'var(--background)',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              <button
                onClick={sendAssistantMessage}
                disabled={assistantLoading || !assistantInput.trim()}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: 'none',
                  background: assistantInput.trim() ? '#1C1814' : 'rgba(28,24,20,0.06)',
                  color: assistantInput.trim() ? '#fff' : 'var(--text-secondary)',
                  cursor: assistantInput.trim() ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        )}

        {/* FAB — same PinkBlob the dashboard uses for its main orb.
            Always shows the blob; clicking it toggles the chat open/closed. */}
        <button
          onClick={() => setAssistantOpen((o) => !o)}
          aria-label={assistantOpen ? 'Close assistant' : 'Open assistant'}
          style={{
            width: 64,
            height: 64,
            padding: 0,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.2))',
            animation: assistantOpen ? 'none' : 'fabFloat 3s ease-in-out infinite',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PinkBlob size={64} state="idle" />
        </button>
      </div>
    </div>
  )
}
