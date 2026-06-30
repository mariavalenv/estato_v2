import { useRef, useEffect } from 'react'

/**
 * DogAvatar — an inline-SVG bulldog whose eyes follow the cursor and who
 * gets excited (ears perk, tongue out, bounce + wag) as the pointer nears.
 *
 * Pure DOM refs + a single rAF loop drive the animation, so React never
 * re-renders on mouse move. Drop-in replacement for the dashboard orb.
 */
export function DogAvatar({ size = 240, style }) {
  const wrapRef = useRef(null)
  const bodyRef = useRef(null)
  const leftPupilRef = useRef(null)
  const rightPupilRef = useRef(null)
  const leftEarRef = useRef(null)
  const rightEarRef = useRef(null)
  const tongueRef = useRef(null)

  // Latest pointer position (viewport coords) + current eased values.
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
          // Pupils max out their small travel quickly, then just point.
          const maxOff = r.width * 0.026
          const reach = Math.min(1, dist / (r.width * 0.32))
          tx = Math.cos(ang) * maxOff * reach
          ty = Math.sin(ang) * maxOff * reach
          // Excitement: 1 when close, fading to 0 as the pointer moves away.
          const near = r.width * 0.85
          const far = r.width * 1.9
          tex = 1 - Math.min(1, Math.max(0, (dist - near) / (far - near)))
        }

        // Critically-damped-ish easing toward targets.
        cur.current.px += (tx - cur.current.px) * 0.2
        cur.current.py += (ty - cur.current.py) * 0.2
        cur.current.ex += (tex - cur.current.ex) * 0.12
        const { px, py, ex } = cur.current

        const pupil = `translate(${px.toFixed(2)}px, ${py.toFixed(2)}px)`
        if (leftPupilRef.current) leftPupilRef.current.style.transform = pupil
        if (rightPupilRef.current) rightPupilRef.current.style.transform = pupil

        if (leftEarRef.current) leftEarRef.current.style.transform = `rotate(${(-ex * 22).toFixed(2)}deg)`
        if (rightEarRef.current) rightEarRef.current.style.transform = `rotate(${(ex * 22).toFixed(2)}deg)`
        if (tongueRef.current) tongueRef.current.style.transform = `scaleY(${(0.04 + ex * 0.96).toFixed(3)})`

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

  const earStyle = (origin) => ({ transformBox: 'fill-box', transformOrigin: origin, transition: 'transform 120ms ease-out' })

  return (
    <div ref={wrapRef} style={{ width: size, height: size, ...style }}>
      <svg viewBox="0 0 240 240" width={size} height={size} style={{ overflow: 'visible', display: 'block' }}>
        <g ref={bodyRef} style={{ transformBox: 'fill-box', transformOrigin: '50% 62%' }}>
          {/* Ears (drawn first so the head overlaps their base) */}
          <g ref={leftEarRef} style={earStyle('86% 18%')}>
            <path d="M74,72 C42,58 26,92 44,124 C58,110 70,90 80,76 Z"
              fill="#fff" stroke="#111" strokeWidth="6" strokeLinejoin="round" />
          </g>
          <g ref={rightEarRef} style={earStyle('14% 18%')}>
            <path d="M166,72 C198,58 214,92 196,124 C182,110 170,90 160,76 Z"
              fill="#fff" stroke="#111" strokeWidth="6" strokeLinejoin="round" />
          </g>

          {/* Head */}
          <path d="M62,86 C62,52 90,40 120,40 C150,40 178,52 178,86
                   C182,112 180,130 168,150 C156,170 140,182 120,182
                   C100,182 84,170 72,150 C60,130 58,112 62,86 Z"
            fill="#fff" stroke="#111" strokeWidth="6" strokeLinejoin="round" />

          {/* Brow wrinkles */}
          <path d="M82,82 Q94,72 108,78" fill="none" stroke="#111" strokeWidth="5" strokeLinecap="round" />
          <path d="M158,82 Q146,72 132,78" fill="none" stroke="#111" strokeWidth="5" strokeLinecap="round" />
          <path d="M110,64 Q120,58 130,64" fill="none" stroke="#111" strokeWidth="5" strokeLinecap="round" />

          {/* Eyes */}
          <g>
            <ellipse cx="96" cy="102" rx="18" ry="17" fill="#fff" stroke="#111" strokeWidth="5" />
            <g ref={leftPupilRef}>
              <circle cx="96" cy="104" r="8" fill="#111" />
              <circle cx="93" cy="101" r="2.6" fill="#fff" />
            </g>
          </g>
          <g>
            <ellipse cx="144" cy="102" rx="18" ry="17" fill="#fff" stroke="#111" strokeWidth="5" />
            <g ref={rightPupilRef}>
              <circle cx="144" cy="104" r="8" fill="#111" />
              <circle cx="141" cy="101" r="2.6" fill="#fff" />
            </g>
          </g>

          {/* Muzzle / jowls */}
          <path d="M82,130 C82,118 158,118 158,130 C162,154 144,174 120,174
                   C96,174 78,154 82,130 Z"
            fill="#fff" stroke="#111" strokeWidth="5" strokeLinejoin="round" />

          {/* Tongue (pops out when excited) — drawn under the nose/mouth */}
          <g ref={tongueRef} style={{ transformBox: 'fill-box', transformOrigin: 'center top' }}>
            <path d="M107,150 Q120,148 133,150 Q133,176 120,182 Q107,176 107,150 Z"
              fill="#ff9aa6" stroke="#111" strokeWidth="4" strokeLinejoin="round" />
            <path d="M120,152 V176" fill="none" stroke="#111" strokeWidth="3" strokeLinecap="round" />
          </g>

          {/* Nose */}
          <path d="M103,122 Q120,114 137,122 Q140,136 120,141 Q100,136 103,122 Z" fill="#111" />
          {/* Philtrum + mouth */}
          <path d="M120,141 V152" fill="none" stroke="#111" strokeWidth="5" strokeLinecap="round" />
          <path d="M120,152 Q106,162 92,154" fill="none" stroke="#111" strokeWidth="5" strokeLinecap="round" />
          <path d="M120,152 Q134,162 148,154" fill="none" stroke="#111" strokeWidth="5" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  )
}
