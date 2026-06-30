import { useDensity } from '../../contexts/DensityContext'

const OPTIONS = ['Minimal', 'Standard', 'Detailed']

export function DensityToggle() {
  const { density, setDensity } = useDensity()
  const activeIdx = OPTIONS.findIndex((o) => o.toLowerCase() === density)

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--surface-raised)',
        border: '1px solid var(--border)',
        borderRadius: 999,
        padding: 3,
      }}
    >
      {/* Spring sliding pill */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 3,
          bottom: 3,
          left: 3,
          width: `calc((100% - 6px) / 3)`,
          borderRadius: 999,
          background: 'var(--accent)',
          transform: `translateX(calc(${activeIdx} * 100%))`,
          transition: 'transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          pointerEvents: 'none',
        }}
      />

      {OPTIONS.map((label) => {
        const value = label.toLowerCase()
        const active = density === value

        return (
          <button
            key={value}
            onClick={() => setDensity(value)}
            style={{
              position: 'relative',
              zIndex: 1,
              padding: '4px 14px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 500,
              lineHeight: 1.4,
              color: active ? '#fff' : 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'color 150ms ease',
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
