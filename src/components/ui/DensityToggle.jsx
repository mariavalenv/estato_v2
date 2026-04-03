import { useDensity } from '../../contexts/DensityContext'

const OPTIONS = ['Minimal', 'Standard', 'Detailed']

export function DensityToggle() {
  const { density, setDensity } = useDensity()

  return (
    <div
      className="flex gap-1 rounded-chip p-1"
      style={{ background: 'var(--surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}
    >
      {OPTIONS.map((label) => {
        const value = label.toLowerCase()
        const active = density === value
        return (
          <button
            key={value}
            onClick={() => setDensity(value)}
            className="px-3 py-1 text-meta font-medium rounded-chip transition-all duration-200 cursor-pointer"
            style={{
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? '#fff' : 'var(--text-secondary)',
              border: 'none',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
