export function ScoreBadge({ score }) {
  let bg, color, border

  if (score >= 80) {
    bg = 'var(--accent)'
    color = '#fff'
    border = 'none'
  } else if (score >= 60) {
    bg = 'var(--warning-muted)'
    color = 'var(--warning)'
    border = '1px solid var(--warning)'
  } else {
    bg = 'var(--danger-muted)'
    color = 'var(--danger)'
    border = '1px solid var(--danger)'
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.4,
        background: bg,
        color,
        border,
        whiteSpace: 'nowrap',
      }}
    >
      {score}% match
    </span>
  )
}
