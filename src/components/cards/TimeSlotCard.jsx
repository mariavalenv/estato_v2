export function TimeSlotCard({ date, time, selected, onSelect, onConfirm }) {
  return (
    <div
      onClick={onSelect}
      style={{
        padding: '14px 16px',
        borderRadius: 12,
        background: selected ? 'var(--accent-muted)' : 'var(--surface)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        cursor: 'pointer',
        transition: 'background 180ms ease, border-color 180ms ease',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {date}
          </p>
          <p
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: selected ? 'var(--accent)' : 'var(--text-primary)',
              margin: '2px 0 0',
              lineHeight: 1.2,
              transition: 'color 180ms ease',
            }}
          >
            {time}
          </p>
        </div>

        {selected && onConfirm && (
          <button
            onClick={(e) => { e.stopPropagation(); onConfirm() }}
            style={{
              padding: '6px 16px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              animation: 'fadeIn 150ms ease',
            }}
          >
            Confirm
          </button>
        )}
      </div>
    </div>
  )
}
