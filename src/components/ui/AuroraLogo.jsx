// AuroraLogo — 22px mini aurora orb sharing the same globalT loop as AuroraOrb

import { useRef, useEffect } from 'react'
import { useAuroraLoop } from './AuroraOrb'

const BLOBS = [
  { ax:.28,ay:.22,fx:.37,fy:.29,px:0,   py:0,   r:.52, col:'rgba(109,40,217,', a:.95 },
  { ax:.30,ay:.24,fx:.19,fy:.41,px:1.2, py:.8,  r:.38, col:'rgba(192,38,211,', a:.80 },
  { ax:.22,ay:.34,fx:.53,fy:.23,px:2.1, py:1.6, r:.34, col:'rgba(236,72,153,', a:.60 },
  { ax:.18,ay:.27,fx:.31,fy:.47,px:.5,  py:2.4, r:.30, col:'rgba(14,165,233,',  a:.55 },
  { ax:.24,ay:.18,fx:.61,fy:.33,px:3.1, py:.3,  r:.28, col:'rgba(251,191,36,',  a:.30 },
]

const SPEED_IDLE = 0.38

function paint(ctx, W, H, t) {
  ctx.clearRect(0, 0, W, H)

  const bg = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.65)
  bg.addColorStop(0,   'rgba(28,8,58,0.95)')
  bg.addColorStop(0.6, 'rgba(16,4,38,0.95)')
  bg.addColorStop(1,   'rgba(6,2,18,0.95)')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  for (let i = 0; i < BLOBS.length; i++) {
    const b = BLOBS[i]
    const x = (0.5 + b.ax * Math.sin(t * b.fx + b.px)) * W
    const y = (0.5 + b.ay * Math.cos(t * b.fy + b.py)) * H
    const radius = b.r * W * SPEED_IDLE

    ctx.globalCompositeOperation = i === 0 ? 'source-over' : 'screen'

    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
    grad.addColorStop(0, b.col + b.a + ')')
    grad.addColorStop(1, b.col + '0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)
  }

  ctx.globalCompositeOperation = 'screen'
  const shimmer = ctx.createRadialGradient(W * 0.5, H * 0.44, 0, W * 0.5, H * 0.44, W * 0.28)
  shimmer.addColorStop(0, 'rgba(210,190,255,0.16)')
  shimmer.addColorStop(1, 'rgba(210,190,255,0)')
  ctx.fillStyle = shimmer
  ctx.fillRect(0, 0, W, H)

  ctx.globalCompositeOperation = 'source-over'
}

export function AuroraLogo({ className = '' }) {
  const canvasRef = useRef(null)
  const t = useAuroraLoop()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    paint(ctx, 200, 200, t)
  })

  return (
    <div
      style={{
        width: 22,
        height: 22,
        overflow: 'hidden',
        animation: 'morph-idle 14s ease-in-out infinite',
        flexShrink: 0,
      }}
      className={className}
    >
      <canvas
        ref={canvasRef}
        width={200}
        height={200}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  )
}
