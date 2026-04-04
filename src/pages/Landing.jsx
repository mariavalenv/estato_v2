import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, Shield, Sparkles, Clock3, X, Eye, EyeOff, Search,
} from 'lucide-react'
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
  success: '#34D369',
  text:    '#F5F5F7',
  sub:     '#9A9AA0',
}

/* ── Auth modal ──────────────────────────────────────────────── */

function AuthModal({ mode: initialMode, onClose, onSuccess }) {
  const [mode, setMode]           = useState(initialMode) // 'signup' | 'login'
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [name, setName]           = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

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
        {/* Close */}
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

        {/* Header */}
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

          {error && (
            <p style={{ fontSize: 13, color: '#F87171', margin: 0 }}>{error}</p>
          )}

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
              transition: 'all 200ms ease',
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
      position: 'relative',
      borderRadius: 32,
      border: '1px solid rgba(255,255,255,0.09)',
      background: 'rgba(255,255,255,0.035)',
      padding: 20,
      boxShadow: '0 20px 80px rgba(0,0,0,0.55)',
      backdropFilter: 'blur(20px)',
    }}>
      {/* Glow blobs */}
      <div style={{ position: 'absolute', left: -40, top: 40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(99,134,241,0.14)', filter: 'blur(48px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: -24, bottom: 40, width: 192, height: 192, borderRadius: '50%', background: 'rgba(99,134,241,0.07)', filter: 'blur(48px)', pointerEvents: 'none' }} />

      {/* Status header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 13, color: DARK.sub }}>Agent status</p>
          <h2 style={{ fontSize: 20, fontWeight: 500, color: DARK.text, marginTop: 4, letterSpacing: '-0.02em' }}>Quietly working for you</h2>
        </div>
        <div style={{
          borderRadius: 999, border: `1px solid rgba(52,211,105,0.2)`,
          background: 'rgba(52,211,105,0.1)', padding: '4px 12px',
          fontSize: 13, color: DARK.success,
        }}>Active</div>
      </div>

      {/* Main stat block */}
      <div style={{
        borderRadius: 24, border: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(0,0,0,0.25)', padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ fontSize: 12, color: DARK.sub }}>Today</p>
            <p style={{ fontSize: 28, fontWeight: 500, color: '#c8d8ff', marginTop: 8, letterSpacing: '-0.03em' }}>14 flats reviewed</p>
          </div>
          <div style={{
            borderRadius: 16, background: 'rgba(255,255,255,0.05)',
            padding: '8px 12px', textAlign: 'right',
          }}>
            <p style={{ fontSize: 12, color: DARK.sub }}>Confidence</p>
            <p style={{ fontSize: 17, fontWeight: 500, color: DARK.text }}>High</p>
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '20px 0' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            '8 min commute match',
            'Within your budget',
            'Quiet neighbourhood',
            'Awaiting your approval',
          ].map((item) => (
            <div key={item} style={{
              borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)',
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 12 }}>
        {[
          { label: 'Strong matches', value: '3' },
          { label: 'Outreach sent', value: '2' },
          { label: 'Next update', value: '2h' },
        ].map((s) => (
          <div key={s.label} style={{
            borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)',
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
  const navigate    = useNavigate()
  const containerRef = useRef(null)
  const canvasRef    = useRef(null)
  const particles    = useRef([])
  const animFrame    = useRef(null)
  const [mouse, setMouse]   = useState({ x: 0, y: 0, active: false })
  const [ctaHovered, setCtaHovered] = useState(false)
  const [modal, setModal]   = useState(null) // null | 'signup' | 'login'

  /* ── Canvas particle system ── */
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    let width = 0, height = 0, lastSpawn = 0, orbitAngle = 0

    const resize = () => {
      width = container.clientWidth
      height = container.clientHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    // Accent blue (#6386F1) and a cool lighter tint
    const spawn = (x, y, opts = {}) => {
      const angle = Math.random() * Math.PI * 2
      const speed = opts.speed ?? Math.random() * 0.7 + 0.15
      particles.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: opts.life ?? 1,
        radius: opts.radius ?? Math.random() * 1.8 + 1,
        warm: opts.warm ?? (Math.random() > 0.65), // true = lighter blue/white tint
        glow: opts.glow ?? Math.random() * 10 + 8,
      })
    }

    const drawBgGlow = () => {
      const g = ctx.createRadialGradient(width / 2, height / 2 - 40, 40, width / 2, height / 2, Math.min(width, height) * 0.46)
      g.addColorStop(0,    'rgba(99,134,241,0.12)')
      g.addColorStop(0.45, 'rgba(99,134,241,0.07)')
      g.addColorStop(0.72, 'rgba(180,200,255,0.04)')
      g.addColorStop(1,    'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, width, height)
    }

    const drawCursorAura = () => {
      if (!mouse.active) return
      const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 130)
      g.addColorStop(0,    'rgba(180,200,255,0.12)')
      g.addColorStop(0.2,  'rgba(99,134,241,0.14)')
      g.addColorStop(0.5,  'rgba(99,134,241,0.06)')
      g.addColorStop(1,    'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(mouse.x, mouse.y, 130, 0, Math.PI * 2)
      ctx.fill()
    }

    const render = (time) => {
      ctx.clearRect(0, 0, width, height)
      drawBgGlow()
      drawCursorAura()

      if (mouse.active && time - lastSpawn > 24) {
        spawn(mouse.x, mouse.y, { life: 1, radius: Math.random() * 2 + 1, speed: Math.random() * 0.55 + 0.08 })
        if (Math.random() > 0.72) spawn(mouse.x, mouse.y, { life: 1.2, radius: 2.8, speed: 0.25, warm: false, glow: 16 })
        lastSpawn = time
      }

      if (mouse.active) {
        orbitAngle += 0.04
        for (let i = 0; i < 2; i++) {
          const r = 18 + i * 9
          spawn(
            mouse.x + Math.cos(orbitAngle + i * 2.4) * r,
            mouse.y + Math.sin(orbitAngle + i * 2.4) * r,
            { life: 0.55, radius: 1.6, speed: 0.04, warm: i % 2 === 0, glow: 12 }
          )
        }
      }

      particles.current = particles.current.filter((p) => p.life > 0.03)

      for (const p of particles.current) {
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.985
        p.vy *= 0.985
        p.life *= 0.976

        const alpha = Math.max(0, p.life * 0.9)
        // warm = lighter blue-white; cool = accent blue
        const color = p.warm
          ? `rgba(200, 215, 255, ${alpha})`
          : `rgba(99, 134, 241, ${alpha})`
        const glow = p.warm
          ? 'rgba(200, 215, 255, 0.8)'
          : 'rgba(99, 134, 241, 0.85)'

        ctx.beginPath()
        ctx.fillStyle = color
        ctx.shadowBlur = p.glow
        ctx.shadowColor = glow
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.shadowBlur = 0
      animFrame.current = requestAnimationFrame(render)
    }

    resize()
    render(0)
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      if (animFrame.current) cancelAnimationFrame(animFrame.current)
    }
  }, [mouse.active, mouse.x, mouse.y])

  function handleAuthSuccess() {
    setModal(null)
    navigate('/onboarding')
  }

  return (
    <div style={{ minHeight: '100vh', background: DARK.bg, color: DARK.text, overflow: 'hidden', fontFamily: 'Inter, SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div
        ref={containerRef}
        style={{ position: 'relative', minHeight: '100vh' }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top, active: true })
        }}
        onMouseLeave={() => setMouse((m) => ({ ...m, active: false }))}
      >
        {/* Canvas */}
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

        {/* Layered background effects */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'radial-gradient(circle at center, rgba(99,134,241,0.08) 0%, transparent 36%), radial-gradient(circle at 65% 40%, rgba(99,134,241,0.05) 0%, transparent 24%), linear-gradient(to bottom, rgba(255,255,255,0.015), rgba(255,255,255,0))' }} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.045, backgroundImage: 'radial-gradient(rgba(255,255,255,0.9) 0.6px, transparent 0.6px)', backgroundSize: '18px 18px' }} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'radial-gradient(circle at top, transparent, rgba(0,0,0,0.3) 55%, rgba(0,0,0,0.65))' }} />

        {/* ── Header ── */}
        <header style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 40px', maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(12px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>✦</div>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.88)', textTransform: 'uppercase' }}>ESTATO</span>
          </div>

          <button
            onClick={() => setModal('login')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              borderRadius: 999, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.03)', padding: '8px 18px',
              fontSize: 14, color: 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(12px)', cursor: 'pointer',
              transition: 'all 200ms ease', fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
          >
            Log in
          </button>
        </header>

        {/* ── Main content ── */}
        <main style={{
          position: 'relative', zIndex: 10,
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
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                borderRadius: 999, border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.045)', padding: '7px 14px',
                fontSize: 13, color: 'rgba(255,255,255,0.72)',
                backdropFilter: 'blur(12px)', marginBottom: 24,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: DARK.success, boxShadow: '0 0 14px rgba(52,211,105,0.9)', flexShrink: 0 }} />
              Your flat search agent, reimagined
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.08, ease: 'easeOut' }}
              style={{
                fontSize: 'clamp(44px, 7vw, 72px)',
                fontWeight: 500,
                lineHeight: 0.92,
                letterSpacing: '-0.045em',
                color: '#c8d8ff',
                margin: 0,
              }}
            >
              Find your flat.
              <br />
              And your people.
            </motion.h1>

            {/* Sub */}
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.16, ease: 'easeOut' }}
              style={{ fontSize: 18, lineHeight: 1.7, color: 'rgba(255,255,255,0.52)', marginTop: 24, maxWidth: 480 }}
            >
              Delegate the search to an agent that knows your rhythm, your budget, and what home should feel like.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.24, ease: 'easeOut' }}
              style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 40, alignItems: 'center' }}
            >
              {/* Primary CTA */}
              <button
                onMouseEnter={() => setCtaHovered(true)}
                onMouseLeave={() => setCtaHovered(false)}
                onClick={() => setModal('signup')}
                style={{
                  position: 'relative',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  height: 60, minWidth: 240,
                  borderRadius: 999, border: '1px solid rgba(255,255,255,0.1)',
                  background: '#0e1015', padding: '0 28px',
                  fontSize: 16, fontWeight: 500, color: '#c8d8ff',
                  boxShadow: '0 8px 60px rgba(0,0,0,0.45)',
                  cursor: 'pointer', overflow: 'hidden',
                  transition: 'transform 300ms ease',
                  transform: ctaHovered ? 'scale(1.015)' : 'scale(1)',
                  fontFamily: 'inherit',
                }}
              >
                {/* Gradient fill */}
                <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(99,134,241,0.22), rgba(99,134,241,0.06))', opacity: 0.9 }} />
                {/* Inner dark layer */}
                <span style={{ position: 'absolute', inset: 1, borderRadius: 999, background: 'linear-gradient(180deg, rgba(18,18,22,0.92), rgba(8,11,12,0.98))' }} />
                {/* Hover glow */}
                <motion.span
                  animate={{ opacity: ctaHovered ? 1 : 0.5, scale: ctaHovered ? 1.08 : 1 }}
                  style={{ position: 'absolute', inset: -32, borderRadius: 999, background: 'radial-gradient(circle, rgba(99,134,241,0.22), transparent 55%)', filter: 'blur(20px)' }}
                />
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Sparkles size={16} />
                  Create an account
                  <ArrowRight size={16} style={{ transition: 'transform 300ms ease', transform: ctaHovered ? 'translateX(2px)' : 'none' }} />
                </span>
              </button>

              {/* Secondary: start without account */}
              <button
                onClick={() => navigate('/onboarding')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  height: 60, minWidth: 190,
                  borderRadius: 999, border: '1px solid rgba(255,255,255,0.11)',
                  background: 'rgba(255,255,255,0.04)', padding: '0 28px',
                  fontSize: 16, fontWeight: 500, color: 'rgba(255,255,255,0.78)',
                  backdropFilter: 'blur(12px)', cursor: 'pointer',
                  transition: 'all 200ms ease', fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.78)' }}
              >
                <Search size={16} />
                Start flat-hunting
              </button>
            </motion.div>

            {/* Feature chips */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.32, ease: 'easeOut' }}
              style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 32 }}
            >
              {FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  borderRadius: 999, border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)', padding: '7px 13px',
                  backdropFilter: 'blur(8px)', fontSize: 13, color: 'rgba(255,255,255,0.48)',
                }}>
                  <Icon size={14} color='#a8bfff' />
                  <span>{label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right: agent card (hidden on mobile) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.16, ease: 'easeOut' }}
            style={{ display: 'none', width: '100%', maxWidth: 480 }}
            className="lg:!block"
          >
            <AgentCard />
          </motion.div>
        </main>

        {/* Floating ✦ orb */}
        <div style={{ position: 'absolute', left: '50%', top: '12%', transform: 'translateX(-50%)', zIndex: 10, pointerEvents: 'none' }}>
          <motion.div
            animate={{ scale: [1, 1.08, 1], opacity: [0.72, 1, 0.72] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
          >
            <span style={{ fontSize: 18, filter: 'drop-shadow(0 0 16px rgba(99,134,241,0.9))', color: '#a8bfff' }}>✦</span>
          </motion.div>
        </div>
      </div>

      {/* Auth modal */}
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
