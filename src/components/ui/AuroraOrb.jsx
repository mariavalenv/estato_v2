// AuroraOrb — soft pink blob designed for light backgrounds.
// No hard edge: the canvas paints beyond the layout box so radial gradients
// feather naturally into the parent background.
// Shares a single rAF loop via useAuroraLoop() so all instances stay in sync.

import { useRef, useEffect, useSyncExternalStore } from 'react'

/* ── Shared animation loop ──────────────────────────────────────── */

let globalT = 0
let rafId = null
let lastTs = 0
let subscribers = new Set()

function tick(ts) {
  if (lastTs) globalT += (ts - lastTs) / 1000
  lastTs = ts
  for (const cb of subscribers) cb()
  rafId = requestAnimationFrame(tick)
}

function subscribe(cb) {
  subscribers.add(cb)
  if (subscribers.size === 1) {
    lastTs = 0
    rafId = requestAnimationFrame(tick)
  }
  return () => {
    subscribers.delete(cb)
    if (subscribers.size === 0) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }
}

function getSnapshot() { return globalT }

export function useAuroraLoop() {
  return useSyncExternalStore(subscribe, getSnapshot)
}

/* ── Blob config ────────────────────────────────────────────────── */
// Layered outer→inner. All use plain alpha compositing on a transparent
// canvas so the parent background shows through outside the gradients.
//
// IMPORTANT: every blob's reach (r + ax/ay) must stay below ~0.46 so the
// gradient fully fades to alpha 0 before hitting the canvas edge.
// Otherwise you get a visible square cutoff.

const BLOBS = [
  // Wide soft pink halo — slow drifting outer glow
  { ax:.10, ay:.08, fx:.23, fy:.19, px:0,   py:0,   r:.34, col:'rgba(252,207,232,', a:.70 },
  // Mid coral pink — faster, larger drift
  { ax:.13, ay:.11, fx:.41, fy:.33, px:1.3, py:.7,  r:.26, col:'rgba(244,114,182,', a:.55 },
  // Hot magenta core — orbits around the middle
  { ax:.10, ay:.09, fx:.37, fy:.45, px:2.0, py:1.6, r:.19, col:'rgba(219,39,119,',  a:.65 },
  // Deepest crimson dot — gives the core its saturated bite
  { ax:.07, ay:.06, fx:.53, fy:.39, px:.4,  py:2.2, r:.11, col:'rgba(190,24,93,',   a:.55 },
]

const SPEED = { idle: 0.55, speaking: 1.40, listening: 0.95 }

/* ── Canvas paint ───────────────────────────────────────────────── */

function paint(ctx, W, H, t, speedMult) {
  ctx.clearRect(0, 0, W, H)

  // Time is multiplied by speedMult so speaking/listening genuinely move faster
  const tt = t * speedMult

  for (let i = 0; i < BLOBS.length; i++) {
    const b = BLOBS[i]
    const x = (0.5 + b.ax * Math.sin(tt * b.fx + b.px)) * W
    const y = (0.5 + b.ay * Math.cos(tt * b.fy + b.py)) * H
    // Per-blob breathing — radius oscillates ±10% so the shape feels alive
    const breathe = 1 + 0.10 * Math.sin(tt * b.fx * 0.8 + b.py)
    const radius = b.r * W * breathe

    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
    grad.addColorStop(0, b.col + b.a + ')')
    grad.addColorStop(1, b.col + '0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)
  }
}

/* ── Size helper ────────────────────────────────────────────────── */

export function orbSizeFromPending(pendingCount) {
  const core  = 120 + pendingCount * 5
  const stage = core * 3.6
  return { core, stage }
}

/* ── AuroraOrb ──────────────────────────────────────────────────── */

const PAINT = 360       // internal canvas resolution
const BLEED = 2.2       // canvas display size = size * BLEED (so it spills past the layout box)

export function AuroraOrb({ state = 'idle', size = 88, className = '' }) {
  const canvasRef = useRef(null)
  const t = useAuroraLoop()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    paint(ctx, PAINT, PAINT, t, SPEED[state] ?? SPEED.idle)
  })

  const visual = size * BLEED

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
      }}
      className={className}
    >
      <canvas
        ref={canvasRef}
        width={PAINT}
        height={PAINT}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: visual,
          height: visual,
          transform: 'translate(-50%, -50%)',
          display: 'block',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
