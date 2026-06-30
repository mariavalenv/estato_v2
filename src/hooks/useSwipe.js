import { useRef, useEffect } from 'react'

export function useSwipe({ onSwipeLeft, onSwipeRight, onTap, onDrag }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let sx = 0, cx = 0, velX = 0, lastX = 0, lastT = 0
    let dragging = false, wasDragging = false
    const THRESH = 90

    function onDown(e) {
      dragging = true; wasDragging = false
      sx = e.clientX; cx = 0; velX = 0
      lastX = e.clientX; lastT = Date.now()
      el.style.transition = 'none'
      el.setPointerCapture(e.pointerId)
    }

    function onMove(e) {
      if (!dragging) return
      const now = Date.now()
      cx = e.clientX - sx
      if (Math.abs(cx) > 8) wasDragging = true
      velX = (e.clientX - lastX) / Math.max(1, now - lastT)
      lastX = e.clientX; lastT = now
      el.style.transform = `translateX(${cx}px) rotate(${cx * 0.04}deg)`
      onDrag?.(cx)
    }

    function onUp() {
      if (!dragging) return
      dragging = false
      if (!wasDragging) { onTap?.(); onDrag?.(0); resetTransform(); return }
      if (Math.abs(cx) > THRESH || Math.abs(velX) > 0.5) {
        const dir = cx < 0 ? 'left' : 'right'
        const flyX = dir === 'left' ? '-120vw' : '120vw'
        const rot = dir === 'left' ? '-18deg' : '18deg'
        el.style.transition = 'transform 320ms ease-in'
        el.style.transform = `translateX(${flyX}) rotate(${rot})`
        const cb = dir === 'left' ? onSwipeLeft : onSwipeRight
        setTimeout(() => cb?.(), 320)
      } else {
        onDrag?.(0)
        resetTransform()
      }
    }

    function resetTransform() {
      el.style.transition = 'transform 260ms cubic-bezier(.34,1.56,.64,1)'
      el.style.transform = ''
    }

    el.addEventListener('pointerdown', onDown)
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
  }, [onSwipeLeft, onSwipeRight, onTap, onDrag])

  return ref
}
