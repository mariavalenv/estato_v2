import { useState } from 'react'

export function Tag({ label }) {
  const [hovered, setHovered] = useState(false)

  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 400,
        lineHeight: 1.4,
        background: 'var(--surface-raised)',
        color: hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        border: `1px solid ${hovered ? 'var(--border-hover)' : 'var(--border)'}`,
        transition: 'color 150ms ease, border-color 150ms ease',
        cursor: 'default',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      {label}
    </span>
  )
}
