import { useState, useRef } from 'react'
import { QuickForm } from './QuickForm'
import { ScreeningChat } from './ScreeningChat'

export function ScreeningFlow() {
  const [step, setStep] = useState('form') // 'form' | 'chat'
  const [formData, setFormData] = useState(null)
  const [chatMounted, setChatMounted] = useState(false)
  const transitionTimer = useRef(null)

  function handleFormComplete(data) {
    setFormData(data)
    setStep('chat')
    // Mount chat after the fade-out completes so the API call
    // doesn't compete with the CSS transition on the main thread
    transitionTimer.current = setTimeout(() => setChatMounted(true), 300)
  }

  return (
    <div style={{ position: 'relative', height: '100dvh', background: 'var(--background)', overflow: 'hidden' }}>
      {/* QuickForm — fades out */}
      <div style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        opacity: step === 'form' ? 1 : 0,
        transition: 'opacity 280ms ease',
        pointerEvents: step === 'form' ? 'auto' : 'none',
      }}>
        <QuickForm onComplete={handleFormComplete} />
      </div>

      {/* ScreeningChat — mounted after transition, then fades in */}
      {chatMounted && formData && (
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: step === 'chat' ? 1 : 0,
          transition: 'opacity 280ms ease',
        }}>
          <ScreeningChat initialContext={formData} />
        </div>
      )}
    </div>
  )
}
