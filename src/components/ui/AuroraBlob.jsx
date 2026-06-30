import { useRef, useEffect, useState, useCallback } from 'react'

export function AuroraBlob({ size = 24, onClick }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const [visible, setVisible] = useState(false)
  const waveTRef = useRef(0) // shared with animation loop

  // IntersectionObserver — pause when off-screen
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

  // Animation loop — only runs when visible
  useEffect(() => {
    if (!visible) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = 44, H = 44
    let t = 0
    let raf

    const BLOBS = [
      { ax:.30,ay:.25,fx:.38,fy:.30,px:0,   py:0,   r:.55, col:'rgba(109,40,217,', a:.92 },
      { ax:.28,ay:.22,fx:.20,fy:.42,px:1.2, py:.8,  r:.48, col:'rgba(192,38,211,', a:.70 },
      { ax:.20,ay:.32,fx:.55,fy:.25,px:2.1, py:1.6, r:.42, col:'rgba(236,72,153,', a:.48 },
      { ax:.16,ay:.25,fx:.32,fy:.48,px:.5,  py:2.4, r:.34, col:'rgba(14,165,233,',  a:.35 },
    ]

    function paint() {
      ctx.clearRect(0,0,W,H)
      const base = ctx.createRadialGradient(W*.5,H*.5,0,W*.5,H*.5,W*.65)
      base.addColorStop(0,'rgba(28,8,58,1)')
      base.addColorStop(1,'rgba(6,2,18,1)')
      ctx.fillStyle=base; ctx.fillRect(0,0,W,H)
      BLOBS.forEach((b,i) => {
        const x=(.5+Math.sin(t*b.fx+b.px)*b.ax)*W
        const y=(.5+Math.cos(t*b.fy+b.py)*b.ay)*H
        const g=ctx.createRadialGradient(x,y,0,x,y,b.r*W)
        g.addColorStop(0,b.col+b.a+')')
        g.addColorStop(1,b.col+'0)')
        ctx.globalCompositeOperation=i===0?'source-over':'screen'
        ctx.fillStyle=g; ctx.fillRect(0,0,W,H)
      })
      ctx.globalCompositeOperation='source-over'

      // Wave ripple overlay
      const wt = waveTRef.current
      if (wt > 0) {
        const progress = wt
        const radius = progress * W * 0.8
        const alpha = 0.8 * (1 - progress)
        // Bright filled flash that expands and fades
        const flash = ctx.createRadialGradient(W*.5,H*.5, 0, W*.5,H*.5, radius + 6)
        flash.addColorStop(0, `rgba(236,72,153,${alpha * 0.6})`)
        flash.addColorStop(0.4, `rgba(192,38,211,${alpha * 0.8})`)
        flash.addColorStop(0.7, `rgba(109,40,217,${alpha * 0.4})`)
        flash.addColorStop(1, `rgba(109,40,217,0)`)
        ctx.globalCompositeOperation = 'screen'
        ctx.fillStyle = flash
        ctx.fillRect(0,0,W,H)
        ctx.globalCompositeOperation = 'source-over'
        waveTRef.current += 0.035
        if (waveTRef.current >= 1) waveTRef.current = 0
      }
    }

    function loop() { t+=0.012; paint(); raf=requestAnimationFrame(loop) }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [visible])

  const handleClick = useCallback((e) => {
    waveTRef.current = 0.01 // kick off wave
    onClick?.(e)
  }, [onClick])

  return (
    <div ref={wrapRef} onClick={handleClick} style={{
      width: size, height: size, overflow: 'hidden', flexShrink: 0,
      cursor: 'pointer',
      borderRadius: '56% 44% 52% 48% / 52% 48% 56% 44%',
      animation: 'blobIdle 10s ease-in-out infinite',
    }}>
      <canvas ref={canvasRef} width={44} height={44}
        style={{ width: size, height: size, display: 'block' }} />
    </div>
  )
}
