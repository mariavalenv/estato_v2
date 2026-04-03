import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const STEPS = [
  {
    id: 'budget',
    question: "What's your monthly budget range?",
    multi: false,
    chips: ['€600–€900', '€900–€1,200', '€1,200–€1,600', '€1,600+'],
  },
  {
    id: 'location',
    question: 'Where would you like to live?',
    multi: true,
    chips: ['Chamberi', 'Salamanca', 'Malasaña', 'Retiro', 'Lavapiés', 'No preference'],
  },
  {
    id: 'lifestyle',
    question: "What's your lifestyle like?",
    multi: true,
    chips: ['Early riser', 'Night owl', 'Hybrid schedule', 'Work from home'],
  },
  {
    id: 'flatmate',
    question: "What's important in a flatmate?",
    multi: true,
    chips: ['Clean & tidy', 'Social', 'Quiet', 'Pet-friendly', 'Professional'],
  },
]

const AVATAR = 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=flatmate&backgroundColor=6386F1'

function ProgressDots({ total, current }) {
  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full transition-all duration-200"
          style={{
            background: i <= current ? 'var(--accent)' : 'rgba(0,0,0,0.15)',
            transform: i === current ? 'scale(1.25)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  )
}

function AgentBubble({ text, children }) {
  return (
    <div className="flex items-start gap-3">
      <img
        src={AVATAR}
        alt="Agent"
        className="w-8 h-8 rounded-full shrink-0 mt-0.5"
        style={{ background: 'var(--accent)', padding: '2px' }}
      />
      <div
        className="rounded-card rounded-tl-sm px-4 py-3 max-w-xs shadow-surface text-body"
        style={{ background: '#F0F0F5', color: '#0A0A0A' }}
      >
        {text && <p>{text}</p>}
        {children}
      </div>
    </div>
  )
}

function Chip({ label, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2 rounded-chip text-body font-medium transition-all duration-200 cursor-pointer"
      style={{
        background: selected ? 'var(--accent)' : '#EBEBF0',
        color: selected ? '#fff' : '#0A0A0A',
        border: 'none',
      }}
    >
      {selected && <Check size={13} strokeWidth={2.5} />}
      {label}
    </button>
  )
}

function SummaryBubble({ answers, onEdit }) {
  return (
    <AgentBubble>
      <p className="mb-2 font-medium">Here's what you're looking for:</p>
      <ul className="flex flex-col gap-1 text-meta" style={{ color: '#444' }}>
        <li>
          <strong>Budget:</strong>{' '}
          {Array.isArray(answers.budget) ? answers.budget.join(', ') : answers.budget}
        </li>
        <li>
          <strong>Locations:</strong>{' '}
          {Array.isArray(answers.location) ? answers.location.join(', ') : answers.location}
        </li>
        <li>
          <strong>Lifestyle:</strong>{' '}
          {Array.isArray(answers.lifestyle) ? answers.lifestyle.join(', ') : answers.lifestyle}
        </li>
        <li>
          <strong>Flatmate traits:</strong>{' '}
          {Array.isArray(answers.flatmate) ? answers.flatmate.join(', ') : answers.flatmate}
        </li>
      </ul>
      <button
        onClick={onEdit}
        className="mt-3 text-meta font-medium underline transition-opacity duration-200 hover:opacity-70 cursor-pointer"
        style={{ background: 'none', border: 'none', color: 'var(--accent)', padding: 0 }}
      >
        Edit preferences
      </button>
    </AgentBubble>
  )
}

const variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

export function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({ budget: [], location: [], lifestyle: [], flatmate: [] })
  const [done, setDone] = useState(false)

  const current = STEPS[step]

  function toggle(chipLabel) {
    const key = current.id
    if (current.multi) {
      setAnswers((prev) => {
        const arr = prev[key]
        return {
          ...prev,
          [key]: arr.includes(chipLabel)
            ? arr.filter((v) => v !== chipLabel)
            : [...arr, chipLabel],
        }
      })
    } else {
      setAnswers((prev) => ({ ...prev, [key]: [chipLabel] }))
    }
  }

  function isSelected(chipLabel) {
    const key = current.id
    const val = answers[key]
    return Array.isArray(val) ? val.includes(chipLabel) : val === chipLabel
  }

  function canAdvance() {
    const val = answers[current.id]
    return Array.isArray(val) ? val.length > 0 : Boolean(val)
  }

  function advance() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1)
    } else {
      setDone(true)
    }
  }

  return (
    // Light surface for onboarding
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#FAFAFA', color: '#0A0A0A' }}
    >
      {/* Progress */}
      <div className="px-6 pt-8 pb-4">
        <ProgressDots total={STEPS.length} current={done ? STEPS.length - 1 : step} />
      </div>

      {/* Chat area */}
      <div className="flex-1 px-6 py-4 flex flex-col gap-6 max-w-lg mx-auto w-full">
        <AnimatePresence mode="wait">
          {!done ? (
            <motion.div
              key={step}
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex flex-col gap-6"
            >
              <AgentBubble text={current.question} />

              <div className="flex flex-wrap gap-2 pl-11">
                {current.chips.map((chip) => (
                  <Chip
                    key={chip}
                    label={chip}
                    selected={isSelected(chip)}
                    onClick={() => toggle(chip)}
                  />
                ))}
              </div>

              <div className="pl-11">
                <button
                  onClick={advance}
                  disabled={!canAdvance()}
                  className="px-6 py-2.5 rounded-btn text-body font-medium transition-all duration-200 cursor-pointer"
                  style={{
                    background: canAdvance() ? '#0A0A0A' : '#ccc',
                    color: '#fff',
                    border: 'none',
                    cursor: canAdvance() ? 'pointer' : 'default',
                    opacity: canAdvance() ? 1 : 0.5,
                  }}
                >
                  {step < STEPS.length - 1 ? 'Next →' : 'Review →'}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="summary"
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex flex-col gap-6"
            >
              <SummaryBubble answers={answers} onEdit={() => { setDone(false); setStep(0) }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CTA */}
      <div className="px-6 pb-8 max-w-lg mx-auto w-full flex flex-col gap-3">
        {done && (
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3.5 rounded-btn text-body font-semibold transition-all duration-200 cursor-pointer"
            style={{ background: '#0A0A0A', color: '#fff', border: 'none' }}
          >
            Start flat-hunting
          </button>
        )}
        <p className="text-center text-meta" style={{ color: '#6B6B6B' }}>
          Your data is private and secure.
        </p>
      </div>
    </div>
  )
}
