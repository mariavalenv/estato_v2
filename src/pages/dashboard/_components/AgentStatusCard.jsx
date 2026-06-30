import { AgentStatusCard as AgentStatusOrganism } from '../../../components/organisms/AgentStatusCard'

function formatNextUpdate(isoString) {
  if (!isoString) return null
  const diff = new Date(isoString) - Date.now()
  if (diff <= 0) return null
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `~${hours}h`
  return `~${mins} min`
}

function deriveProps(agentStatus) {
  if (!agentStatus) return null

  const { city, strong_matches_found = 0, next_update_at, options_reviewed = 0 } = agentStatus
  const matchCount = strong_matches_found ?? 0
  const reviewed = options_reviewed ?? 0

  let statusLabel, detail

  if (matchCount > 0) {
    statusLabel = `${matchCount} strong match${matchCount !== 1 ? 'es' : ''} found.`
    const eta = formatNextUpdate(next_update_at)
    detail = eta ? `Next update in ${eta}.` : `${reviewed} options reviewed so far.`
  } else {
    statusLabel = 'Your agent is searching.'
    detail = `Reviewing options in ${city ?? 'your area'}.`
  }

  const confidence = matchCount >= 5 ? 'high' : matchCount > 0 ? 'medium' : 'low'

  // Map to StatusChip statuses: strong results → approved (green), still searching → pending (amber)
  const status = matchCount > 0 ? 'approved' : 'pending'

  return {
    status,
    statusLabel,
    detail,
    confidence,
    orbState: 'idle',
  }
}

// Inject pulse keyframe once for skeleton animation
if (typeof document !== 'undefined' && !document.getElementById('estato-pulse')) {
  const s = document.createElement('style')
  s.id = 'estato-pulse'
  s.textContent = `@keyframes pulse { from { opacity: 0.4 } to { opacity: 0.8 } }`
  document.head.appendChild(s)
}

export function AgentStatusCard({ agentStatus }) {
  const props = deriveProps(agentStatus)

  if (!props) {
    return (
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          padding: '24px 28px',
          borderRadius: 20,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--surface-raised)',
            flexShrink: 0,
            animation: 'pulse 1.5s ease-in-out infinite alternate',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          <div
            style={{
              width: 120,
              height: 14,
              borderRadius: 6,
              background: 'var(--surface-raised)',
              animation: 'pulse 1.5s ease-in-out infinite alternate',
            }}
          />
          <div
            style={{
              width: 200,
              height: 14,
              borderRadius: 6,
              background: 'var(--surface-raised)',
              animation: 'pulse 1.5s ease-in-out infinite alternate',
              animationDelay: '0.2s',
            }}
          />
        </div>
      </div>
    )
  }

  return <AgentStatusOrganism {...props} />
}
