import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, AlertCircle } from 'lucide-react'
import { MatchCard } from '../../../components/ui/MatchCard'
import { MatchDetailPanel } from '../../../components/organisms/MatchDetailPanel'
import {
  approveMatch as approveMatchAction,
  rejectMatch as rejectMatchAction,
} from '../../../lib/dashboard/actions'

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
      commute: d.commute_minutes != null ? `${d.commute_minutes} min` : '—',
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

export function MatchesSection({ matches, density }) {
  const [selectedMatch, setSelectedMatch] = useState(null)

  async function handleApprove(match) {
    await approveMatchAction(match.id)
  }

  async function handleReject(match) {
    await rejectMatchAction(match.id)
  }

  if (!matches.length) {
    return (
      <div
        style={{
          borderRadius: 16,
          padding: '24px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          textAlign: 'center',
        }}
      >
        <AlertCircle size={24} style={{ color: 'var(--text-secondary)' }} />
        <p
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          No strong matches yet
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
          Your agent is still searching. Check back soon.
        </p>
      </div>
    )
  }

  return (
    <>
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <p
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Strong Matches
        </p>
        <Link
          to="/matches"
          className="flex items-center gap-1 transition-opacity duration-200 hover:opacity-70"
          style={{ color: 'var(--accent)', fontSize: 14, textDecoration: 'none' }}
        >
          View All <ChevronRight size={15} />
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        {matches.slice(0, 2).map((match) => (
          <MatchCard
            key={match.id}
            card={toCardShape(match)}
            density={density === 'detailed' ? 'detailed' : 'standard'}
            onSelect={() => setSelectedMatch(match)}
          />
        ))}
      </div>
    </div>

    {selectedMatch && (
      <MatchDetailPanel
        match={selectedMatch}
        onClose={() => setSelectedMatch(null)}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    )}
    </>
  )
}
