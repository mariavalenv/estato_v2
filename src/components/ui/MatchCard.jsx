import { useState } from 'react'
import { CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Bed, Clock, MapPin } from 'lucide-react'

// ── Listing card data shape ─────────────────────────────────────
// {
//   type: 'listing' | 'flatmate',
//   image: string,
//   images?: string[],          // for carousel in detailed
//   matchPct: number,
//   price: string,              // listing only
//   neighbourhood: string,      // listing only
//   beds: string,               // listing only
//   commute: string,            // listing only
//   address?: string,           // listing detailed
//   sqm?: string,               // listing detailed
//   reasons: string[],
//   tradeoffs?: string[],       // detailed only
//   agentReasoning?: string,    // detailed only
//   name: string,               // flatmate only
//   photo?: string,             // flatmate only
//   age?: string,               // flatmate only
//   jobTitle?: string,          // flatmate only
//   tags?: string[],            // flatmate only
// }

function MatchBadge({ pct }) {
  return (
    <span
      className="px-2 py-0.5 rounded-chip text-meta font-semibold text-white"
      style={{ background: 'var(--accent)' }}
    >
      {pct}% match
    </span>
  )
}

function CheckReason({ text }) {
  return (
    <div className="flex items-start gap-2 text-body">
      <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} />
      <span style={{ color: 'var(--text-secondary)' }}>{text}</span>
    </div>
  )
}

function TradeoffItem({ text }) {
  return (
    <div className="flex items-start gap-2 text-body">
      <AlertCircle size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
      <span style={{ color: 'var(--text-secondary)' }}>{text}</span>
    </div>
  )
}

function ImageCarousel({ images = [], alt = '' }) {
  const [idx, setIdx] = useState(0)

  const prev = (e) => { e.stopPropagation(); setIdx((i) => (i - 1 + images.length) % images.length) }
  const next = (e) => { e.stopPropagation(); setIdx((i) => (i + 1) % images.length) }

  return (
    <div className="relative w-full h-48 overflow-hidden rounded-t-card">
      <img
        src={images[idx]}
        alt={alt}
        className="w-full h-full object-cover transition-opacity duration-200"
      />
      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            <ChevronRight size={14} />
          </button>
          {/* dots */}
          <div className="absolute top-2 right-2 flex gap-1">
            {images.map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full transition-all duration-200"
                style={{ background: i === idx ? '#fff' : 'rgba(255,255,255,0.45)' }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function MatchCard({ card, density = 'standard' }) {
  const isListing = card.type === 'listing'
  const imgs = card.images || [card.image]

  /* ── MINIMAL ─────────────────────────────────── */
  if (density === 'minimal') {
    return (
      <div
        className="relative rounded-card overflow-hidden shadow-card flex-1 min-w-0"
        style={{ background: 'var(--surface)' }}
      >
        <img
          src={card.image}
          alt={isListing ? card.neighbourhood : card.name}
          className="w-full h-52 object-cover"
        />
        <div
          className="absolute inset-x-0 bottom-0 px-4 py-3"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)' }}
        >
          <div className="flex items-end justify-between">
            <div>
              {isListing ? (
                <>
                  <p className="text-white font-semibold text-heading leading-tight">{card.price}</p>
                  <p className="text-white/70 text-meta">{card.neighbourhood}</p>
                </>
              ) : (
                <>
                  <p className="text-white font-semibold text-heading leading-tight">{card.name}</p>
                  <p className="text-white/70 text-meta">{card.jobTitle}</p>
                </>
              )}
            </div>
            <span
              className="px-2 py-0.5 rounded-chip text-meta font-semibold text-white shrink-0"
              style={{ background: 'rgba(99,134,241,0.85)' }}
            >
              High Match
            </span>
          </div>
        </div>
      </div>
    )
  }

  /* ── STANDARD ────────────────────────────────── */
  if (density === 'standard') {
    return (
      <div
        className="rounded-card overflow-hidden shadow-card flex-1 min-w-0"
        style={{ background: 'var(--surface)' }}
      >
        <div className="relative">
          <img
            src={card.image}
            alt={isListing ? card.neighbourhood : card.name}
            className="w-full h-44 object-cover"
          />
          <div className="absolute top-3 right-3">
            <MatchBadge pct={card.matchPct} />
          </div>
        </div>
        <div className="p-4 flex flex-col gap-3">
          {isListing ? (
            <div>
              <p className="font-semibold text-heading" style={{ color: 'var(--text-primary)' }}>
                {card.price}
              </p>
              <div className="flex items-center gap-3 mt-1 text-meta" style={{ color: 'var(--text-secondary)' }}>
                <span className="flex items-center gap-1">
                  <MapPin size={11} /> {card.neighbourhood}
                </span>
                <span className="flex items-center gap-1">
                  <Bed size={11} /> {card.beds}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={11} /> {card.commute}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <p className="font-semibold text-heading" style={{ color: 'var(--text-primary)' }}>
                {card.name}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-meta" style={{ color: 'var(--text-secondary)' }}>{card.age}</span>
                <span className="text-meta" style={{ color: 'var(--text-secondary)' }}>·</span>
                <span className="text-meta" style={{ color: 'var(--text-secondary)' }}>{card.jobTitle}</span>
              </div>
              {card.tags && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {card.tags.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-chip text-meta"
                      style={{ background: 'var(--background)', color: 'var(--text-secondary)' }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <p className="text-meta font-medium" style={{ color: 'var(--text-secondary)' }}>
              Matched because:
            </p>
            {card.reasons.slice(0, 3).map((r) => (
              <CheckReason key={r} text={r} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ── DETAILED ────────────────────────────────── */
  return (
    <div
      className="rounded-card overflow-hidden shadow-card flex-1 min-w-0"
      style={{ background: 'var(--surface)' }}
    >
      <div className="relative">
        <ImageCarousel images={imgs} alt={isListing ? card.neighbourhood : card.name} />
        <div className="absolute top-3 right-3">
          <MatchBadge pct={card.matchPct} />
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {isListing ? (
          <div>
            <p className="font-semibold text-heading" style={{ color: 'var(--text-primary)' }}>
              {card.price}
            </p>
            {card.address && (
              <p className="text-meta mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {card.address}
              </p>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-meta flex-wrap" style={{ color: 'var(--text-secondary)' }}>
              <span className="flex items-center gap-1"><MapPin size={11} />{card.neighbourhood}</span>
              <span className="flex items-center gap-1"><Bed size={11} />{card.beds}</span>
              <span className="flex items-center gap-1"><Clock size={11} />{card.commute}</span>
              {card.sqm && <span>{card.sqm} m²</span>}
            </div>
          </div>
        ) : (
          <div>
            <p className="font-semibold text-heading" style={{ color: 'var(--text-primary)' }}>
              {card.name}
            </p>
            <p className="text-meta mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {card.age} · {card.jobTitle}
            </p>
            {card.tags && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {card.tags.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-chip text-meta"
                    style={{ background: 'var(--background)', color: 'var(--text-secondary)' }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Match reasons */}
        <div className="flex flex-col gap-1.5">
          <p className="text-meta font-medium" style={{ color: 'var(--text-secondary)' }}>
            Matched because:
          </p>
          {card.reasons.map((r) => (
            <CheckReason key={r} text={r} />
          ))}
        </div>

        {/* Trade-offs */}
        {card.tradeoffs && card.tradeoffs.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-meta font-medium" style={{ color: 'var(--text-secondary)' }}>
              Trade-offs:
            </p>
            {card.tradeoffs.map((t) => (
              <TradeoffItem key={t} text={t} />
            ))}
          </div>
        )}

        {/* Agent reasoning */}
        {card.agentReasoning && (
          <div
            className="p-3 rounded-btn text-body italic"
            style={{
              background: 'var(--background)',
              color: 'var(--text-secondary)',
              transform: 'translateX(4px)',
              borderLeft: '2px solid var(--accent)',
            }}
          >
            "{card.agentReasoning}"
          </div>
        )}
      </div>
    </div>
  )
}
