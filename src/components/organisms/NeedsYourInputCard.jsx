export function NeedsYourInputCard({ items = [] }) {
  return (
    <div
      style={{
        borderRadius: 16,
        background: 'var(--surface)',
        border: items.length > 0 ? '1px solid var(--border)' : '1px solid var(--border)',
        borderLeft: items.length > 0 ? '3px solid var(--amber)' : '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Needs Your Input
        </p>
        {items.length > 0 && (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              background: 'var(--amber-muted)',
              color: 'var(--amber)',
            }}
          >
            {items.length}
          </span>
        )}
      </div>

      {/* Items */}
      {items.map((item, i) => (
        <div
          key={item.id}
          style={{
            padding: '14px 20px',
            borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
          }}
        >
          <p
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--text-primary)',
              margin: '0 0 10px',
              lineHeight: 1.4,
            }}
          >
            {item.label}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={item.primaryAction.onClick}
              style={{
                padding: '5px 14px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 500,
                background: 'var(--success-muted)',
                color: 'var(--success)',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {item.primaryAction.label}
            </button>
            <button
              onClick={item.secondaryAction.onClick}
              style={{
                padding: '5px 14px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 500,
                background: 'var(--accent-muted)',
                color: 'var(--accent)',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {item.secondaryAction.label}
            </button>
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <p
          style={{
            padding: '16px 20px',
            fontSize: 14,
            color: 'var(--text-secondary)',
            margin: 0,
          }}
        >
          You're all caught up.
        </p>
      )}
    </div>
  )
}
