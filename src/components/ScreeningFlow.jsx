import { useState } from 'react'
import { QuickForm } from './QuickForm'
import { ScreeningChat } from './ScreeningChat'

export function ScreeningFlow() {
  const [step, setStep] = useState('form') // 'form' | 'chat'
  const [formData, setFormData] = useState(null)

  function handleFormComplete(data) {
    setFormData(data)
    setStep('chat')
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

      {/* ScreeningChat — fades in once formData is set */}
      {formData && (
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
