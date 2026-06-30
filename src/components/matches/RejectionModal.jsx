import { useState } from 'react'
import { X } from 'lucide-react'
import { rejectMatchWithReasons } from '../../lib/dashboard/actions.js'

const LISTING_CHIPS = [
  { value: 'too_expensive',        label: 'Too expensive' },
  { value: 'wrong_location',       label: 'Wrong location' },
  { value: 'too_far_from_commute', label: 'Too far from work' },
  { value: 'no_balcony',           label: 'No balcony' },
  { value: 'too_small',            label: 'Too small' },
  { value: 'ground_floor',         label: 'Ground floor' },
  { value: 'no_natural_light',     label: 'No natural light' },
  { value: 'not_furnished',        label: 'Not furnished' },
  { value: 'no_lift',              label: 'No lift' },
  { value: 'too_noisy',            label: 'Too noisy' },
  { value: 'bad_condition',        label: 'Bad condition' },
]

const FLATMATE_CHIPS = [
  { value: 'incompatible_schedule',     label: 'Incompatible schedule' },
  { value: 'incompatible_cleanliness',  label: 'Different cleanliness standards' },
  { value: 'incompatible_lifestyle',    label: 'Lifestyle mismatch' },
  { value: 'other',                     label: 'Just a feeling' },
]

const MAX_FREE_TEXT = 200

export function RejectionModal({ matchId, matchType, onComplete, onCancel }) {
  const [selected, setSelected] = useState(new Set())
  const [freeText, setFreeText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const chips = matchType === 'flatmate' ? FLATMATE_CHIPS : LISTING_CHIPS

  function toggleChip(value) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(value) ? next.delete(value) : next.add(value)
      return next
    })
  }

  async function handleSubmit() {
    if (selected.size === 0 || submitting) return
    setSubmitting(true)
    await rejectMatchWithReasons(matchId, Array.from(selected), freeText.trim() || undefined)
    setSubmitting(false)
    setDone(true)
    setTimeout(onComplete, 1200)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="w-full max-w-lg rounded-card flex flex-col gap-4 p-5"
        style={{ background: 'var(--surface)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold" style={{ fontSize: 18, color: 'var(--text-primary)' }}>
              What didn't work?
            </p>
            <p className="mt-0.5" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Your agent will learn from this.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded transition-opacity hover:opacity-60"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={17} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {done ? (
          <p
            className="py-4 text-center font-medium"
            style={{ fontSize: 14, color: 'var(--success)' }}
          >
            Got it — your agent is learning
          </p>
        ) : (
          <>
            {/* Chip grid */}
            <div className="flex flex-wrap gap-2">
              {chips.map(({ value, label }) => {
                const active = selected.has(value)
                return (
                  <button
                    key={value}
                    onClick={() => toggleChip(value)}
                    className="px-3 py-1.5 transition-all duration-150"
                    style={{
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      border: active
                        ? '1.5px solid var(--accent)'
                        : '1.5px solid rgba(0,0,0,0.12)',
                      background: active ? 'var(--accent)' : 'transparent',
                      color: active ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Free text */}
            <div className="flex flex-col gap-1">
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value.slice(0, MAX_FREE_TEXT))}
                placeholder="Anything else? (optional)"
                rows={2}
                className="w-full px-3 py-2.5 rounded-btn resize-none outline-none"
                style={{
                  fontSize: 13,
                  background: 'var(--background)',
                  border: '1px solid rgba(0,0,0,0.08)',
                  color: 'var(--text-primary)',
                }}
              />
              <p
                className="self-end"
                style={{ fontSize: 11, color: 'var(--text-secondary)' }}
              >
                {freeText.length} / {MAX_FREE_TEXT}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-btn transition-opacity hover:opacity-70"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: 'var(--text-secondary)',
                }}
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                disabled={selected.size === 0 || submitting}
                className="flex-1 py-2.5 rounded-btn font-semibold transition-opacity"
                style={{
                  fontSize: 14,
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  cursor: selected.size === 0 || submitting ? 'not-allowed' : 'pointer',
                  opacity: selected.size === 0 || submitting ? 0.45 : 1,
                }}
              >
                {submitting ? 'Saving…' : 'Submit'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
