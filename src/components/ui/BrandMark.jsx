import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

/* ── Brand mark ──────────────────────────────────────────────────
   Fixed top-left dog + ESTATO wordmark. The dog is a button that
   cycles the background colour, identical to the landing / dashboard.
   Takes a theme ({ bg, ink, logoBg }) and an onCycle handler.
   ──────────────────────────────────────────────────────────── */

export function BrandMark({ theme, onCycle, onHome }) {
  const navigate = useNavigate()
  const goHome = onHome || (() => navigate('/dashboard'))
  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        left: 24,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <motion.button
        type="button"
        onClick={onCycle}
        aria-label="Change background colour"
        title="Click to change background"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.92, rotate: 360 }}
        style={{
          width: 42, height: 42, borderRadius: '50%',
          border: `2px solid ${theme.ink}`,
          overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: theme.logoBg,
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
      <button
        type="button"
        onClick={goHome}
        aria-label="Go to dashboard"
        title="Go to dashboard"
        style={{
          fontFamily: 'Archivo Black, Inter, sans-serif',
          fontSize: 14, letterSpacing: '0.22em',
          color: theme.ink,
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
  )
}
