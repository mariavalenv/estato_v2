// PinkBlob — animated gradient blob that cycles through four palettes
// (pink → yellow → blue → purple → …) on a 100×100 transparent canvas.
// Pure canvas 2D + JS-driven border-radius morph. No dependencies.

import { useRef, useEffect, useState } from 'react'

/* ── Palettes ───────────────────────────────────────────────────── */
// Each palette has 5 core gradient colours (centre → edge) and 5 accent
// blob colours. All tones kept soft / pastel-leaning.

const PALETTES = [
  // Pink
  {
    core: [
      [212,  50, 108],
      [228,  72, 136],
      [244, 114, 182],
      [251, 182, 218],
      [253, 220, 235],
    ],
    blobs: [
      [212,  50, 108],
      [244,  63,  94],
      [217,  70, 239],
      [251, 113, 133],
      [248, 113, 113],
    ],
  },
  // Yellow
  {
    core: [
      [210, 140,  20],
      [225, 165,  40],
      [240, 195,  80],
      [248, 225, 150],
      [252, 240, 200],
    ],
    blobs: [
      [210, 140,  20],
      [230, 160,  50],
      [245, 180,  60],
      [235, 150,  30],
      [220, 130,  40],
    ],
  },
  // Blue
  {
    core: [
      [ 80, 110, 220],
      [100, 135, 235],
      [140, 165, 245],
      [190, 205, 250],
      [220, 228, 253],
    ],
    blobs: [
      [ 80, 110, 220],
      [ 60,  90, 210],
      [100, 140, 235],
      [120, 155, 240],
      [ 70, 100, 225],
    ],
  },
  // Purple
  {
    core: [
      [130,  60, 210],
      [155,  85, 225],
      [185, 125, 240],
      [215, 180, 250],
      [235, 215, 253],
    ],
    blobs: [
      [130,  60, 210],
      [150,  70, 220],
      [110,  50, 200],
      [165,  90, 230],
      [140,  65, 215],
    ],
  },
]

/* ── Constants ──────────────────────────────────────────────────── */

const SPEED = { idle: 0.38, speaking: 1.40, listening: 1.00 }

// Shared monotonic clock so every PinkBlob instance reads the same `t` on
// every frame and stays perfectly in lock-step, regardless of when it mounted
// or became visible. State-based intensity (morph amp, scale, coreR) still
// applies per instance — only the time base is shared.
const EPOCH = (typeof performance !== 'undefined' ? performance.now() : Date.now())
// Original loop did `t += 0.016 * SPEED.idle` per rAF frame at ~60fps,
// i.e. (0.016 * 60) * SPEED.idle = 0.96 * SPEED.idle per second.
const T_PER_MS = 0.96 * SPEED.idle / 1000
function sharedClock() {
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
  return (now - EPOCH) * T_PER_MS
}

// Six gradient stops: 5 colours from the palette + a final transparent fade
const STOP_POSITIONS = [0.00, 0.20, 0.40, 0.60, 0.80, 1.00]
const STOP_ALPHAS    = [0.95, 0.82, 0.60, 0.32, 0.12, 0.00]

// Phase offsets per accent blob — feeds noise() so each drifts independently
const PHASES = [
  { px: 0.00, py: 1.70 },
  { px: 1.30, py: 0.40 },
  { px: 2.10, py: 2.90 },
  { px: 0.80, py: 1.10 },
  { px: 2.70, py: 0.20 },
]

/* ── Math helpers ───────────────────────────────────────────────── */

// Smooth pseudo-noise: sum of 3 sines at coprime frequencies. Output ≈ [-1, 1].
// Movement never loops because 0.71, 1.37, 0.43 share no rational ratio.
function noise(t, phase) {
  return (
    0.5 * Math.sin(t * 0.71 + phase) +
    0.3 * Math.sin(t * 1.37 + phase * 1.7) +
    0.2 * Math.sin(t * 0.43 + phase * 0.6)
  )
}

// Ease in/out so palettes linger rather than rush through the crossfade
function easeInOut(x) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
}

function lerpRGB(a, b, k) {
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ]
}

function rgba(c, a) {
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`
}

// Blend the 4 palettes based on the animation clock. Both the core gradient
// and accent blobs interpolate from the same palette pair so colours stay in
// sync as the blob shifts hue.
function blendPalette(t) {
  const pos = (t * 0.55) % 4
  const i = Math.floor(pos)
  const k = easeInOut(pos - i)
  const a = PALETTES[i]
  const b = PALETTES[(i + 1) % 4]
  return {
    core:  a.core .map((c, j) => lerpRGB(c, b.core [j], k)),
    blobs: a.blobs.map((c, j) => lerpRGB(c, b.blobs[j], k)),
  }
}

/* ── Public helpers ─────────────────────────────────────────────
   Other components can read the live blended palette without
   subscribing to any state. `currentPalette()` reads the shared
   clock and returns the same blended palette PinkBlob is rendering
   right now. `useCurrentColor()` is a small subscription hook that
   returns the live core[0] colour as an [r,g,b] tuple, throttled
   to ~10 fps so it can drive UI tints (status dot, speak pill
   border, halo) without spamming React. */

export function currentPalette() {
  return blendPalette(sharedClock())
}

export function useCurrentColor() {
  const [color, setColor] = useState(() => {
    const c = currentPalette().core[0]
    return [c[0] | 0, c[1] | 0, c[2] | 0]
  })
  useEffect(() => {
    let raf
    let last = 0
    function loop(now) {
      if (now - last > 100) {
        const c = currentPalette().core[0]
        setColor([c[0] | 0, c[1] | 0, c[2] | 0])
        last = now
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return color
}

/* ── Component ──────────────────────────────────────────────────── */

export function PinkBlob({ size = 160, state = 'idle', phase = 0 }) {
  const canvasRef = useRef(null)
  const wrapRef   = useRef(null)
  const stateRef  = useRef(state)
  // Phase offset is read inside the rAF loop so updating it does not
  // restart the loop or mismatch palettes between instances.
  const phaseRef  = useRef(phase)
  const [visible, setVisible] = useState(true)

  // Mirror state into a ref so the rAF loop can read it without restarting
  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  // Pause the loop when the component leaves the viewport
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const W = 100
    const H = 100
    const cx = W / 2
    const cy = H / 2

    let raf

    function paint() {
      const t = sharedClock()
      const st = stateRef.current
      // Phase offset only affects the *shape* (border-radius morph,
      // accent blob drift, shimmer, breathing). The palette is read
      // from the un-offset clock so all instances stay colour-synced.
      const ts = t + phaseRef.current
      const morphAmp  = st === 'speaking' ? 0.06 : 0.035
      const blobScale = st === 'speaking' ? 1.10 : st === 'listening' ? 1.04 : 1.00
      const coreR     = W * (st === 'speaking' ? 0.54 : 0.48)

      const palette = blendPalette(t)

      ctx.clearRect(0, 0, W, H)

      // ── Core radial gradient (6 stops) ────────────────────────
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR)
      for (let i = 0; i < STOP_POSITIONS.length; i++) {
        const colorIdx = Math.min(i, palette.core.length - 1)
        core.addColorStop(STOP_POSITIONS[i], rgba(palette.core[colorIdx], STOP_ALPHAS[i]))
      }
      ctx.fillStyle = core
      ctx.fillRect(0, 0, W, H)

      // ── Five drifting accent blobs ───────────────────────────
      ctx.globalCompositeOperation = 'source-over'
      for (let i = 0; i < PHASES.length; i++) {
        const ph = PHASES[i]
        const dx = noise(ts,       ph.px) * 0.26 * W
        const dy = noise(ts + 100, ph.py) * 0.26 * H
        const x  = cx + dx
        const y  = cy + dy
        const r  = 22 * blobScale

        const c  = palette.blobs[i]
        const g  = ctx.createRadialGradient(x, y, 0, x, y, r)
        g.addColorStop(0, rgba(c, 0.55))
        g.addColorStop(1, rgba(c, 0.00))
        ctx.fillStyle = g
        ctx.fillRect(0, 0, W, H)
      }

      // ── Idle shimmer ─────────────────────────────────────────
      if (st === 'idle') {
        const sx = cx + Math.sin(ts * 0.28) * 8
        const sy = cy - 22
        const opacity = 0.6 * (0.65 + 0.35 * Math.sin(ts * 2.1))
        // Brighten the palette's core centre colour by +40 on each channel
        const cc = palette.core[0]
        const shimmerC = [
          Math.min(255, cc[0] + 40),
          Math.min(255, cc[1] + 40),
          Math.min(255, cc[2] + 40),
        ]
        const sh = ctx.createRadialGradient(sx, sy, 0, sx, sy, 18)
        sh.addColorStop(0, rgba(shimmerC, opacity))
        sh.addColorStop(1, rgba(shimmerC, 0))
        ctx.fillStyle = sh
        ctx.fillRect(0, 0, W, H)
      }

      // ── Border-radius morph (8 independent control points) ──
      const amp = morphAmp * 100
      const r1 = 50 + Math.sin(ts * 1.10 + 0.0) * amp
      const r2 = 50 + Math.sin(ts * 1.30 + 1.0) * amp
      const r3 = 50 + Math.sin(ts * 0.90 + 2.0) * amp
      const r4 = 50 + Math.sin(ts * 1.50 + 3.0) * amp
      const r5 = 50 + Math.sin(ts * 1.20 + 0.5) * amp
      const r6 = 50 + Math.sin(ts * 0.80 + 1.5) * amp
      const r7 = 50 + Math.sin(ts * 1.40 + 2.5) * amp
      const r8 = 50 + Math.sin(ts * 1.00 + 3.5) * amp
      canvas.style.borderRadius =
        `${r1.toFixed(1)}% ${r2.toFixed(1)}% ${r3.toFixed(1)}% ${r4.toFixed(1)}% / ` +
        `${r5.toFixed(1)}% ${r6.toFixed(1)}% ${r7.toFixed(1)}% ${r8.toFixed(1)}%`

      // ── Breathing scale (idle only) ──────────────────────────
      if (st === 'idle') {
        const s = 1 + 0.030 * Math.sin(ts * 2.1)
        canvas.style.transform = `scale(${s.toFixed(4)})`
      } else {
        canvas.style.transform = 'scale(1)'
      }

      raf = requestAnimationFrame(paint)
    }

    paint()
    return () => cancelAnimationFrame(raf)
  }, [visible])

  return (
    <div
      ref={wrapRef}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        width={100}
        height={100}
        style={{
          width: size,
          height: size,
          display: 'block',
          transformOrigin: '50% 50%',
          willChange: 'border-radius',
        }}
      />
    </div>
  )
}
