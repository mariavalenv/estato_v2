import { useNavigate } from 'react-router-dom'

export function QuickReviewCard({ count }) {
  const navigate = useNavigate()

  if (count <= 0) return null

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
      }}
    >
      {/* Mini card stack (decorative) */}
      <div style={{ position: 'relative', width: 68, height: 72, flexShrink: 0 }}>
        {/* Card 1 (front) */}
        <div
          style={{
            position: 'absolute',
            width: 48,
            height: 64,
            borderRadius: 8,
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-hover)',
            top: 0,
            left: 0,
            zIndex: 3,
          }}
        />
        {/* Card 2 (middle) */}
        <div
          style={{
            position: 'absolute',
            width: 48,
            height: 64,
            borderRadius: 8,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            top: 5,
            left: 8,
            zIndex: 2,
            opacity: 0.7,
          }}
        />
        {/* Card 3 (back) */}
        <div
          style={{
            position: 'absolute',
            width: 48,
            height: 64,
            borderRadius: 8,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            top: 10,
            left: 16,
            zIndex: 1,
            opacity: 0.4,
          }}
        />
      </div>

      {/* Text content */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-secondary)',
            margin: 0,
            marginBottom: 4,
          }}
        >
          Ready to review
        </p>
        <p
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          {count} match{count !== 1 ? 'es' : ''} waiting
        </p>
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            margin: 0,
            marginTop: 3,
            lineHeight: 1.5,
          }}
        >
          Listings and flatmates your agent has found. Swipe to keep or pass.
        </p>
      </div>

      {/* CTA */}
      <button
        onClick={() => navigate('/review')}
        style={{
          padding: '8px 18px',
          borderRadius: 12,
          background: 'var(--accent)',
          color: '#fff',
          fontSize: 13,
          border: 'none',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'opacity 150ms',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
      >
        Start reviewing
      </button>
    </div>
  )
}
