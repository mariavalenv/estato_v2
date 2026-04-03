import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Bed, Clock, MapPin } from 'lucide-react'

const LISTING = {
  name: 'Calle del Pez 14, 2°A',
  price: '€1,150 / mo',
  beds: '2 beds',
  commute: '18 min to centre',
  neighbourhood: 'Malasaña',
  matchPct: 94,
  image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&q=80',
  reasons: [
    'Within your €900–€1,200 budget',
    'Perfect for your hybrid work schedule',
    'Under 20-minute commute to Callao',
    'Located in your preferred neighbourhood',
  ],
  considerations: [
    'Top floor with no lift — 4 flights of stairs',
    'Shared interior courtyard may be noisy on weekends',
    'No direct natural light in one bedroom',
  ],
  agentQuote:
    "I'm confident this is a strong fit based on your budget, commute preferences, and lifestyle. The neighbourhood is vibrant but not overwhelming. Shall I reach out to schedule a viewing?",
}

export function Approve() {
  const navigate = useNavigate()

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--background)' }}
    >
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
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-6 py-6 flex flex-col gap-6">
        {/* Hero image */}
        <div className="relative rounded-card overflow-hidden shadow-card aspect-video">
          <img
            src={LISTING.image}
            alt={LISTING.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-3 right-3">
            <span
              className="px-3 py-1 rounded-chip text-meta font-semibold text-white"
              style={{ background: 'var(--accent)' }}
            >
              {LISTING.matchPct}% match
            </span>
          </div>
        </div>

        {/* Property info */}
        <div
          className="rounded-card p-5 shadow-card"
          style={{ background: 'var(--surface)' }}
        >
          <h2 className="text-heading font-semibold" style={{ color: 'var(--text-primary)' }}>
            {LISTING.name}
          </h2>
          <p className="mt-1 text-body font-medium" style={{ color: 'var(--accent)' }}>
            {LISTING.price}
          </p>
          <div
            className="mt-3 flex flex-wrap gap-4 text-meta"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span className="flex items-center gap-1.5">
              <MapPin size={13} /> {LISTING.neighbourhood}
            </span>
            <span className="flex items-center gap-1.5">
              <Bed size={13} /> {LISTING.beds}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={13} /> {LISTING.commute}
            </span>
          </div>
        </div>

        {/* Why I recommend */}
        <div
          className="rounded-card p-5 shadow-card"
          style={{ background: 'var(--surface)' }}
        >
          <p className="text-body font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Why I recommend this:
          </p>
          <div className="flex flex-col gap-2">
            {LISTING.reasons.map((r) => (
              <div key={r} className="flex items-start gap-2 text-body">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>{r}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Things to consider */}
        <div
          className="rounded-card p-5 shadow-card"
          style={{ background: 'var(--surface)' }}
        >
          <p className="text-body font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Things to consider:
          </p>
          <ul className="flex flex-col gap-2 list-none">
            {LISTING.considerations.map((c) => (
              <li key={c} className="flex items-start gap-2 text-body" style={{ color: 'var(--text-secondary)' }}>
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--text-secondary)' }} />
                {c}
              </li>
            ))}
          </ul>
        </div>

        {/* Agent quote */}
        <div
          className="rounded-card p-5 shadow-card"
          style={{ background: 'color-mix(in srgb, var(--surface) 60%, var(--accent) 8%)' }}
        >
          <p
            className="text-body italic leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            "{LISTING.agentQuote}"
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3.5 rounded-btn text-body font-semibold transition-all duration-200 cursor-pointer"
            style={{ background: 'var(--accent)', color: '#fff', border: 'none' }}
          >
            Approve outreach
          </button>
          <button
            onClick={() => navigate(-1)}
            className="w-full py-3.5 rounded-btn text-body font-medium transition-all duration-200 cursor-pointer"
            style={{
              background: 'transparent',
              color: 'var(--text-primary)',
              border: '1.5px solid var(--text-secondary)',
            }}
          >
            Ask agent to refine
          </button>
        </div>

        <p className="text-center text-meta pb-4" style={{ color: 'var(--text-secondary)' }}>
          You can adjust preferences anytime.
        </p>
      </div>
    </div>
  )
}
