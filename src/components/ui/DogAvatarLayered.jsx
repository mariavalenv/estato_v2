import { useRef, useEffect } from 'react'

/**
 * DogAvatarLayered — assembles the logo bulldog from transparent-PNG layers
 * so the eyes can follow the cursor and the dog gets excited on approach.
 *
 * Expects these files in /public (all full-canvas & transparent except the
 * tight-cropped pupil):
 *   /dog-face.png   — bulldog with pupils erased, ears + tongue removed
 *   /dog-ear-left.png, /dog-ear-right.png — each ear at rest
 *   /dog-pupil.png  — one dark pupil (tight crop)
 *   /dog-tongue.png — tongue at its mouth position
 *
 * CFG values are fractions of the square canvas (0..1) and get fine-tuned
 * against the actual art after upload. Set `ears:false` to use a v1 where
 * the ears live inside dog-face.png (no ear files).
 */
const CFG = {
  ears: true,
  // Eye-socket centres (where the pupils rest).
  eyeL: { x: 0.405, y: 0.435 },
  eyeR: { x: 0.595, y: 0.435 },
  pupil: 0.085,        // pupil width as a fraction of the canvas
  pupilTravel: 0.022,  // max pupil offset from centre
  // Ear pivots (where the ear meets the head) + how far they perk, in degrees.
  earL: { x: 0.34, y: 0.30, perk: -20 },
  earR: { x: 0.66, y: 0.30, perk: 20 },
  // Tongue grows from its top edge; origin is the mouth point.
  tongue: { x: 0.5, y: 0.62 },
}

export function DogAvatarLayered({ size = 264, style }) {
  const wrapRef = useRef(null)
  const bodyRef = useRef(null)
  const leftPupilRef = useRef(null)
  const rightPupilRef = useRef(null)
  const leftEarRef = useRef(null)
  const rightEarRef = useRef(null)
  const tongueRef = useRef(null)

  const mouse = useRef({ x: 0, y: 0, has: false })
  const cur = useRef({ px: 0, py: 0, ex: 0 })

  useEffect(() => {
    const reduce = typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const onMove = (e) => { mouse.current = { x: e.clientX, y: e.clientY, has: true } }
    window.addEventListener('mousemove', onMove)

    let raf
    let t = 0
    const tick = () => {
      t += 1
      const el = wrapRef.current
      if (el) {
        const r = el.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2

        let tx = 0, ty = 0, tex = 0
        if (mouse.current.has) {
          const dx = mouse.current.x - cx
          const dy = mouse.current.y - cy
          const dist = Math.hypot(dx, dy)
          const ang = Math.atan2(dy, dx)
          const maxOff = r.width * CFG.pupilTravel
          const reach = Math.min(1, dist / (r.width * 0.32))
          tx = Math.cos(ang) * maxOff * reach
          ty = Math.sin(ang) * maxOff * reach
          const near = r.width * 0.85
          const far = r.width * 1.9
          tex = 1 - Math.min(1, Math.max(0, (dist - near) / (far - near)))
        }

        cur.current.px += (tx - cur.current.px) * 0.2
        cur.current.py += (ty - cur.current.py) * 0.2
        cur.current.ex += (tex - cur.current.ex) * 0.12
        const { px, py, ex } = cur.current

        const pupil = `translate(-50%, -50%) translate(${px.toFixed(2)}px, ${py.toFixed(2)}px)`
        if (leftPupilRef.current) leftPupilRef.current.style.transform = pupil
        if (rightPupilRef.current) rightPupilRef.current.style.transform = pupil

        if (leftEarRef.current) leftEarRef.current.style.transform = `rotate(${(ex * CFG.earL.perk).toFixed(2)}deg)`
        if (rightEarRef.current) rightEarRef.current.style.transform = `rotate(${(ex * CFG.earR.perk).toFixed(2)}deg)`
        if (tongueRef.current) {
          tongueRef.current.style.transform = `scaleY(${(0.02 + ex * 0.98).toFixed(3)})`
          tongueRef.current.style.opacity = Math.min(1, ex * 1.4).toFixed(3)
        }

        if (bodyRef.current) {
          const wag = reduce ? 0 : Math.sin(t * 0.22) * 3 * ex
          const hop = reduce ? 0 : -Math.abs(Math.sin(t * 0.22)) * 7 * ex
          const scale = 1 + 0.07 * ex
          bodyRef.current.style.transform =
            `translateY(${hop.toFixed(2)}px) rotate(${wag.toFixed(2)}deg) scale(${scale.toFixed(3)})`
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf) }
  }, [])

  const layer = { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', userSelect: 'none' }
  const pct = (n) => `${n * 100}%`

  return (
    <div ref={wrapRef} style={{ width: size, height: size, position: 'relative', ...style }}>
      <div ref={bodyRef} style={{ position: 'absolute', inset: 0, transformOrigin: '50% 62%', willChange: 'transform' }}>
        {CFG.ears && (
          <img ref={leftEarRef} src="/dog-ear-left.png" alt="" draggable={false}
            style={{ ...layer, transformBox: 'view-box', transformOrigin: `${pct(CFG.earL.x)} ${pct(CFG.earL.y)}` }} />
        )}
        {CFG.ears && (
          <img ref={rightEarRef} src="/dog-ear-right.png" alt="" draggable={false}
            style={{ ...layer, transformBox: 'view-box', transformOrigin: `${pct(CFG.earR.x)} ${pct(CFG.earR.y)}` }} />
        )}

        <img src="/dog-face.png" alt="Alex" draggable={false} style={layer} />

        {/* Tongue — fades + grows out of the mouth when excited */}
        <img ref={tongueRef} src="/dog-tongue.png" alt="" draggable={false}
          style={{ ...layer, opacity: 0, transformBox: 'view-box', transformOrigin: `${pct(CFG.tongue.x)} ${pct(CFG.tongue.y)}` }} />

        {/* Pupils — absolutely placed at each eye centre, translated by the loop */}
        <img ref={leftPupilRef} src="/dog-pupil.png" alt="" draggable={false}
          style={{ position: 'absolute', left: pct(CFG.eyeL.x), top: pct(CFG.eyeL.y), width: pct(CFG.pupil), pointerEvents: 'none' }} />
        <img ref={rightPupilRef} src="/dog-pupil.png" alt="" draggable={false}
          style={{ position: 'absolute', left: pct(CFG.eyeR.x), top: pct(CFG.eyeR.y), width: pct(CFG.pupil), pointerEvents: 'none' }} />
      </div>
    </div>
  )
}
