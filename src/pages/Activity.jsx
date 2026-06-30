import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Clock, CheckCircle2, XCircle, Calendar, Download, AlertCircle, RefreshCw } from 'lucide-react'
import { supabase } from '../supabase.js'
import { useActivity } from '../hooks/useActivity.js'
import { getFilteredMatches } from '../lib/dashboard/fetchers.js'

/* ── Helpers ─────────────────────────────────────────────────── */

function formatDateTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function classifyAction(action) {
  if (/approved|rejected|refinement/i.test(action)) return 'user'
  if (/message|chat/i.test(action)) return 'message'
  if (/viewing|scheduled/i.test(action)) return 'viewing'
  return 'agent'
}

const TYPE_ICONS = {
  agent:   <Clock size={14} />,
  user:    <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />,
  message: <Clock size={14} />,
  viewing: <Calendar size={14} style={{ color: 'var(--accent)' }} />,
}

/* ── Skeletons ───────────────────────────────────────────────── */

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <div className="w-4 h-4 rounded-full shrink-0" style={{ background: 'var(--surface)' }} />
          <div className="h-4 rounded flex-1" style={{ background: 'var(--surface)', width: `${50 + (i % 3) * 15}%` }} />
          <div className="h-3 w-12 rounded" style={{ background: 'var(--surface)' }} />
        </div>
      ))}
    </div>
  )
}

/* ── ActivityFilterBar ───────────────────────────────────────── */

const FILTER_OPTIONS = [
  { value: 'all',     label: 'All' },
  { value: 'agent',   label: 'Agent actions' },
  { value: 'user',    label: 'My decisions' },
  { value: 'message', label: 'Messages' },
  { value: 'viewing', label: 'Viewings' },
]

function ActivityFilterBar({ activeType, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {FILTER_OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="px-3 py-1.5 rounded-chip text-meta font-medium transition-all duration-150"
          style={{
            border: `1px solid ${activeType === o.value ? 'var(--accent)' : 'rgba(0,0,0,0.08)'}`,
            background: activeType === o.value ? 'rgba(99,134,241,0.1)' : 'var(--surface)',
            color: activeType === o.value ? 'var(--accent)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ── ActivityFeed ────────────────────────────────────────────── */

function ActivityFeed({ activity, isLoading, onRetry }) {
  if (isLoading) return <FeedSkeleton />

  if (activity.length === 0) {
    return (
      <div
        className="rounded-card p-10 flex flex-col items-center gap-3 text-center"
        style={{ background: 'var(--surface)' }}
      >
        <Clock size={28} style={{ color: 'var(--text-secondary)' }} />
        <p className="text-heading font-medium" style={{ color: 'var(--text-primary)' }}>No activity yet</p>
        <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
          Your agent's actions and your decisions will appear here as your search progresses.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {activity.map((entry) => {
        const type = classifyAction(entry.action)
        return (
          <div
            key={entry.id}
            className="flex items-start gap-3 px-3 py-2.5 rounded-btn hover:bg-opacity-60 transition-colors"
            style={{ background: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <span className="mt-0.5 shrink-0" style={{ color: 'var(--text-secondary)' }}>
              {TYPE_ICONS[type] ?? TYPE_ICONS.agent}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-body" style={{ color: 'var(--text-primary)' }}>{entry.action}</p>
              {entry.detail && (
                <p className="text-meta mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>{entry.detail}</p>
              )}
            </div>
            <span className="text-meta shrink-0" style={{ color: 'var(--text-secondary)' }}>
              {formatDateTime(entry.created_at)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ── DecisionHistory ─────────────────────────────────────────── */

function DecisionHistory({ matches, isLoading }) {
  const decided = matches.filter((m) => ['approved', 'rejected'].includes(m.status))

  if (isLoading) return <FeedSkeleton />

  if (decided.length === 0) {
    return (
      <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
        No decisions made yet. Approve or reject matches on the Matches tab.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {decided.map((match) => {
        const d = match.data
        const label = match.type === 'listing'
          ? `${d.neighbourhood ?? 'Flat'} — €${d.price?.toLocaleString()}/mo`
          : d.name ?? 'Flatmate'
        const isApproved = match.status === 'approved'

        return (
          <div
            key={match.id}
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-card"
            style={{ background: 'var(--surface)' }}
          >
            <div>
              <p className="text-body font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
              <p className="text-meta mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                Score: {match.score} · {match.type}
              </p>
              {match.agent_reasoning && (
                <p className="text-meta mt-1 italic" style={{ color: 'var(--text-secondary)' }}>
                  "{match.agent_reasoning.slice(0, 80)}{match.agent_reasoning.length > 80 ? '…' : ''}"
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isApproved
                ? <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                : <XCircle size={16} style={{ color: 'var(--text-secondary)' }} />
              }
              <span
                className="text-meta font-medium capitalize"
                style={{ color: isApproved ? 'var(--success)' : 'var(--text-secondary)' }}
              >
                {match.status}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── ViewingTracker ──────────────────────────────────────────── */

function ViewingTracker({ matches, isLoading }) {
  const viewings = matches.filter((m) => ['viewing_scheduled', 'contacted'].includes(m.status))

  if (isLoading) return <FeedSkeleton />

  if (viewings.length === 0) {
    return (
      <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
        No viewings scheduled yet. Once you approve outreach for a listing, viewings will appear here.
      </p>
    )
  }

  const STATUS_LABELS = {
    viewing_scheduled: { label: 'Scheduled', color: 'var(--accent)' },
    contacted:         { label: 'Pending confirmation', color: 'var(--warning)' },
    completed:         { label: 'Completed', color: 'var(--success)' },
    cancelled:         { label: 'Cancelled', color: 'var(--text-secondary)' },
  }

  return (
    <div className="flex flex-col gap-3">
      {viewings.map((match) => {
        const d = match.data
        const label = match.type === 'listing'
          ? `${d.neighbourhood ?? 'Flat'} — €${d.price?.toLocaleString()}/mo`
          : d.name ?? 'Flatmate'
        const statusInfo = STATUS_LABELS[match.status] ?? { label: match.status, color: 'var(--text-secondary)' }

        return (
          <div
            key={match.id}
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-card"
            style={{ background: 'var(--surface)' }}
          >
            <div>
              <p className="text-body font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
              <p className="text-meta mt-0.5" style={{ color: 'var(--text-secondary)' }}>Score: {match.score}</p>
            </div>
            <span
              className="text-meta font-medium shrink-0"
              style={{ color: statusInfo.color }}
            >
              {statusInfo.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ── ExportButton ────────────────────────────────────────────── */

function ExportButton({ activity }) {
  function handleExport() {
    const rows = [
      ['Date', 'Action', 'Detail'],
      ...activity.map((e) => [
        new Date(e.created_at).toISOString(),
        e.action,
        e.detail ?? '',
      ]),
    ]
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `estato-activity-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      disabled={activity.length === 0}
      className="flex items-center gap-2 px-4 py-2 rounded-btn text-body font-medium transition-opacity hover:opacity-70"
      style={{
        background: 'var(--surface)', border: '1px solid rgba(0,0,0,0.08)',
        color: 'var(--text-secondary)', cursor: activity.length === 0 ? 'not-allowed' : 'pointer',
        opacity: activity.length === 0 ? 0.4 : 1,
      }}
    >
      <Download size={15} /> Export CSV
    </button>
  )
}

/* ── Activity Page ───────────────────────────────────────────── */

export function Activity() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [userId, setUserId] = useState(null)
  const [allMatches, setAllMatches] = useState([])
  const [matchesLoading, setMatchesLoading] = useState(true)

  const activeType = searchParams.get('type') ?? 'all'
  const setType = (v) => setSearchParams(v !== 'all' ? { type: v } : {})

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { navigate('/'); return }
      setUserId(user.id)
      const matches = await getFilteredMatches(user.id, {})
      setAllMatches(matches)
      setMatchesLoading(false)
    })
  }, [navigate])

  const { activity, isLoading } = useActivity({ userId, type: activeType })

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto flex flex-col gap-10">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-display font-semibold" style={{ color: 'var(--text-primary)' }}>Activity</h1>
        <ExportButton activity={activity} />
      </div>

      {/* Activity log */}
      <section>
        <p className="text-heading font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Full log</p>
        <ActivityFilterBar activeType={activeType} onChange={setType} />
        <ActivityFeed activity={activity} isLoading={isLoading} />
      </section>

      {/* Decision history */}
      <section>
        <p className="text-heading font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Decision history</p>
        <DecisionHistory matches={allMatches} isLoading={matchesLoading} />
      </section>

      {/* Viewing tracker */}
      <section>
        <p className="text-heading font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Viewings</p>
        <ViewingTracker matches={allMatches} isLoading={matchesLoading} />
      </section>
    </div>
  )
}
