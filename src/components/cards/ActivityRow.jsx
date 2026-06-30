const TYPE_CONFIG = {
  agent:   { icon: '✦', bg: 'var(--accent-muted)',   color: 'var(--accent)'   },
  success: { icon: '✓', bg: 'var(--success-muted)',  color: 'var(--success)'  },
  discard: { icon: '✕', bg: 'var(--danger-muted)',   color: 'var(--danger)'   },
  update:  { icon: '↑', bg: 'var(--warning-muted)',  color: 'var(--warning)'  },
}

export function ActivityRow({ type = 'agent', label, detail, timestamp }) {
  const { icon, bg, color } = TYPE_CONFIG[type] ?? TYPE_CONFIG.agent

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
      }}
    >
      {/* Icon circle */}
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: bg,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-primary)',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </p>
        {detail && (
          <p
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              margin: '2px 0 0',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {detail}
          </p>
        )}
      </div>

      {/* Timestamp */}
      {timestamp && (
        <p
          style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            flexShrink: 0,
            margin: 0,
          }}
        >
          {timestamp}
        </p>
      )}
    </div>
  )
}
