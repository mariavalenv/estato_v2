import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import { supabase } from '../supabase.js'

/* ── Themes ──────────────────────────────────────────────────────
   Same two palettes as the landing page. Clicking the dog logo
   cycles between them and persists to the shared localStorage key,
   so the dashboard and landing stay in sync.
   ──────────────────────────────────────────────────────────── */

const THEMES = {
  light: { id: 'light', bg: '#FFFFFF', ink: '#000000', logoBg: '#C94A3D' },
  terracotta: { id: 'terracotta', bg: '#C94A3D', ink: '#111111', logoBg: '#FFFFFF' },
}
const THEME_ORDER = ['light', 'terracotta']

/* ── Functionalities ────────────────────────────────────────────
   The horizontal rail of things you can do. Each card links to an
   existing route. Scroll the rail left/right to browse them all.
   ──────────────────────────────────────────────────────────── */

const FEATURES = [
  { id: 'flat', label: 'Flat hunting', sub: 'Find your next place', to: '/screening', img: '/char-house.png' },
  { id: 'housemate', label: 'Housemate hunting', sub: 'Meet your matches', to: '/housemates', img: '/char-man.png' },
  { id: 'agent', label: 'AI agent', sub: 'Let Estato do the work', to: '/agent', img: '/char-dog.png' },
  { id: 'profile', label: 'Profile set up', sub: 'Tell us about you', to: '/account', img: '/char-woman.png' },
  { id: 'activity', label: 'Activity log', sub: 'See what happened', to: '/activity', img: '/char-box.png' },
]

// Shared style for the carousel's left/right paging arrows.
function arrowStyle(THEME) {
  return {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 2,
    width: 48,
    height: 48,
    borderRadius: '50%',
    border: `2px solid ${THEME.ink}`,
    background: THEME.bg,
    color: THEME.ink,
    fontSize: 28,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 4,
    transition: 'background 0.4s ease, border-color 0.4s ease, color 0.4s ease, opacity 0.2s ease',
  }
}

/* ── Dashboard ──────────────────────────────────────────────────
   Rebuilt from scratch. We start from the foundation: the same
   background and dog logo as the landing page, inside the shared
   AppLayout sidebar shell. Everything else is a clean canvas,
   ready to build up from here.
   ──────────────────────────────────────────────────────────── */

export function Dashboard() {
  const navigate = useNavigate()
  const [userName, setUserName] = useState(null)
  const [themeId, setThemeId] = useState(() => {
    try { return localStorage.getItem('estato:landingTheme') || 'light' } catch { return 'light' }
  })
  const THEME = THEMES[themeId] || THEMES.light

  // Infinite carousel — one card in view at a time. We render a clone
  // of the last card before the first and a clone of the first after
  // the last (SLIDES below). When the user scrolls onto a clone we
  // silently jump to the matching real card, so scrolling right past
  // the last card loops seamlessly back to the first.
  const N = FEATURES.length
  const railRef = useRef(null)
  const settleTimer = useRef(null)
  const [activeIdx, setActiveIdx] = useState(0)

  // Start the rail on the first *real* card (slide index 1, since
  // slide 0 is the leading clone).
  useEffect(() => {
    const rail = railRef.current
    if (rail) rail.scrollLeft = rail.clientWidth
  }, [])

  // Page by one card; the wrap is handled by onRailScroll once it lands.
  function go(dir) {
    const rail = railRef.current
    if (rail) rail.scrollBy({ left: dir * rail.clientWidth, behavior: 'smooth' })
  }

  // Jump straight to a real card (used by the dots).
  function goToReal(i) {
    const rail = railRef.current
    if (rail) rail.scrollTo({ left: (i + 1) * rail.clientWidth, behavior: 'smooth' })
  }

  // After scrolling settles, sync the active dot and, if we landed on a
  // clone, reposition (instantly, no animation) to the real card.
  function onRailScroll() {
    const rail = railRef.current
    if (!rail) return
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      const slide = Math.round(rail.scrollLeft / rail.clientWidth)
      if (slide === 0) {
        rail.scrollLeft = N * rail.clientWidth         // leading clone → last real
        setActiveIdx(N - 1)
      } else if (slide === N + 1) {
        rail.scrollLeft = rail.clientWidth             // trailing clone → first real
        setActiveIdx(0)
      } else {
        setActiveIdx(slide - 1)
      }
    }, 120)
  }

  // Fade the greeting out as the page scrolls down.
  const { scrollY } = useScroll()
  const greetingOpacity = useTransform(scrollY, [0, 100000], [1, 0])
  const greetingY = useTransform(scrollY, [0, 100000], [0, -4000])

  function cycleTheme() {
    const idx = THEME_ORDER.indexOf(themeId)
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length]
    setThemeId(next)
    try { localStorage.setItem('estato:landingTheme', next) } catch { }
  }

  // Auth guard — bounce to the landing page if signed out.
  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return
      if (!user) { navigate('/'); return }
      const firstName =
        user.user_metadata?.full_name?.split(' ')[0] ??
        user.email?.split('@')[0] ??
        'there'
      setUserName(firstName)
    })
    return () => { cancelled = true }
  }, [navigate])

  return (
    <div
      style={{
        position: 'relative',
        background: THEME.bg,
        fontFamily: 'Inter, SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
        boxSizing: 'border-box',
        transition: 'background 0.5s ease',
      }}
    >
      {/* Logo — fixed top-left corner so it stays put while scrolling.
          Click the dog to cycle the colours, same as the landing /
          log-in page. */}
      <div
        style={{
          position: 'fixed',
          top: 20,
          left: 24,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={cycleTheme}
          aria-label="Change background colour"
          title="Click to change background"
          style={{
            fontFamily: 'Archivo Black, Inter, sans-serif',
            fontSize: 14, letterSpacing: '0.22em',
            color: THEME.ink,
            transition: 'color 0.4s ease',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          ESTATO
        </button>
      </div>

      {/* Hero — fills the viewport and centres the greeting. The whole
          block fades + lifts away as you scroll down. */}
      <motion.section
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          boxSizing: 'border-box',
          opacity: greetingOpacity,
          y: greetingY,
        }}
      >
        {/* Greeting — the welcome moment on login. "Hello," fades in
            first, then the user's name fades in just after it. */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }}
          style={{
            fontFamily: 'Archivo Black, Inter, sans-serif',
            fontSize: 'clamp(28px, 5vw, 44px)',
            letterSpacing: '-0.02em',
            color: THEME.ink,
            margin: 0,
            textAlign: 'center',
            textTransform: 'uppercase',
            transition: 'color 0.4s ease',
          }}
        >
          Hello
          <AnimatePresence>
            {userName && (
              <motion.span
                key={userName}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, delay: 1.1, ease: 'easeOut' }}
              >
                , {userName}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.h1>
      </motion.section>

      {/* Functionalities — a full-height panel you land on once the
          welcome scrolls away. The rail of cards scrolls horizontally
          (left/right) so you can browse every thing Estato can do. */}
      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '64px 0',
          boxSizing: 'border-box',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-120px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <h2
            style={{
              fontFamily: 'Archivo Black, Inter, sans-serif',
              fontSize: 'clamp(20px, 3vw, 28px)',
              letterSpacing: '-0.01em',
              color: THEME.ink,
              margin: '0 0 24px',
              padding: '0 24px',
              textTransform: 'uppercase',
              transition: 'color 0.4s ease',
            }}
          >
            What do you want to do?
          </h2>

          {/* Carousel — one card at a time. The arrows and free scroll /
              swipe both page horizontally, and it loops infinitely: clones
              of the first and last cards sit at the ends so scrolling past
              the last card wraps seamlessly back to the first. */}
          <div style={{ position: 'relative', padding: '0 24px' }}>
            {/* Left arrow */}
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous"
              style={{ ...arrowStyle(THEME), left: 32 }}
            >
              ‹
            </button>

            {/* Right arrow */}
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next"
              style={{ ...arrowStyle(THEME), right: 32 }}
            >
              ›
            </button>

            <div
              ref={railRef}
              onScroll={onRailScroll}
              className="feature-rail"
              style={{
                display: 'flex',
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                paddingBottom: 16,
                WebkitOverflowScrolling: 'touch',
                color: THEME.ink,
              }}
            >
              {[FEATURES[N - 1], ...FEATURES, FEATURES[0]].map((f, i) => (
                <div
                  key={i}
                  style={{
                    flex: '0 0 100%',
                    scrollSnapAlign: 'center',
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '8px 0',
                  }}
                >
                  <motion.button
                    type="button"
                    onClick={() => navigate(f.to)}
                    whileHover={{ y: -6 }}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      width: 'min(420px, 80vw)',
                      minHeight: 420,
                      border: 'none',
                      background: 'transparent',
                      color: THEME.ink,
                      padding: '36px 32px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      justifyContent: 'flex-start',
                      gap: -1000,
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'color 0.4s ease',
                    }}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span
                        style={{
                          fontFamily: 'Archivo Black, Inter, sans-serif',
                          fontSize: 26,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {f.label}
                      </span>
                      <span style={{ fontSize: 15, opacity: 0.7 }}>{f.sub}</span>
                    </span>
                    {f.img && (
                      <span
                        style={{
                          alignSelf: 'center',
                          height: 360,
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'center',
                          // Nudge the house vertically: negative = UP, positive = down.
                          transform: f.id === 'flat' ? 'translateY(-45px)' : 'none',
                        }}
                      >
                        <img
                          src={f.img}
                          alt=""
                          draggable={false}
                          style={{
                            width: 'auto',
                            maxHeight: f.id === 'flat' ? 450 : 490,
                            maxWidth: f.id === 'flat' ? '66%' : '80%',
                            objectFit: 'contain',
                            pointerEvents: 'none',
                          }}
                        />
                      </span>
                    )}
                  </motion.button>
                </div>
              ))}
            </div>

            {/* Dots — show which card you're on; tap to jump. */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 16 }}>
              {FEATURES.map((f, i) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => goToReal(i)}
                  aria-label={`Go to ${f.label}`}
                  style={{
                    width: i === activeIdx ? 24 : 10,
                    height: 10,
                    borderRadius: 999,
                    border: 'none',
                    background: THEME.ink,
                    opacity: i === activeIdx ? 1 : 0.3,
                    cursor: 'pointer',
                    transition: 'width 0.3s ease, opacity 0.3s ease',
                  }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  )
}
