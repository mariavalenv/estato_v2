import { PinkBlob } from '../ui/PinkBlob'
import { StatusChip } from '../ui/StatusChip'
import { ConfidenceDot } from '../ui/ConfidenceDot'

export function AgentStatusCard({ status, statusLabel, detail, confidence, orbState }) {
  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: '24px 28px',
        borderRadius: 20,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Orb */}
      <PinkBlob state={orbState} size={64} />

      {/* Status text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {statusLabel}
        </p>
        {detail && (
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              margin: '4px 0 0',
              lineHeight: 1.4,
            }}
          >
            {detail}
          </p>
        )}
      </div>

      {/* Right: confidence dot + status chip stacked */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <StatusChip status={status} />
        <ConfidenceDot confidence={confidence} showLabel />
      </div>
    </div>
  )
}
