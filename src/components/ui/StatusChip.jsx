const CONFIG = {
  pending:   { label: 'Pending',   dot: 'var(--warning)', bg: 'var(--warning-muted)', color: 'var(--warning)' },
  approved:  { label: 'Approved',  dot: 'var(--success)', bg: 'var(--success-muted)', color: 'var(--success)' },
  contacted: { label: 'Contacted', dot: 'var(--accent)',  bg: 'var(--accent-muted)',  color: 'var(--accent)'  },
  rejected:  { label: 'Rejected',  dot: 'var(--danger)',  bg: 'var(--danger-muted)',  color: 'var(--danger)'  },
}

export function StatusChip({ status }) {
  const { label, dot, bg, color } = CONFIG[status] ?? CONFIG.pending

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.4,
        background: bg,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: dot,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  )
}
