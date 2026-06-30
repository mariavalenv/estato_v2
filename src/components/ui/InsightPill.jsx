export function InsightPill({ children }) {
  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 12,
        background: 'var(--accent-muted)',
        border: '1px solid rgba(99,102,241,0.16)',
      }}
    >
      <span
        style={{
          color: 'var(--accent)',
          fontSize: 14,
          lineHeight: 1.5,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        ✦
      </span>
      <span
        style={{
          fontSize: 14,
          lineHeight: 1.5,
          color: 'var(--text-primary)',
        }}
      >
        {children}
      </span>
    </div>
  )
}
