import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, X, Eye, EyeOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { auth, supabase } from '../supabase'

/* ── Themes ──────────────────────────────────────────────────── */
/* Two palettes the user can toggle between. Add more here and    */
/* they'll show up automatically in the theme switcher.           */

const THEMES = {
  light: {
    id:       'light',
    label:    'LIGHT',
    bg:       '#FFFFFF',
    ink:      '#000000',
    headline: '#000000',
    sub:      '#555555',
    hairline: 'rgba(0,0,0,0.18)',
    pillBg:   '#FFFFFF',
    logoBg:   '#C94A3D',           // red dog on white bg
  },
  terracotta: {
    id:       'terracotta',
    label:    'WARM',
    bg:       '#C94A3D',
    ink:      '#111111',
    headline: 'rgba(255,220,210,0.95)',
    sub:      'rgba(255,255,255,0.75)',
    hairline: 'rgba(0,0,0,0.18)',
    pillBg:   '#FFF5EF',
    logoBg:   '#FFFFFF',           // white dog on red bg
  },
}
const THEME_ORDER = ['light', 'terracotta']

// Kept for the auth modal which still uses a white sheet.
const INK = {
  bg:      '#FFFFFF',
  paper:   '#FFFFFF',
  ink:     '#000000',
  hairline:'rgba(0,0,0,0.12)',
  sub:     '#555555',
}

const CHARACTERS = [
  { id: 'woman', label: 'WOMAN', src: '/char-woman.png' },
  { id: 'man',   label: 'MAN',   src: '/char-man.png'   },
  { id: 'box',   label: 'BOX',   src: '/char-box.png'   },
  { id: 'dog',   label: 'DOG',   src: '/char-dog.png'   },
  { id: 'cat',   label: 'CAT',   src: '/char-cat.png'   },
]

/* ── Auth modal ──────────────────────────────────────────────── */

function AuthModal({ mode: initialMode, onClose, onSuccess }) {
  const [mode, setMode]         = useState(initialMode)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]         = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'signup') {
        await auth.signUp({ email, password, fullName: name })
      } else {
        await auth.signIn({ email, password })
      }
      onSuccess()
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    background: '#fff',
    border: `1.5px solid ${INK.hairline}`,
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 15,
    color: INK.ink,
    caretColor: INK.ink,
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: 'inherit',
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.97 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background: '#fff',
          borderRadius: 20,
          padding: 32,
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
          position: 'relative',
          border: `2px solid ${INK.ink}`,
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: '#fff', border: `1.5px solid ${INK.hairline}`, borderRadius: '50%',
            width: 32, height: 32, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: INK.ink,
          }}
        >
          <X size={16} />
        </button>

        <p style={{ fontFamily: 'Archivo Black, Inter, sans-serif', fontSize: 24, color: INK.ink, marginBottom: 8, letterSpacing: '-0.01em' }}>
          {mode === 'signup' ? 'CREATE ACCOUNT' : 'WELCOME BACK'}
        </p>
        <p style={{ fontSize: 14, color: INK.sub, marginBottom: 24 }}>
          {mode === 'signup' ? 'Your agent is one step away.' : 'Pick up where you left off.'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'signup' && (
            <input
              style={inputStyle}
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <input
            style={inputStyle}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div style={{ position: 'relative' }}>
            <input
              style={{ ...inputStyle, paddingRight: 44 }}
              type={showPw ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: INK.sub, padding: 0, display: 'flex',
              }}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <p style={{ fontSize: 13, color: '#e05252', margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              padding: '14px 0',
              borderRadius: 10,
              background: loading ? '#3a3a3a' : INK.ink,
              color: '#fff',
              fontFamily: 'Archivo Black, Inter, sans-serif',
              fontSize: 14,
              letterSpacing: '0.04em',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'ONE MOMENT…' : mode === 'signup' ? 'CREATE ACCOUNT' : 'SIGN IN'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: INK.sub }}>
          {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
          <button
            onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError('') }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: INK.ink, fontSize: 14, fontWeight: 600, padding: 0,
              fontFamily: 'inherit', textDecoration: 'underline',
            }}
          >
            {mode === 'signup' ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </motion.div>
    </motion.div>
  )
}

/* ── Main page ───────────────────────────────────────────────── */

export function Landing() {
  const navigate = useNavigate()
  const [modal, setModal] = useState(null)
  const [picked, setPicked] = useState(() => new Set())
  const [themeId, setThemeId] = useState(() => {
    try { return localStorage.getItem('estato:landingTheme') || 'light' } catch { return 'light' }
  })
  const THEME = THEMES[themeId] || THEMES.light

  function cycleTheme() {
    const idx = THEME_ORDER.indexOf(themeId)
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length]
    setThemeId(next)
    try { localStorage.setItem('estato:landingTheme', next) } catch {}
  }

  function togglePick(id) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleAuthSuccess() {
    setModal(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && picked.size > 0) {
        try { sessionStorage.setItem('estato:household', JSON.stringify([...picked])) } catch {}
      }
      if (user) {
        const { data: prefs } = await supabase
          .from('search_preferences')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle()
        if (prefs) {
          navigate('/dashboard')
          return
        }
      }
    } catch {}
    navigate('/onboarding')
  }

  function handleStart() {
    if (picked.size > 0) {
      try { sessionStorage.setItem('estato:household', JSON.stringify([...picked])) } catch {}
    }
    setModal('signup')
  }

  const hasPicked = picked.size > 0

  return (
    <div style={{
      minHeight: '100vh',
      background: THEME.bg,
      color: THEME.ink,
      overflow: 'hidden',
      fontFamily: 'Inter, SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      transition: 'background 0.5s ease, color 0.5s ease',
    }}>
      {/* ── Header ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '24px 40px', maxWidth: 1440, margin: '0 auto', width: '100%',
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <motion.button
            type="button"
            onClick={cycleTheme}
            aria-label={`Change background (current: ${THEME.label.toLowerCase()})`}
            title="Click to change background"
            animate={{ rotate: [0, -6, 6, -4, 4, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92, rotate: 360 }}
            style={{
              width: 42, height: 42, borderRadius: '50%',
              border: `2px solid ${THEME.ink}`,
              overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: THEME.logoBg,
              padding: 0,
              cursor: 'pointer',
              transition: 'background 0.4s ease, border-color 0.4s ease',
            }}
          >
            <img
              src="/logo-dog.png"
              alt="Estato"
              style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
              draggable={false}
            />
          </motion.button>
          <span style={{
            fontFamily: 'Archivo Black, Inter, sans-serif',
            fontSize: 14, letterSpacing: '0.22em', color: THEME.ink,
          }}>ESTATO</span>
        </div>

        <button
          onClick={() => setModal('login')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            borderRadius: 999, border: `2px solid ${THEME.ink}`,
            background: THEME.pillBg, padding: '9px 22px',
            fontFamily: 'Archivo Black, Inter, sans-serif',
            fontSize: 12, letterSpacing: '0.1em', color: THEME.ink,
            cursor: 'pointer',
            transition: 'background 0.4s ease, border-color 0.4s ease, color 0.4s ease',
          }}
        >
          LOG IN
        </button>
      </header>

      {/* ── Main: hero stage ── */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 24px 24px',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* The hero stage: headline + characters, layered */}
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: 3400,
          aspectRatio: '2 / 1',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}>
          {/* Headline behind */}
          <h1 style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '4%',
            fontFamily: 'Archivo Black, Inter, sans-serif',
            fontSize: 'clamp(56px, 12vw, 200px)',
            lineHeight: 0.84,
            letterSpacing: '-0.04em',
            color: THEME.headline,
            margin: 0,
            textAlign: 'center',
            textTransform: 'uppercase',
            zIndex: 1,
            pointerEvents: 'none',
          }}>
            <span style={{ display: 'block' }}>
              LET'S<br />EXPLORE<br />YOUR<br />OPTIONS
            </span>
          </h1>

          {/* Animated, clickable characters — each with its label pill directly below */}
          <div style={{
            position: 'absolute',
            bottom: '2%',
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 0,
            padding: 0,
            zIndex: 2,
          }}>
            {CHARACTERS.map((c, i) => {
              const selected = picked.has(c.id)
              return (
                <div
                  key={c.id}
                  style={{
                    flex: '1 1 0',
                    maxWidth: 660,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'clamp(6px, 1vw, 14px)',
                  }}
                >
                  <motion.button
                    type="button"
                    onClick={() => togglePick(c.id)}
                    aria-pressed={selected}
                    aria-label={`Select ${c.label.toLowerCase()}`}
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: [0, -8, 0], opacity: 1 }}
                    transition={{
                      y: {
                        duration: 2.8 + i * 0.3,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: i * 0.2,
                      },
                      opacity: { duration: 0.5, delay: i * 0.08 },
                    }}
                    whileHover={{ scale: 1.06, y: -12 }}
                    whileTap={{ scale: 0.96 }}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    <img
                      src={c.src}
                      alt={c.label}
                      onError={(e) => { e.currentTarget.style.opacity = '0.15' }}
                      style={{
                        width: '100%',
                        height: 'auto',
                        userSelect: 'none',
                        pointerEvents: 'none',
                        transform: selected ? 'scale(1.04)' : 'scale(1)',
                        transition: 'transform 0.25s ease',
                      }}
                      draggable={false}
                    />
                  </motion.button>

                  <button
                    type="button"
                    onClick={() => togglePick(c.id)}
                    aria-pressed={selected}
                    style={{
                      padding: '6px 18px',
                      borderRadius: 999,
                      border: `1.5px solid ${THEME.ink}`,
                      background: selected ? THEME.ink : THEME.pillBg,
                      color: selected ? THEME.pillBg : THEME.ink,
                      fontFamily: 'Archivo Black, Inter, sans-serif',
                      fontSize: 11,
                      letterSpacing: '0.12em',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.label}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* CTA row */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 16,
          alignItems: 'center', justifyContent: 'center',
          marginTop: 32,
        }}>
          <button
            onClick={handleStart}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 12,
              height: 60, padding: '0 32px',
              borderRadius: 999,
              border: `2.5px solid ${THEME.ink}`,
              background: THEME.ink,
              color: THEME.pillBg,
              fontFamily: 'Archivo Black, Inter, sans-serif',
              fontSize: 13, letterSpacing: '0.12em',
              cursor: 'pointer',
              boxShadow: `5px 5px 0 0 ${THEME.ink}`,
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translate(-2px,-2px)'
              e.currentTarget.style.boxShadow = `7px 7px 0 0 ${THEME.ink}`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = `5px 5px 0 0 ${THEME.ink}`
            }}
          >
            {hasPicked ? `START WITH ${picked.size}` : 'START MY SEARCH'}
            <ArrowRight size={18} strokeWidth={3} />
          </button>
        </div>
      </main>

      <AnimatePresence>
        {modal && (
          <AuthModal
            mode={modal}
            onClose={() => setModal(null)}
            onSuccess={handleAuthSuccess}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
