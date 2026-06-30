export function PermissionToggleRow({ label, description, checked, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
        padding: '14px 0',
      }}
    >
      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          {label}
        </p>
        {description && (
          <p
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              margin: '3px 0 0',
              lineHeight: 1.4,
            }}
          >
            {description}
          </p>
        )}
      </div>

      {/* Toggle switch: 42×24px track, 18px thumb */}
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          position: 'relative',
          width: 42,
          height: 24,
          borderRadius: 999,
          background: checked ? 'var(--accent)' : 'var(--surface-raised)',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          padding: 0,
          flexShrink: 0,
          transition: 'background 200ms ease',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 19 : 2,     // 42 - 18 - 3px right gap - 1px border×2 ≈ 19
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: checked ? '#fff' : 'var(--text-secondary)',
            transition: 'left 200ms cubic-bezier(0.34, 1.56, 0.64, 1), background 200ms ease',
          }}
        />
      </button>
    </div>
  )
}
