const CONFIG = {
  high:   { color: 'var(--success)', glow: 'var(--success-muted)', label: 'High confidence'   },
  medium: { color: 'var(--amber)',   glow: 'var(--amber-muted)',   label: 'Medium confidence' },
  low:    { color: 'var(--danger)',  glow: 'var(--danger-muted)',  label: 'Low confidence'    },
}

export function ConfidenceDot({ confidence, showLabel = false }) {
  const { color, glow, label } = CONFIG[confidence] ?? CONFIG.medium

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 0 3px ${glow}`,
          flexShrink: 0,
        }}
      />
      {showLabel && (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {label}
        </span>
      )}
    </span>
  )
}
