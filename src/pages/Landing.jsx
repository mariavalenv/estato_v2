import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Shield, Sparkles, Clock3, X, Eye, EyeOff, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../supabase'

/* ── Constants ───────────────────────────────────────────────── */

const FEATURES = [
  { icon: Shield,   label: 'Private by design' },
  { icon: Sparkles, label: 'AI that understands you' },
  { icon: Clock3,   label: 'Save hours of searching' },
]

const DARK = {
  bg:      '#080B0C',
  surface: '#121214',
  accent:  '#6386F1',
  success: '#34D399',
  text:    '#F5F5F7',
  sub:     '#9A9AA0',
}

/* ── Auth modal — keeps framer-motion, only mounts on interaction ── */

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
    background: 'rgba(255,255,255,0.06)',
    border: 'none',
    borderRadius: 8,
    padding: '11px 14px',
    fontSize: 15,
    color: DARK.text,
    caretColor: DARK.accent,
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
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        style={{
          width: '100%', maxWidth: 400,
          background: DARK.surface,
          borderRadius: 16,
          padding: 32,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none', cursor: 'pointer',
            color: DARK.sub, padding: 4, display: 'flex',
          }}
        >
          <X size={18} />
        </button>

        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.15em', color: DARK.accent, textTransform: 'uppercase', marginBottom: 8 }}>
            ✦ ESTATO
          </p>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: DARK.text, margin: 0 }}>
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </h2>
          <p style={{ fontSize: 14, color: DARK.sub, marginTop: 6 }}>
            {mode === 'signup'
              ? 'Your agent is ready to start searching.'
              : 'Sign in to pick up where you left off.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={inputStyle}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <div style={{ position: 'relative' }}>
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ ...inputStyle, paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              style={{
                position: 'absolute', right: 12, top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: DARK.sub, display: 'flex', padding: 0,
              }}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && <p style={{ fontSize: 13, color: '#F87171', margin: 0 }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              width: '100%', padding: '12px 0',
              borderRadius: 8, border: 'none',
              background: loading ? 'rgba(99,134,241,0.5)' : DARK.accent,
              color: '#fff', fontSize: 15, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity 200ms ease',
              fontFamily: 'inherit',
            }}
          >
            {loading
              ? (mode === 'signup' ? 'Creating account…' : 'Signing in…')
              : (mode === 'signup' ? 'Create account' : 'Sign in')}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 14, color: DARK.sub, textAlign: 'center' }}>
          {mode === 'signup' ? 'Already have an account? ' : 'No account yet? '}
          <button
            onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError('') }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: DARK.accent, fontSize: 14, fontWeight: 500, padding: 0,
              fontFamily: 'inherit',
            }}
          >
            {mode === 'signup' ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </motion.div>
    </motion.div>
  )
}

/* ── Agent preview card ──────────────────────────────────────── */

function AgentCard() {
  return (
    <div style={{
      borderRadius: 24,
      border: '1px solid rgba(255,255,255,0.09)',
      background: 'rgba(14,15,18,0.96)',
      padding: 20,
      boxShadow: '0 20px 80px rgba(0,0,0,0.55)',
    }}>
      {/* Status header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 13, color: DARK.sub }}>Agent status</p>
          <h2 style={{ fontSize: 20, fontWeight: 500, color: DARK.text, marginTop: 4, letterSpacing: '-0.02em' }}>Quietly working for you</h2>
        </div>
        <div style={{
          borderRadius: 999, border: '1px solid rgba(52,211,105,0.2)',
          background: 'rgba(52,211,105,0.1)', padding: '4px 12px',
          fontSize: 13, color: DARK.success,
        }}>Active</div>
      </div>

      {/* Main stat block */}
      <div style={{
        borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(0,0,0,0.25)', padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ fontSize: 12, color: DARK.sub }}>Today</p>
            <p style={{ fontSize: 28, fontWeight: 500, color: '#c8d8ff', marginTop: 8, letterSpacing: '-0.03em' }}>14 flats reviewed</p>
          </div>
          <div style={{
            borderRadius: 12, background: 'rgba(255,255,255,0.05)',
            padding: '8px 12px', textAlign: 'right',
          }}>
            <p style={{ fontSize: 12, color: DARK.sub }}>Confidence</p>
            <p style={{ fontSize: 17, fontWeight: 500, color: DARK.text }}>High</p>
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '16px 0' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {['8 min commute match', 'Within your budget', 'Quiet neighbourhood', 'Awaiting your approval'].map((item) => (
            <div key={item} style={{
              borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(255,255,255,0.03)',
              padding: '10px 14px', fontSize: 13, color: 'rgba(255,255,255,0.58)',
              lineHeight: 1.4,
            }}>
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10 }}>
        {[
          { label: 'Strong matches', value: '3' },
          { label: 'Outreach sent', value: '2' },
          { label: 'Next update', value: '2h' },
        ].map((s) => (
          <div key={s.label} style={{
            borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.03)', padding: 14,
          }}>
            <div style={{ fontSize: 24, fontWeight: 500, color: DARK.text, letterSpacing: '-0.03em' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: DARK.sub, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Main page ───────────────────────────────────────────────── */

export function Landing() {
  const navigate = useNavigate()
  const [modal, setModal] = useState(null) // null | 'signup' | 'login'

  function handleAuthSuccess() {
    setModal(null)
    navigate('/onboarding')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: `radial-gradient(ellipse at 50% 0%, rgba(99,134,241,0.1) 0%, transparent 60%), ${DARK.bg}`,
      color: DARK.text,
      overflow: 'hidden',
      fontFamily: 'Inter, SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      {/* Dot grid — pure CSS, zero paint cost */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        opacity: 0.04,
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.9) 0.6px, transparent 0.6px)',
        backgroundSize: '18px 18px',
      }} />

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>

        {/* ── Header ── */}
        <header className="l-fade l-d0" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '24px 40px', maxWidth: 1280, margin: '0 auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>✦</div>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.88)', textTransform: 'uppercase' }}>ESTATO</span>
          </div>

          <button
            onClick={() => setModal('login')}
            className="l-ghost"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              borderRadius: 999, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)', padding: '8px 18px',
              fontSize: 14, color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Log in
          </button>
        </header>

        {/* ── Main content ── */}
        <main style={{
          display: 'grid', gridTemplateColumns: '1fr',
          alignItems: 'center', gap: 48,
          maxWidth: 1280, margin: '0 auto',
          padding: '20px 40px 60px',
          minHeight: 'calc(100vh - 92px)',
        }}
          className="lg:grid-cols-[1.05fr_0.95fr]"
        >
          {/* Left: copy */}
          <div style={{ maxWidth: 600 }}>

            {/* Badge */}
            <div className="l-fade l-d1" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              borderRadius: 999, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', padding: '7px 14px',
              fontSize: 13, color: 'rgba(255,255,255,0.72)',
              marginBottom: 24,
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: DARK.success, flexShrink: 0,
                boxShadow: '0 0 8px rgba(52,211,105,0.7)',
              }} />
              Your flat search agent, reimagined
            </div>

            {/* Headline */}
            <h1 className="l-fade l-d2" style={{
              fontSize: 'clamp(44px, 7vw, 72px)',
              fontWeight: 500,
              lineHeight: 0.92,
              letterSpacing: '-0.045em',
              color: '#c8d8ff',
              margin: 0,
            }}>
              Find your flat.
              <br />
              And your people.
            </h1>

            {/* Subtitle */}
            <p className="l-fade l-d3" style={{
              fontSize: 18, lineHeight: 1.7,
              color: 'rgba(255,255,255,0.52)',
              marginTop: 24, maxWidth: 480,
            }}>
              Delegate the search to an agent that knows your rhythm, your budget, and what home should feel like.
            </p>

            {/* CTAs */}
            <div className="l-fade l-d4" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 40, alignItems: 'center' }}>

              {/* Primary CTA — CSS hover via .l-cta */}
              <button
                onClick={() => setModal('signup')}
                className="l-cta"
                style={{
                  position: 'relative',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  height: 60, minWidth: 240,
                  borderRadius: 999, border: '1px solid rgba(99,134,241,0.35)',
                  background: 'linear-gradient(135deg, rgba(99,134,241,0.18), rgba(99,134,241,0.06))',
                  padding: '0 28px',
                  fontSize: 16, fontWeight: 500, color: '#c8d8ff',
                  boxShadow: '0 4px 32px rgba(99,134,241,0.15)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <Sparkles size={16} style={{ marginRight: 10, flexShrink: 0 }} />
                Create an account
                <ArrowRight className="l-arrow" size={16} style={{ marginLeft: 10, flexShrink: 0 }} />
              </button>

              {/* Secondary CTA */}
              <button
                onClick={() => navigate('/onboarding')}
                className="l-ghost"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  height: 60, minWidth: 190,
                  borderRadius: 999, border: '1px solid rgba(255,255,255,0.11)',
                  background: 'rgba(255,255,255,0.04)', padding: '0 28px',
                  fontSize: 16, fontWeight: 500, color: 'rgba(255,255,255,0.78)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <Search size={16} />
                Start flat-hunting
              </button>
            </div>

            {/* Feature chips */}
            <div className="l-fade l-d5" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 32 }}>
              {FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  borderRadius: 999, border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)', padding: '7px 13px',
                  fontSize: 13, color: 'rgba(255,255,255,0.48)',
                }}>
                  <Icon size={14} color='#a8bfff' />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: agent card (desktop only) */}
          <div
            className="l-fade l-d3 lg:!block"
            style={{ display: 'none', width: '100%', maxWidth: 480 }}
          >
            <AgentCard />
          </div>
        </main>

        {/* Floating ✦ orb — CSS animation, compositor thread */}
        <div style={{
          position: 'absolute', left: '50%', top: '12%',
          transform: 'translateX(-50%)', zIndex: 10, pointerEvents: 'none',
        }}>
          <div style={{
            width: 40, height: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'landing-orb 3.4s ease-in-out infinite',
          }}>
            <span style={{ fontSize: 18, filter: 'drop-shadow(0 0 12px rgba(99,134,241,0.85))', color: '#a8bfff' }}>✦</span>
          </div>
        </div>
      </div>

      {/* Auth modal — framer-motion OK here, only mounts on user action */}
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
