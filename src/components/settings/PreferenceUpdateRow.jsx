// high confidence = auto-applied (green dot, no buttons)
// medium confidence = pending (amber dot, Accept + Dismiss)

const DOT_CONFIG = {
  high:   { color: 'var(--success)', glow: 'var(--success-muted)', label: 'Auto-applied' },
  medium: { color: 'var(--amber)',   glow: 'var(--amber-muted)',   label: 'Pending'       },
}

export function PreferenceUpdateRow({ title, timestamp, confidence, onAccept, onDismiss }) {
  const { color, glow, label } = DOT_CONFIG[confidence] ?? DOT_CONFIG.medium
  const isPending = confidence === 'medium'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 0',
      }}
    >
      {/* Timeline dot */}
      <div style={{ paddingTop: 3, flexShrink: 0 }}>
        <span
          style={{
            display: 'block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 0 3px ${glow}`,
          }}
        />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            {title}
          </p>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: '1px 8px',
              borderRadius: 999,
              background: isPending ? 'var(--amber-muted)' : 'var(--success-muted)',
              color: isPending ? 'var(--amber)' : 'var(--success)',
            }}
          >
            {label}
          </span>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
          {timestamp}
        </p>

        {isPending && (onAccept || onDismiss) && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {onAccept && (
              <button
                onClick={onAccept}
                style={{
                  padding: '5px 14px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 500,
                  background: 'var(--success-muted)',
                  color: 'var(--success)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Accept
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                style={{
                  padding: '5px 14px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 500,
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
