const ICON_MAP = {
  agent:   { icon: '✦', bg: 'var(--accent-muted)',   color: 'var(--accent)'   },
  success: { icon: '✓', bg: 'var(--success-muted)',  color: 'var(--success)'  },
  discard: { icon: '✕', bg: 'var(--danger-muted)',   color: 'var(--danger)'   },
  update:  { icon: '↑', bg: 'var(--warning-muted)',  color: 'var(--warning)'  },
}

function deriveIconType(item) {
  const t = item.type || item.event_type || ''
  if (ICON_MAP[t]) return t
  const action = (item.action || '').toLowerCase()
  if (/contacted|searched|evaluated/.test(action)) return 'agent'
  if (/matched|identified/.test(action)) return 'success'
  if (/discarded|rejected/.test(action)) return 'discard'
  if (/updated|learned/.test(action)) return 'update'
  return 'agent'
}

const EMPTY = [{ id: 'empty', action: 'Once you start, activity will appear here.' }]

export function ActivityCard({ activity }) {
  const items = activity.length > 0 ? activity : EMPTY

  return (
    <div
      style={{
        borderRadius: 16,
        padding: 20,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        flex: 1,
        minWidth: 0,
      }}
    >
      <p
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-primary)',
          margin: '0 0 16px',
        }}
      >
        Recent Activity
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((item) => {
          const { icon, bg, color } = ICON_MAP[deriveIconType(item)]
          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                fontSize: 14,
                color: 'var(--text-secondary)',
                lineHeight: 1.4,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: bg,
                  color: color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  flexShrink: 0,
                }}
              >
                {icon}
              </div>
              <span style={{ paddingTop: 5 }}>{item.action}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
