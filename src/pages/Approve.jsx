import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Bed, Clock, MapPin, User } from 'lucide-react'
import { useMatch } from '../hooks/useMatch.js'
import { RejectionModal } from '../components/matches/RejectionModal'

/* ── Skeleton ────────────────────────────────────────────────── */
function ApproveSkeleton() {
  return (
    <div className="flex-1 max-w-lg mx-auto w-full px-6 py-6 flex flex-col gap-6 animate-pulse">
      <div className="rounded-card aspect-video" style={{ background: 'var(--surface)' }} />
      <div className="rounded-card p-5 h-28" style={{ background: 'var(--surface)' }} />
      <div className="rounded-card p-5 h-36" style={{ background: 'var(--surface)' }} />
    </div>
  )
}

/* ── Refinement Modal ────────────────────────────────────────── */
function RefinementModal({ onSubmit, onCancel }) {
  const [note, setNote] = useState('')
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="w-full max-w-lg rounded-card p-5 flex flex-col gap-4"
        style={{ background: 'var(--surface)' }}
      >
        <p className="text-heading font-semibold" style={{ color: 'var(--text-primary)' }}>
          What should the agent look for instead?
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. More natural light, closer to Lavapiés…"
          rows={3}
          className="w-full px-4 py-3 rounded-chip text-body outline-none resize-none"
          style={{
            background: 'var(--background)',
            color: 'var(--text-primary)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        />
        <div className="flex gap-3">
          <button
            onClick={() => onSubmit(note)}
            disabled={!note.trim()}
            className="flex-1 py-3 rounded-btn text-body font-semibold cursor-pointer transition-all duration-200"
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', opacity: note.trim() ? 1 : 0.5 }}
          >
            Send to agent
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-btn text-body font-medium cursor-pointer transition-all duration-200"
            style={{ background: 'transparent', color: 'var(--text-primary)', border: '1.5px solid var(--text-secondary)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Listing View ────────────────────────────────────────────── */
function ListingApproveView({ match, onApprove, onRefine, onReject }) {
  const d = match.data
  return (
    <>
      {/* Hero image */}
      <div className="relative rounded-card overflow-hidden shadow-card aspect-video">
        <img
          src={d.images?.[0] ?? ''}
          alt={d.address}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 right-3">
          <span
            className="px-3 py-1 rounded-chip text-meta font-semibold text-white"
            style={{ background: 'var(--accent)' }}
          >
            {match.score}% match
          </span>
        </div>
      </div>

      {/* Property info */}
      <div className="rounded-card p-5 shadow-card" style={{ background: 'var(--surface)' }}>
        <h2 className="text-heading font-semibold" style={{ color: 'var(--text-primary)' }}>
          {d.address}
        </h2>
        <p className="mt-1 text-body font-medium" style={{ color: 'var(--accent)' }}>
          €{d.price?.toLocaleString()} / mo
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-meta" style={{ color: 'var(--text-secondary)' }}>
          <span className="flex items-center gap-1.5">
            <MapPin size={13} /> {d.neighbourhood}
          </span>
          <span className="flex items-center gap-1.5">
            <Bed size={13} /> {d.bedrooms} bed{d.bedrooms !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={13} /> {d.commute_minutes} min commute
          </span>
        </div>
      </div>

      {/* Why I recommend */}
      {match.match_reasons?.length > 0 && (
        <div className="rounded-card p-5 shadow-card" style={{ background: 'var(--surface)' }}>
          <p className="text-body font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Why I recommend this:
          </p>
          <div className="flex flex-col gap-2">
            {match.match_reasons.map((r) => (
              <div key={r} className="flex items-start gap-2 text-body">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade-offs */}
      {match.trade_offs?.length > 0 && (
        <div className="rounded-card p-5 shadow-card" style={{ background: 'var(--surface)' }}>
          <p className="text-body font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Things to consider:
          </p>
          <ul className="flex flex-col gap-2 list-none">
            {match.trade_offs.map((c) => (
              <li key={c} className="flex items-start gap-2 text-body" style={{ color: 'var(--text-secondary)' }}>
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--text-secondary)' }} />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Agent reasoning */}
      {match.agent_reasoning && (
        <div
          className="rounded-card p-5 shadow-card"
          style={{ background: 'color-mix(in srgb, var(--surface) 60%, var(--accent) 8%)' }}
        >
          <p className="text-body italic leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            "{match.agent_reasoning}"
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <button
          onClick={onApprove}
          className="w-full py-3.5 rounded-btn text-body font-semibold transition-all duration-200 cursor-pointer"
          style={{ background: 'var(--accent)', color: '#fff', border: 'none' }}
        >
          Approve outreach
        </button>
        <button
          onClick={onReject}
          className="w-full py-3.5 rounded-btn text-body font-medium transition-all duration-200 cursor-pointer"
          style={{ background: 'transparent', color: 'var(--text-primary)', border: '1.5px solid var(--text-secondary)' }}
        >
          Pass
        </button>
        <button
          onClick={onRefine}
          className="text-center transition-opacity hover:opacity-70"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 14, padding: '4px 0' }}
        >
          Ask agent to refine
        </button>
      </div>
    </>
  )
}

/* ── Flatmate View ───────────────────────────────────────────── */
function FlatmateApproveView({ match, onApprove, onRefine, onReject }) {
  const d = match.data
  return (
    <>
      {/* Avatar */}
      <div className="relative rounded-card overflow-hidden shadow-card flex items-center justify-center" style={{ aspectRatio: '1/1', maxHeight: 280 }}>
        {d.avatar ? (
          <img src={d.avatar} alt={d.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--surface)' }}>
            <User size={64} style={{ color: 'var(--text-secondary)' }} />
          </div>
        )}
        <div className="absolute top-3 right-3">
          <span className="px-3 py-1 rounded-chip text-meta font-semibold text-white" style={{ background: 'var(--accent)' }}>
            {match.score}% match
          </span>
        </div>
      </div>

      {/* Flatmate info */}
      <div className="rounded-card p-5 shadow-card" style={{ background: 'var(--surface)' }}>
        <h2 className="text-heading font-semibold" style={{ color: 'var(--text-primary)' }}>
          {d.name}
        </h2>
        <p className="mt-1 text-body" style={{ color: 'var(--text-secondary)' }}>
          {d.job_title}{d.age ? ` · ${d.age}` : ''}
        </p>
        {d.bio && (
          <p className="mt-3 text-body leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {d.bio}
          </p>
        )}
        {d.lifestyle_tags?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {d.lifestyle_tags.map((tag) => (
              <span key={tag} className="px-3 py-1 rounded-chip text-meta" style={{ background: 'var(--background)', color: 'var(--text-secondary)' }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {match.match_reasons?.length > 0 && (
        <div className="rounded-card p-5 shadow-card" style={{ background: 'var(--surface)' }}>
          <p className="text-body font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Why I recommend this match:
          </p>
          <div className="flex flex-col gap-2">
            {match.match_reasons.map((r) => (
              <div key={r} className="flex items-start gap-2 text-body">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {match.agent_reasoning && (
        <div
          className="rounded-card p-5 shadow-card"
          style={{ background: 'color-mix(in srgb, var(--surface) 60%, var(--accent) 8%)' }}
        >
          <p className="text-body italic leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            "{match.agent_reasoning}"
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <button
          onClick={onApprove}
          className="w-full py-3.5 rounded-btn text-body font-semibold transition-all duration-200 cursor-pointer"
          style={{ background: 'var(--accent)', color: '#fff', border: 'none' }}
        >
          Start conversation
        </button>
        <button
          onClick={onReject}
          className="w-full py-3.5 rounded-btn text-body font-medium transition-all duration-200 cursor-pointer"
          style={{ background: 'transparent', color: 'var(--text-primary)', border: '1.5px solid var(--text-secondary)' }}
        >
          Pass
        </button>
        <button
          onClick={onRefine}
          className="text-center transition-opacity hover:opacity-70"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 14, padding: '4px 0' }}
        >
          Ask agent to refine
        </button>
      </div>
    </>
  )
}

/* ── Approve Page ────────────────────────────────────────────── */
export function Approve() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [showRefinement, setShowRefinement] = useState(false)
  const [showRejectionModal, setShowRejectionModal] = useState(false)

  const { match, isLoading, approve, requestRefinement } = useMatch({ matchId: id })

  async function handleApprove() {
    const result = await approve()
    if (result.success) navigate('/dashboard')
  }

  async function handleRefinement(note) {
    setShowRefinement(false)
    const result = await requestRefinement(note)
    if (result.success) navigate('/dashboard')
  }

  // Redirect if match not found after loading
  if (!isLoading && !match) {
    navigate('/dashboard')
    return null
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4"
        style={{ background: 'var(--background)', boxShadow: '0 1px 0 rgba(255,255,255,0.06)' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-btn flex items-center justify-center transition-all duration-200 cursor-pointer"
          style={{ background: 'var(--surface)', border: 'none', color: 'var(--text-primary)' }}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-heading font-semibold" style={{ color: 'var(--text-primary)' }}>
          Review & Approve
        </h1>
        {match?.status !== 'pending' && (
          <span
            className="ml-auto px-3 py-1 rounded-chip text-meta font-medium capitalize"
            style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
          >
            {match.status}
          </span>
        )}
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-6 py-6 flex flex-col gap-6">
        {isLoading ? (
          <ApproveSkeleton />
        ) : match?.type === 'listing' ? (
          <ListingApproveView
            match={match}
            onApprove={handleApprove}
            onRefine={() => setShowRefinement(true)}
            onReject={() => setShowRejectionModal(true)}
          />
        ) : (
          <FlatmateApproveView
            match={match}
            onApprove={handleApprove}
            onRefine={() => setShowRefinement(true)}
            onReject={() => setShowRejectionModal(true)}
          />
        )}

        <p className="text-center text-meta pb-4" style={{ color: 'var(--text-secondary)' }}>
          You can adjust preferences anytime.
        </p>
      </div>

      {showRefinement && (
        <RefinementModal
          onSubmit={handleRefinement}
          onCancel={() => setShowRefinement(false)}
        />
      )}

      {showRejectionModal && match && (
        <RejectionModal
          matchId={match.id}
          matchType={match.type}
          onComplete={() => navigate('/dashboard')}
          onCancel={() => setShowRejectionModal(false)}
        />
      )}
    </div>
  )
}
