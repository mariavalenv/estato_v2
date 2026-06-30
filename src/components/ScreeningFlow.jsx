import { useState, useRef } from 'react'
import { QuickForm } from './QuickForm'
import { ScreeningChat } from './ScreeningChat'
import { useLandingTheme, buildThemeVars, RED } from '../lib/landingTheme.js'

export function ScreeningFlow() {
  const hasSaved = (() => { try { return !!localStorage.getItem('estato_quick_form') } catch { return false } })()

  // One source of truth for the dashboard palette across both steps.
  // Setting the CSS vars on the root re-themes any descendant that
  // styles itself with var(--…) (e.g. the listing detail panel).
  const { theme, cycle } = useLandingTheme()

  const [step, setStep] = useState(hasSaved ? 'chat' : 'form')
  const [formData, setFormData] = useState(() => {
    try {
      const saved = localStorage.getItem('estato_quick_form')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [chatMounted, setChatMounted] = useState(hasSaved)
  const transitionTimer = useRef(null)

  function handleFormComplete(data) {
    // Persist immediately so a refresh doesn't lose the form data
    try { localStorage.setItem('estato_quick_form', JSON.stringify(data)) } catch {}
    setFormData(data)
    setStep('chat')
    // Mount chat after the fade-out completes so the API call
    // doesn't compete with the CSS transition on the main thread
    transitionTimer.current = setTimeout(() => setChatMounted(true), 300)
  }

  function handleScreeningComplete() {
    // Clear saved form data so next visit starts fresh
    try { localStorage.removeItem('estato_quick_form') } catch {}
  }

  return (
    <div style={{
      ...buildThemeVars(theme),
      // Screening-only: use the brand red for accents so the property
      // detail panel (themed via --accent) matches the chat/listings.
      '--accent': RED,
      '--accent-muted': 'rgba(201, 74, 61, 0.12)',
      position: 'relative',
      height: '100dvh',
      background: theme.bg,
      overflow: 'hidden',
      transition: 'background 0.5s ease',
    }}>
      {/* QuickForm — fades out */}
      <div style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        opacity: step === 'form' ? 1 : 0,
        transition: 'opacity 280ms ease',
        pointerEvents: step === 'form' ? 'auto' : 'none',
      }}>
        <QuickForm onComplete={handleFormComplete} theme={theme} onCycleTheme={cycle} />
      </div>

      {/* ScreeningChat — mounted after transition, then fades in */}
      {chatMounted && formData && (
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: step === 'chat' ? 1 : 0,
          transition: 'opacity 280ms ease',
        }}>
          <ScreeningChat
            initialContext={formData}
            onScreeningComplete={handleScreeningComplete}
            theme={theme}
            onCycleTheme={cycle}
          />
        </div>
      )}
    </div>
  )
}
