import { Clock, CheckCircle2, ChevronRight, Search } from 'lucide-react'
import { useDensity } from '../contexts/DensityContext'
import { DensityToggle } from '../components/ui/DensityToggle'
import { MatchCard } from '../components/ui/MatchCard'
import { useNavigate } from 'react-router-dom'

/* ── Sample data ─────────────────────────────────────────────── */
const LISTING_CARD = {
  type: 'listing',
  image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80',
  images: [
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&q=80',
  ],
  matchPct: 94,
  price: '€1,150 / mo',
  neighbourhood: 'Malasaña',
  beds: '2 beds',
  commute: '18 min',
  address: 'Calle del Pez 14, 2°A',
  sqm: 68,
  reasons: [
    'Within your €900–€1,200 budget',
    'Great fit for hybrid work schedule',
    'Near Callao metro',
  ],
  tradeoffs: ['Top floor, no lift', 'Shared courtyard can be noisy on weekends'],
  agentReasoning:
    "I'm confident this is a strong fit based on your budget and commute preferences. The neighbourhood matches your social lifestyle well.",
}

const FLATMATE_CARD = {
  type: 'flatmate',
  image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80',
  images: [
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80',
  ],
  matchPct: 91,
  name: 'Lucía M.',
  age: '27',
  jobTitle: 'UX Designer',
  tags: ['Early riser', 'Clean & tidy', 'Professional'],
  reasons: [
    'Shares your hybrid work schedule',
    'Rated highly for cleanliness',
    'Looking in the same neighbourhoods',
  ],
  tradeoffs: ['Has a cat', 'Prefers quiet evenings'],
  agentReasoning:
    "Lucía's routine and cleanliness rating align closely with your preferences. I'd recommend reaching out soon — she's had 3 other interest signals this week.",
}

/* ── Agent Status Card ───────────────────────────────────────── */
function AgentStatusCard() {
  return (
    <div
      className="w-full rounded-card p-6 shadow-card relative overflow-hidden"
      style={{ background: 'var(--surface)' }}
    >
      {/* Radial glow behind orb */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: 24,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,134,241,0.20) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div className="flex items-start justify-between gap-4">
        {/* Left: orb + status */}
        <div className="flex items-center gap-4">
          {/* Pulsing orb — pure CSS */}
          <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
            <div
              className="absolute w-10 h-10 rounded-full orb-ring"
              style={{ background: 'rgba(99,134,241,0.25)' }}
            />
            <div
              className="w-5 h-5 rounded-full orb-pulse"
              style={{ background: 'var(--accent)' }}
            />
          </div>

          <div>
            <p className="text-meta font-medium mb-0.5" style={{ color: 'var(--text-secondary)' }}>
              Agent Status
            </p>
            <p className="text-heading font-semibold" style={{ color: 'var(--text-primary)' }}>
              Reviewing 14 options
            </p>
            <div className="mt-2 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-body">
                <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>2 strong matches identified</span>
              </div>
              <div className="flex items-center gap-2 text-body">
                <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Confidence: High</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: next update */}
        <p className="text-meta shrink-0 mt-1" style={{ color: 'var(--text-secondary)' }}>
          Next update ~2 hours
        </p>
      </div>
    </div>
  )
}

/* ── Recent Activity Card ────────────────────────────────────── */
function RecentActivityCard() {
  const items = [
    'Contacted 3 listings',
    'Evaluated 21 flatmate profiles',
    'Discarded 5 options',
  ]
  return (
    <div
      className="rounded-card p-5 shadow-card flex-1 min-w-0"
      style={{ background: 'var(--surface)' }}
    >
      <p className="text-heading font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        Recent Activity
      </p>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-3 text-body" style={{ color: 'var(--text-secondary)' }}>
            <Clock size={14} className="shrink-0" style={{ color: 'var(--text-secondary)' }} />
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Needs Your Input Card ───────────────────────────────────── */
function NeedsInputCard() {
  const navigate = useNavigate()
  const rows = [
    {
      label: 'Match #94 — Malasaña flat',
      sub: 'Agent awaiting your approval',
      action: 'Review',
      onClick: () => navigate('/approve/1'),
    },
    {
      label: 'Lucía M. wants to connect',
      sub: 'Sent you a message 2h ago',
      action: 'View',
      onClick: () => navigate('/chat/1'),
    },
  ]

  return (
    <div
      className="rounded-card p-5 shadow-card flex-1 min-w-0"
      style={{ background: 'var(--surface)' }}
    >
      <p className="text-heading font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        Needs Your Input
      </p>
      <div className="flex flex-col gap-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <div>
              <p className="text-body font-medium" style={{ color: 'var(--text-primary)' }}>
                {row.label}
              </p>
              <p className="text-meta" style={{ color: 'var(--text-secondary)' }}>
                {row.sub}
              </p>
            </div>
            <button
              onClick={row.onClick}
              className="px-3 py-1 rounded-chip text-meta font-medium transition-all duration-200 shrink-0 cursor-pointer"
              style={{
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
              }}
            >
              {row.action}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Dashboard Page ──────────────────────────────────────────── */
export function Dashboard() {
  const { density } = useDensity()

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-display font-semibold" style={{ color: 'var(--text-primary)' }}>
            Good morning, Maria
          </h1>
          <p className="mt-1 text-body" style={{ color: 'var(--text-secondary)' }}>
            Your agent is on it.
          </p>
        </div>
        <DensityToggle />
      </div>

      {/* Start flat-hunting CTA */}
      <button
        onClick={() => navigate('/screening')}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-btn text-body font-semibold transition-all duration-200 hover:opacity-88 cursor-pointer"
        style={{ background: 'var(--accent)', color: '#fff', border: 'none' }}
      >
        <Search size={16} />
        Start flat-hunting
      </button>

      {/* Agent status — always visible */}
      <AgentStatusCard />

      {/* Two column: activity + input */}
      {density !== 'minimal' && (
        <div className="flex flex-col sm:flex-row gap-4">
          <RecentActivityCard />
          <NeedsInputCard />
        </div>
      )}

      {density === 'minimal' && (
        <NeedsInputCard />
      )}

      {/* Strong Matches */}
      {density !== 'minimal' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-heading font-semibold" style={{ color: 'var(--text-primary)' }}>
              Strong Matches
            </p>
            <button
              className="flex items-center gap-1 text-body transition-opacity duration-200 hover:opacity-70 cursor-pointer"
              style={{ background: 'none', border: 'none', color: 'var(--accent)', padding: 0 }}
            >
              View All <ChevronRight size={15} />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <MatchCard card={LISTING_CARD} density={density === 'detailed' ? 'detailed' : 'standard'} />
            <MatchCard card={FLATMATE_CARD} density={density === 'detailed' ? 'detailed' : 'standard'} />
          </div>
        </div>
      )}
    </div>
  )
}
