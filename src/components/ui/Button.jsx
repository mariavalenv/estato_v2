import { useState } from 'react'

const STYLES = {
  primary: {
    height: 52,
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    padding: '0 24px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
  },
  ghost: {
    height: 44,
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 500,
    padding: '0 20px',
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
  },
  'sm-accept': {
    height: 32,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    padding: '0 14px',
    background: 'var(--success-muted)',
    color: 'var(--success)',
    border: '1px solid var(--success)',
  },
  'sm-dismiss': {
    height: 32,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    padding: '0 14px',
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
  },
  'pill-approve': {
    height: 28,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 500,
    padding: '0 12px',
    background: 'var(--success-muted)',
    color: 'var(--success)',
    border: 'none',
  },
  'pill-review': {
    height: 28,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 500,
    padding: '0 12px',
    background: 'var(--accent-muted)',
    color: 'var(--accent)',
    border: 'none',
  },
  'pill-reject': {
    height: 28,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 500,
    padding: '0 12px',
    background: 'var(--danger-muted)',
    color: 'var(--danger)',
    border: 'none',
  },
}

export function Button({ variant = 'primary', onClick, children, loading = false, successState = false }) {
  const [pressed, setPressed] = useState(false)
  const [succeeded, setSucceeded] = useState(false)

  const base = STYLES[variant] ?? STYLES.primary

  function handleClick() {
    if (loading || succeeded) return

    // Press micro-interaction
    setPressed(true)
    setTimeout(() => {
      setPressed(false)
      if (successState && (variant === 'primary' || variant === 'pill-approve' || variant === 'sm-accept')) {
        setSucceeded(true)
        setTimeout(() => setSucceeded(false), 2000)
      }
      onClick?.()
    }, 120)
  }

  const dynamicStyle = succeeded
    ? { ...base, background: 'var(--success)', color: '#fff', border: 'none' }
    : base

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        ...dynamicStyle,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.55 : 1,
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        transition: [
          'transform 100ms ease',
          'background 200ms ease',
          'color 200ms ease',
          'opacity 150ms ease',
        ].join(', '),
        userSelect: 'none',
        whiteSpace: 'nowrap',
        lineHeight: 1,
      }}
    >
      {succeeded ? '✓ Approved' : children}
    </button>
  )
}
