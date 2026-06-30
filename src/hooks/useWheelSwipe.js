import { useEffect, useRef } from 'react'

/* ── Trackpad / shift-wheel horizontal swipe → left / right ───────────
   Attach the returned ref to a container. A deliberate horizontal scroll
   (right = onRight/keep, left = onLeft/pass) commits once the accumulated
   distance crosses THRESHOLD. Tuned to be forgiving, not twitchy:
     • a light flick won't commit (high THRESHOLD)
     • tiny jitter deltas are ignored (MIN_STEP)
     • pausing mid-gesture decays progress (idle reset)
   Every horizontal-dominant event is preventDefault-ed so the browser's
   back/forward swipe-navigation never fires.
   An optional onDown fires on a deliberate downward scroll (used to undo the
   previous card). It's only active when onDown is supplied, so containers that
   need normal vertical scrolling (e.g. the detail panel) just omit it.
   `enabled` lets callers switch it off (e.g. no active card). ──────────── */
export function useWheelSwipe({ onLeft, onRight, onDown, onProgress, enabled = true }) {
  const ref = useRef(null)
  const accum = useRef(0)
  const accumY = useRef(0)
  const lock = useRef(false)
  const reset = useRef(null)
  const resetY = useRef(null)

  // keep latest callbacks without re-binding the listener each render
  const cbs = useRef({ onLeft, onRight, onDown, onProgress, enabled })
  cbs.current = { onLeft, onRight, onDown, onProgress, enabled }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const THRESHOLD = 520   // distance to scroll before it commits
    const V_THRESHOLD = 520 // downward distance before an undo fires
    const MIN_STEP = 6      // ignore jitter deltas

    function onWheel(e) {
      if (!cbs.current.enabled) return
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY)

      // ── Vertical-dominant gesture ──────────────────────────────────
      if (!horizontal) {
        // Only intercept when a caller wants scroll-down-to-undo; otherwise
        // leave the event alone so the container scrolls normally.
        if (!cbs.current.onDown) return
        const dy = e.deltaY
        if (Math.abs(dy) < MIN_STEP) return
        e.preventDefault()
        if (lock.current) return

        // only a deliberate DOWNWARD scroll undoes; upward is ignored
        if (Math.sign(dy) !== Math.sign(accumY.current)) accumY.current = 0
        accumY.current += dy

        clearTimeout(resetY.current)
        resetY.current = setTimeout(() => { accumY.current = 0 }, 120)

        if (accumY.current > V_THRESHOLD) {
          accumY.current = 0
          lock.current = true
          setTimeout(() => { lock.current = false }, 520)
          cbs.current.onDown?.()
        }
        return
      }

      // ── Horizontal-dominant gesture ────────────────────────────────
      // Block it immediately — including the tiny leading deltas — so the
      // browser never starts its back-swipe navigation.
      e.preventDefault()
      if (lock.current) return

      // Negate so the card follows the gesture: with natural scrolling a
      // two-finger swipe right yields a NEGATIVE deltaX, and we want
      // swipe-right → card moves right → keep (matching the pointer-drag path
      // and the "← pass · keep →" hint).
      const dx = -e.deltaX
      if (Math.abs(dx) < MIN_STEP) return  // jitter — blocked but don't accumulate

      // sign change resets the accumulator so a reversal counts cleanly
      if (Math.sign(dx) !== Math.sign(accum.current)) accum.current = 0
      accum.current += dx

      // live progress 0..±1 of the way to a commit, for visual feedback
      cbs.current.onProgress?.(Math.max(-1, Math.min(1, accum.current / THRESHOLD)))

      clearTimeout(reset.current)
      reset.current = setTimeout(() => {
        accum.current = 0
        cbs.current.onProgress?.(0)        // springs the card back if not committed
      }, 120)

      if (Math.abs(accum.current) > THRESHOLD) {
        const right = accum.current > 0
        accum.current = 0
        cbs.current.onProgress?.(0)
        lock.current = true
        setTimeout(() => { lock.current = false }, 520)
        right ? cbs.current.onRight?.() : cbs.current.onLeft?.()
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      clearTimeout(reset.current)
      clearTimeout(resetY.current)
    }
  }, [])

  return ref
}
