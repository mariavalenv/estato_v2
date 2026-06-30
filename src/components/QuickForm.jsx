import { useState, useRef } from 'react'
import { Home, Users, Minus, Plus, Check } from 'lucide-react'
import { inkTint, selectedColors, RED } from '../lib/landingTheme.js'
import { BrandMark } from './ui/BrandMark'

/* ── Data ────────────────────────────────────────────────────── */

const SPANISH_CITIES = [
  'Madrid', 'Barcelona', 'Valencia', 'Seville', 'Zaragoza', 'Málaga',
  'Murcia', 'Palma', 'Las Palmas de Gran Canaria', 'Bilbao', 'Alicante',
  'Córdoba', 'Valladolid', 'Vigo', 'Gijón', 'Granada', 'San Sebastián',
  'Pamplona', 'Santander', 'Salamanca', 'Burgos', 'Albacete', 'Logroño',
  'Badajoz', 'Huelva', 'Marbella', 'León', 'Tarragona', 'Lleida', 'Girona',
]

const CITY_NEIGHBOURHOODS = {
  'Madrid': [
    'Chamberí', 'Salamanca', 'Malasaña', 'Retiro', 'Lavapiés',
    'Chueca', 'Moncloa', 'Arguelles', 'Embajadores', 'La Latina',
  ],
  'Barcelona': [
    'Eixample', 'Gràcia', 'El Born', 'El Raval', 'Gòtic',
    'Poblenou', 'Sants', 'Sarrià', 'Poble-sec', 'Barceloneta',
  ],
  'Valencia': [
    'Ruzafa', 'El Carmen', 'Ciutat Vella', 'Eixample', 'Benimaclet',
    'Cabanyal', 'Extramurs', 'Patraix',
  ],
  'Seville': [
    'Triana', 'Santa Cruz', 'Alameda', 'Los Remedios', 'Nervión',
    'La Macarena', 'Arenal',
  ],
  'Málaga': [
    'Centro Histórico', 'La Malagueta', 'Soho', 'El Palo',
    'Pedregalejo', 'Teatinos',
  ],
  'Bilbao': [
    'Casco Viejo', 'Indautxu', 'Abando', 'Deusto', 'San Francisco',
    'Santutxu',
  ],
  'Zaragoza': [
    'Centro', 'Casco Histórico', 'Delicias', 'Universidad',
    'Actur', 'San José',
  ],
}

function neighbourhoodsForCity(city) {
  if (!city) return []
  const match = Object.keys(CITY_NEIGHBOURHOODS).find(
    (c) => c.toLowerCase() === city.trim().toLowerCase()
  )
  return match ? CITY_NEIGHBOURHOODS[match] : []
}

const TIMELINES = ['ASAP', '1–3 months', 'Just exploring']

const PERSON_CHARS = ['woman', 'man', 'box']
const PET_CHARS = ['dog', 'cat']

function readHouseholdFromLanding() {
  try {
    const raw = sessionStorage.getItem('estato:household')
    if (!raw) return null
    const picked = JSON.parse(raw)
    if (!Array.isArray(picked)) return null
    const personCount = picked.filter((id) => PERSON_CHARS.includes(id)).length
    const pets = picked.filter((id) => PET_CHARS.includes(id))
    return { adults: Math.max(1, personCount), pets }
  } catch {
    return null
  }
}

/* ── Small reusable pieces ───────────────────────────────────── */

function FieldLabel({ children, theme }) {
  return (
    <p style={{
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: inkTint(theme, 0.5),
      marginBottom: 10,
    }}>
      {children}
    </p>
  )
}

function PillButton({ label, selected, onClick, theme }) {
  const sel = selectedColors(theme)
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 16px',
        borderRadius: 999,
        border: `1px solid ${selected ? sel.bg : inkTint(theme, 0.16)}`,
        fontSize: 14,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 200ms ease',
        background: selected ? sel.bg : 'transparent',
        color: selected ? sel.fg : inkTint(theme, 0.65),
      }}
    >
      {label}
    </button>
  )
}

function NeighbourhoodChip({ label, selected, onClick, theme }) {
  const sel = selectedColors(theme)
  const selectedBg = sel.bg
  const selectedFg = sel.fg
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
        border: `1px solid ${selected ? selectedBg : inkTint(theme, 0.16)}`,
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 200ms ease',
        background: selected ? selectedBg : 'transparent',
        color: selected ? selectedFg : inkTint(theme, 0.65),
      }}
    >
      {selected && <Check size={11} strokeWidth={2.5} />}
      {label}
    </button>
  )
}

function Stepper({ label, onDec, onInc, atMin, atMax, theme }) {
  const btn = (disabled) => ({
    width: 38,
    height: 38,
    borderRadius: 10,
    border: `1px solid ${inkTint(theme, 0.16)}`,
    background: 'transparent',
    color: disabled ? inkTint(theme, 0.3) : theme.ink,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 200ms ease',
    flexShrink: 0,
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <button type="button" onClick={onDec} disabled={atMin} style={btn(atMin)}>
        <Minus size={16} />
      </button>
      <span style={{
        fontSize: 15,
        fontWeight: 500,
        color: inkTint(theme, 0.65),
        minWidth: 80,
        textAlign: 'center',
      }}>
        {label}
      </span>
      <button type="button" onClick={onInc} disabled={atMax} style={btn(atMax)}>
        <Plus size={16} />
      </button>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────── */

export function QuickForm({ onComplete, theme, onCycleTheme }) {
  const [cityInput, setCityInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [neighbourhoods, setNeighbourhoods] = useState([])
  const [timeline, setTimeline] = useState('')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [flatType, setFlatType] = useState('')
  const [bedrooms, setBedrooms] = useState(1)
  const [adults, setAdults] = useState(() => readHouseholdFromLanding()?.adults ?? 1)
  const [hasPets, setHasPets] = useState(() => (readHouseholdFromLanding()?.pets ?? []).length > 0)

  const cityInputRef = useRef(null)

  const filteredCities = cityInput.length >= 1
    ? SPANISH_CITIES.filter((c) =>
        c.toLowerCase().startsWith(cityInput.toLowerCase())
      ).slice(0, 6)
    : []

  const cityNeighbourhoods = neighbourhoodsForCity(cityInput)

  function selectCity(city) {
    setCityInput(city)
    setNeighbourhoods([])
    setShowSuggestions(false)
  }

  const canSubmit = cityInput.trim().length > 0

  // On the terracotta theme the page background is red, so the input
  // form sits on its own white card for contrast/legibility. On light
  // it stays borderless on the white page.
  const isTerracotta = theme.id === 'terracotta'
  const surfaceBg = isTerracotta ? '#FFFFFF' : theme.bg

  // Border lives in the .qf-input CSS class (not inline) so the
  // :focus rule can override it — inline styles win over stylesheet
  // rules, which would otherwise swallow the focus colour.
  const inputStyle = {
    width: '100%',
    background: inkTint(theme, 0.04),
    borderRadius: 10,
    padding: '11px 14px',
    fontSize: 15,
    color: theme.ink,
    caretColor: theme.ink,
    boxSizing: 'border-box',
  }

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
      adults,
      hasPets,
    })
  }

  return (
    <>
      <style>{`
        .qf-input::placeholder { color: ${inkTint(theme, 0.4)}; }
        .qf-input { border: 1px solid ${inkTint(theme, 0.14)}; }
        .qf-input:focus { outline: none; border-color: ${RED}; }
        .qf-number::-webkit-inner-spin-button,
        .qf-number::-webkit-outer-spin-button { -webkit-appearance: none; }
        .qf-number { -moz-appearance: textfield; }
      `}</style>

      <BrandMark theme={theme} onCycle={onCycleTheme} />

      <div style={{
        minHeight: '100dvh',
        background: theme.bg,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '104px 24px 72px',
        fontFamily: 'Inter, SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
        transition: 'background 0.5s ease',
      }}>
        <form
          onSubmit={handleSubmit}
          style={{
            width: '100%',
            maxWidth: 480,
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
            background: isTerracotta ? '#FFFFFF' : 'transparent',
            borderRadius: isTerracotta ? 20 : 0,
            padding: isTerracotta ? 'clamp(24px, 4vw, 36px)' : 0,
            boxShadow: isTerracotta ? '0 24px 60px rgba(0,0,0,0.22)' : 'none',
            transition: 'background 0.5s ease, box-shadow 0.5s ease',
          }}
        >
          {/* Heading */}
          <div>
            <h1 style={{
              fontFamily: 'Archivo Black, Inter, sans-serif',
              fontSize: 'clamp(26px, 4vw, 34px)',
              letterSpacing: '-0.01em',
              lineHeight: 1.05,
              color: theme.ink,
              margin: 0,
              textTransform: 'uppercase',
            }}>
              Let's get<br />the basics
            </h1>
            <p style={{ fontSize: 15, color: inkTint(theme, 0.6), marginTop: 12 }}>
              Takes 30 seconds. Your agent handles the rest.
            </p>
          </div>

          {/* ── City ── */}
          <div>
            <FieldLabel theme={theme}>City <span style={{ color: theme.ink }}>*</span></FieldLabel>
            <div style={{ position: 'relative' }}>
              <input
                ref={cityInputRef}
                className="qf-input"
                type="text"
                value={cityInput}
                onChange={(e) => {
                  setCityInput(e.target.value)
                  setNeighbourhoods([])
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="e.g. Madrid"
                autoComplete="off"
                style={inputStyle}
              />
              {showSuggestions && filteredCities.length > 0 && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    background: surfaceBg,
                    border: `1px solid ${inkTint(theme, 0.14)}`,
                    borderRadius: 10,
                    boxShadow: `0 12px 32px ${inkTint(theme, 0.18)}`,
                    zIndex: 20,
                    overflow: 'hidden',
                  }}
                >
                  {filteredCities.map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => selectCity(city)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '10px 14px',
                        background: 'none',
                        border: 'none',
                        textAlign: 'left',
                        fontSize: 15,
                        color: theme.ink,
                        cursor: 'pointer',
                        transition: 'background 150ms ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = inkTint(theme, 0.06) }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Neighbourhoods (appears once a known city is entered) ── */}
          {cityNeighbourhoods.length > 0 && (
            <div>
              <FieldLabel theme={theme}>Neighbourhoods</FieldLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {cityNeighbourhoods.map((n) => (
                  <NeighbourhoodChip
                    key={n}
                    label={n}
                    selected={neighbourhoods.includes(n)}
                    onClick={() => toggleNeighbourhood(n)}
                    theme={theme}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Timeline ── */}
          <div>
            <FieldLabel theme={theme}>Move-in timeline</FieldLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TIMELINES.map((t) => (
                <PillButton
                  key={t}
                  label={t}
                  selected={timeline === t}
                  onClick={() => setTimeline(timeline === t ? '' : t)}
                  theme={theme}
                />
              ))}
            </div>
          </div>

          {/* ── Budget ── */}
          <div>
            <FieldLabel theme={theme}>Monthly budget (all bills included)</FieldLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 14,
                  color: inkTint(theme, 0.55),
                  pointerEvents: 'none',
                }}>€</span>
                <input
                  className="qf-input qf-number"
                  type="number"
                  min="0"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                  placeholder="Min"
                  style={{ ...inputStyle, padding: '11px 14px 11px 26px' }}
                />
              </div>
              <span style={{ fontSize: 14, color: inkTint(theme, 0.55), flexShrink: 0 }}>—</span>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 14,
                  color: inkTint(theme, 0.55),
                  pointerEvents: 'none',
                }}>€</span>
                <input
                  className="qf-input qf-number"
                  type="number"
                  min="0"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  placeholder="Max"
                  style={{ ...inputStyle, padding: '11px 14px 11px 26px' }}
                />
              </div>
              <span style={{ fontSize: 13, color: inkTint(theme, 0.55), flexShrink: 0 }}>/month</span>
            </div>
          </div>

          {/* ── Flat type ── */}
          <div>
            <FieldLabel theme={theme}>Type of place</FieldLabel>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { value: 'Whole flat', Icon: Home, label: 'Whole flat' },
                { value: 'Room in shared flat', Icon: Users, label: 'Room in shared flat' },
              ].map(({ value, Icon, label }) => {
                const selected = flatType === value
                const sel = selectedColors(theme)
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFlatType(flatType === value ? '' : value)}
                    style={{
                      flex: 1,
                      padding: '18px 12px',
                      borderRadius: 12,
                      border: `1px solid ${selected ? sel.bg : inkTint(theme, 0.14)}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      transition: 'all 200ms ease',
                      background: selected ? sel.bg : 'transparent',
                    }}
                  >
                    <Icon
                      size={22}
                      color={selected ? sel.fg : inkTint(theme, 0.55)}
                    />
                    <span style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: selected ? sel.fg : inkTint(theme, 0.6),
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
            <FieldLabel theme={theme}>Bedrooms</FieldLabel>
            <Stepper
              theme={theme}
              label={bedrooms === 0 ? 'Studio' : bedrooms}
              atMin={bedrooms === 0}
              atMax={bedrooms === 5}
              onDec={() => setBedrooms((b) => Math.max(0, b - 1))}
              onInc={() => setBedrooms((b) => Math.min(5, b + 1))}
            />
          </div>

          {/* ── People moving in ── */}
          <div>
            <FieldLabel theme={theme}>People moving in</FieldLabel>
            <Stepper
              theme={theme}
              label={adults === 1 ? 'Just me' : `${adults} people`}
              atMin={adults === 1}
              atMax={adults === 8}
              onDec={() => setAdults((a) => Math.max(1, a - 1))}
              onInc={() => setAdults((a) => Math.min(8, a + 1))}
            />
          </div>

          {/* ── Pets ── */}
          <div>
            <FieldLabel theme={theme}>Pets</FieldLabel>
            <button
              type="button"
              onClick={() => setHasPets((v) => !v)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              <span style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                border: `1px solid ${hasPets ? selectedColors(theme).bg : inkTint(theme, 0.16)}`,
                background: hasPets ? selectedColors(theme).bg : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 200ms ease',
                flexShrink: 0,
              }}>
                {hasPets && <Check size={14} strokeWidth={2.5} color={selectedColors(theme).fg} />}
              </span>
              <span style={{ fontSize: 15, fontWeight: 500, color: inkTint(theme, 0.65) }}>
                I have pets
              </span>
            </button>
          </div>

          {/* ── Continue ── */}
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              width: '100%',
              padding: '15px 0',
              borderRadius: 999,
              border: 'none',
              fontFamily: 'Archivo Black, Inter, sans-serif',
              fontSize: 14,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              background: canSubmit ? selectedColors(theme).bg : inkTint(theme, 0.12),
              color: canSubmit ? selectedColors(theme).fg : inkTint(theme, 0.4),
              transition: 'all 200ms ease',
            }}
          >
            Continue to agent →
          </button>
        </form>
      </div>
    </>
  )
}
