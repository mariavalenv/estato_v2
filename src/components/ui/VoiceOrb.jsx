// VoiceOrb — pure CSS animation, no JS animation library
// Ring keyframe: defined in index.css as `orb-expand-ring`
// Core breathing: `orb-breathe` in index.css

const SIZE = { sm: 40, md: 64, lg: 96 }

const STATE_CONFIG = {
  idle: {
    rings: [
      { delay: '0s' },
      { delay: '0.72s' },
      { delay: '1.44s' },
    ],
    ringDuration: '2.6s',
    coreDuration: '3s',
    ringColor: 'rgba(99,102,241,0.18)',
    coreGradient: 'radial-gradient(circle at 38% 34%, #818cf8, #6366F1 52%, #4338ca)',
  },
  listening: {
    rings: [
      { delay: '0s' },
      { delay: '0.35s' },
    ],
    ringDuration: '1.4s',
    coreDuration: '1.4s',
    ringColor: 'rgba(129,140,248,0.22)',
    coreGradient: 'radial-gradient(circle at 38% 34%, #a5b4fc, #818cf8 52%, #6366F1)',
  },
  speaking: {
    rings: [
      { delay: '0s' },
      { delay: '0.18s' },
      { delay: '0.36s' },
    ],
    ringDuration: '0.75s',
    coreDuration: '0.75s',
    ringColor: 'rgba(196,181,253,0.20)',
    coreGradient: 'radial-gradient(circle at 38% 34%, #c4b5fd, #818cf8 40%, #6366F1)',
  },
}

export function VoiceOrb({ state = 'idle', size = 'md' }) {
  const px = SIZE[size] ?? SIZE.md
  const cfg = STATE_CONFIG[state] ?? STATE_CONFIG.idle

  return (
    <div
      style={{
        position: 'relative',
        width: px,
        height: px,
        flexShrink: 0,
      }}
    >
      {/* Expanding rings */}
      {cfg.rings.map((ring, i) => (
        <div
          key={i}
          className="orb-ring-base"
          style={{
            background: cfg.ringColor,
            '--ring-dur': cfg.ringDuration,
            '--ring-delay': ring.delay,
          }}
        />
      ))}

      {/* Core */}
      <div
        className="orb-core"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: cfg.coreGradient,
          '--core-dur': cfg.coreDuration,
        }}
      />
    </div>
  )
}
