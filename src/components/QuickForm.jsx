import { useState, useRef } from 'react'
import { Home, Users, Minus, Plus, Check } from 'lucide-react'

/* ── Data ────────────────────────────────────────────────────── */

const SPANISH_CITIES = [
  'Madrid', 'Barcelona', 'Valencia', 'Seville', 'Zaragoza', 'Málaga',
  'Murcia', 'Palma', 'Las Palmas de Gran Canaria', 'Bilbao', 'Alicante',
  'Córdoba', 'Valladolid', 'Vigo', 'Gijón', 'Granada', 'San Sebastián',
  'Pamplona', 'Santander', 'Salamanca', 'Burgos', 'Albacete', 'Logroño',
  'Badajoz', 'Huelva', 'Marbella', 'León', 'Tarragona', 'Lleida', 'Girona',
]

const MADRID_NEIGHBOURHOODS = [
  'Chamberí', 'Salamanca', 'Malasaña', 'Retiro', 'Lavapiés',
  'Chueca', 'Moncloa', 'Arguelles', 'Embajadores', 'La Latina',
]

const TIMELINES = ['ASAP', '1–3 months', 'Just exploring']
const OCCUPANTS = ['Just me', 'Couple', 'Me + my flatmate']

/* ── Small reusable pieces ───────────────────────────────────── */

function FieldLabel({ children }) {
  return (
    <p style={{
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--text-secondary)',
      marginBottom: 8,
    }}>
      {children}
    </p>
  )
}

function PillButton({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 16px',
        borderRadius: 999,
        border: 'none',
        fontSize: 14,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 200ms ease',
        background: selected ? 'var(--accent)' : 'rgba(255,255,255,0.07)',
        color: selected ? '#fff' : 'var(--text-secondary)',
      }}
    >
      {label}
    </button>
  )
}

function NeighbourhoodChip({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '6px 12px',
        borderRadius: 999,
        border: 'none',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 200ms ease',
        background: selected ? 'rgba(99,134,241,0.18)' : 'rgba(255,255,255,0.06)',
        color: selected ? 'var(--accent)' : 'var(--text-secondary)',
      }}
    >
      {selected && <Check size={11} strokeWidth={2.5} />}
      {label}
    </button>
  )
}

/* ── Main component ──────────────────────────────────────────── */

export function QuickForm({ onComplete }) {
  const [cityInput, setCityInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [neighbourhoods, setNeighbourhoods] = useState([])
  const [timeline, setTimeline] = useState('')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [flatType, setFlatType] = useState('')
  const [bedrooms, setBedrooms] = useState(1)
  const [occupants, setOccupants] = useState('')

  const cityInputRef = useRef(null)

  const filteredCities = cityInput.length >= 1
    ? SPANISH_CITIES.filter((c) =>
        c.toLowerCase().startsWith(cityInput.toLowerCase())
      ).slice(0, 6)
    : []

  const canSubmit = cityInput.trim().length > 0

  function toggleNeighbourhood(n) {
    setNeighbourhoods((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]
    )
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    onComplete({
      city: cityInput.trim(),
      neighbourhoods,
      timeline,
      budget: {
        min: budgetMin ? parseInt(budgetMin, 10) : null,
        max: budgetMax ? parseInt(budgetMax, 10) : null,
      },
      flatType,
      bedrooms,
      occupants,
    })
  }

  return (
    <>
      <style>{`
        .qf-input::placeholder { color: var(--text-secondary); }
        .qf-input:focus { outline: none; }
        .qf-number::-webkit-inner-spin-button,
        .qf-number::-webkit-outer-spin-button { -webkit-appearance: none; }
        .qf-number { -moz-appearance: textfield; }
      `}</style>

      <div style={{
        minHeight: '100dvh',
        background: 'var(--background)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 24px 64px',
        fontFamily: 'Inter, SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
      }}>
        <form
          onSubmit={handleSubmit}
          style={{
            width: '100%',
            maxWidth: 480,
            background: 'var(--surface)',
            borderRadius: 12,
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
          }}
        >
          {/* Heading */}
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Let's get the basics
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 }}>
              Takes 30 seconds. Your agent handles the rest.
            </p>
          </div>

          {/* ── City ── */}
          <div>
            <FieldLabel>City <span style={{ color: 'var(--accent)' }}>*</span></FieldLabel>
            <div style={{ position: 'relative' }}>
              <input
                ref={cityInputRef}
                className="qf-input"
                type="text"
                value={cityInput}
                onChange={(e) => {
                  setCityInput(e.target.value)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="e.g. Madrid"
                autoComplete="off"
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.06)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 15,
                  color: 'var(--text-primary)',
                  caretColor: 'var(--accent)',
                  boxSizing: 'border-box',
                }}
              />
              {showSuggestions && filteredCities.length > 0 && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    background: '#1E1E22',
                    borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    zIndex: 20,
                    overflow: 'hidden',
                  }}
                >
                  {filteredCities.map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => {
                        setCityInput(city)
                        setShowSuggestions(false)
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '10px 14px',
                        background: 'none',
                        border: 'none',
                        textAlign: 'left',
                        fontSize: 15,
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'background 150ms ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Neighbourhoods (appears after city entered) ── */}
          {cityInput.trim() && (
            <div>
              <FieldLabel>Neighbourhoods</FieldLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {MADRID_NEIGHBOURHOODS.map((n) => (
                  <NeighbourhoodChip
                    key={n}
                    label={n}
                    selected={neighbourhoods.includes(n)}
                    onClick={() => toggleNeighbourhood(n)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Timeline ── */}
          <div>
            <FieldLabel>Move-in timeline</FieldLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TIMELINES.map((t) => (
                <PillButton
                  key={t}
                  label={t}
                  selected={timeline === t}
                  onClick={() => setTimeline(timeline === t ? '' : t)}
                />
              ))}
            </div>
          </div>

          {/* ── Budget ── */}
          <div>
            <FieldLabel>Monthly budget (all bills included)</FieldLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 14,
                  color: 'var(--text-secondary)',
                  pointerEvents: 'none',
                }}>€</span>
                <input
                  className="qf-input qf-number"
                  type="number"
                  min="0"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                  placeholder="Min"
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.06)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 14px 10px 26px',
                    fontSize: 15,
                    color: 'var(--text-primary)',
                    caretColor: 'var(--accent)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)', flexShrink: 0 }}>—</span>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 14,
                  color: 'var(--text-secondary)',
                  pointerEvents: 'none',
                }}>€</span>
                <input
                  className="qf-input qf-number"
                  type="number"
                  min="0"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  placeholder="Max"
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.06)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 14px 10px 26px',
                    fontSize: 15,
                    color: 'var(--text-primary)',
                    caretColor: 'var(--accent)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>/month</span>
            </div>
          </div>

          {/* ── Flat type ── */}
          <div>
            <FieldLabel>Type of place</FieldLabel>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { value: 'Whole flat', Icon: Home, label: 'Whole flat' },
                { value: 'Room in shared flat', Icon: Users, label: 'Room in shared flat' },
              ].map(({ value, Icon, label }) => {
                const selected = flatType === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFlatType(flatType === value ? '' : value)}
                    style={{
                      flex: 1,
                      padding: '18px 12px',
                      borderRadius: 12,
                      border: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      transition: 'all 200ms ease',
                      background: selected
                        ? 'rgba(99,134,241,0.14)'
                        : 'rgba(255,255,255,0.05)',
                      boxShadow: selected
                        ? '0 0 0 1px rgba(99,134,241,0.45)'
                        : '0 0 0 1px transparent',
                    }}
                  >
                    <Icon
                      size={22}
                      color={selected ? 'var(--accent)' : 'var(--text-secondary)'}
                    />
                    <span style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      textAlign: 'center',
                      lineHeight: 1.3,
                    }}>
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Bedrooms ── */}
          <div>
            <FieldLabel>Bedrooms</FieldLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                type="button"
                onClick={() => setBedrooms((b) => Math.max(0, b - 1))}
                disabled={bedrooms === 0}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: 'none',
                  background: 'rgba(255,255,255,0.07)',
                  color: bedrooms === 0 ? 'var(--text-secondary)' : 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: bedrooms === 0 ? 'not-allowed' : 'pointer',
                  opacity: bedrooms === 0 ? 0.4 : 1,
                  transition: 'all 200ms ease',
                  flexShrink: 0,
                }}
              >
                <Minus size={16} />
              </button>

              <span style={{
                fontSize: 17,
                fontWeight: 600,
                color: 'var(--text-primary)',
                minWidth: 70,
                textAlign: 'center',
              }}>
                {bedrooms === 0 ? 'Studio' : bedrooms}
              </span>

              <button
                type="button"
                onClick={() => setBedrooms((b) => Math.min(5, b + 1))}
                disabled={bedrooms === 5}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: 'none',
                  background: 'rgba(255,255,255,0.07)',
                  color: bedrooms === 5 ? 'var(--text-secondary)' : 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: bedrooms === 5 ? 'not-allowed' : 'pointer',
                  opacity: bedrooms === 5 ? 0.4 : 1,
                  transition: 'all 200ms ease',
                  flexShrink: 0,
                }}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* ── Who's moving in ── */}
          <div>
            <FieldLabel>Who's moving in?</FieldLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {OCCUPANTS.map((o) => (
                <PillButton
                  key={o}
                  label={o}
                  selected={occupants === o}
                  onClick={() => setOccupants(occupants === o ? '' : o)}
                />
              ))}
            </div>
          </div>

          {/* ── Continue ── */}
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              width: '100%',
              padding: '13px 0',
              borderRadius: 8,
              border: 'none',
              fontSize: 15,
              fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              background: canSubmit ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
              color: canSubmit ? '#fff' : 'var(--text-secondary)',
              transition: 'all 200ms ease',
              opacity: canSubmit ? 1 : 0.6,
            }}
          >
            Continue to agent →
          </button>
        </form>
      </div>
    </>
  )
}
