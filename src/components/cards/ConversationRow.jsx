import { useState } from 'react'

function Avatar({ name, avatarUrl, size = 40 }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--surface-raised)',
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.35,
        fontWeight: 600,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {initials}
    </div>
  )
}

export function ConversationRow({
  name,
  avatarUrl,
  preview,
  timestamp,
  matchScore,
  matchType,
  unread,
  onClick,
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 12,
        background: hovered ? 'var(--surface-raised)' : 'transparent',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 150ms ease',
      }}
    >
      {/* Avatar */}
      <Avatar name={name} avatarUrl={avatarUrl} />

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: unread ? 600 : 400,
              color: unread ? 'var(--text-primary)' : 'var(--text-secondary)',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {name}
          </p>
          {/* Unread dot */}
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--accent)',
              flexShrink: 0,
              opacity: unread ? 1 : 0,
              transition: 'opacity 150ms ease',
            }}
          />
        </div>
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {preview}
        </p>
      </div>

      {/* Right column */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 4,
          flexShrink: 0,
        }}
      >
        {timestamp && (
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
            {timestamp}
          </p>
        )}
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 500,
            background: 'var(--accent-muted)',
            color: 'var(--accent)',
            whiteSpace: 'nowrap',
          }}
        >
          {matchScore}% {matchType}
        </span>
      </div>
    </div>
  )
}
