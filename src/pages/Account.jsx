import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Minus, Plus, LogOut, User } from 'lucide-react'
import { supabase, db, auth } from '../supabase'

/* ── Constants ────────────────────────────────────────────────── */

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
const MUST_HAVE_OPTIONS = [
  'Lift', 'Balcony / terrace', 'Furnished', 'Pets allowed',
  'Parking', 'Natural light', 'Recently renovated',
]

/* ── Small reusable pieces ───────────────────────────────────── */

function Section({ title, children }) {
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 12,
      padding: 28,
      display: 'flex',
      flexDirection: 'column',
      gap: 22,
    }}>
      <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)', margin: 0 }}>
        {title}
      </p>
      {children}
    </div>
  )
}

function FieldLabel({ children }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>
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
        padding: '8px 16px', borderRadius: 999, border: 'none',
        fontSize: 14, fontWeight: 500, cursor: 'pointer',
        transition: 'all 200ms ease',
        background: selected ? 'var(--accent)' : 'rgba(255,255,255,0.07)',
        color: selected ? '#fff' : 'var(--text-secondary)',
      }}
    >
      {label}
    </button>
  )
}

function Chip({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '6px 12px', borderRadius: 999, border: 'none',
        fontSize: 13, fontWeight: 500, cursor: 'pointer',
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

export function Account() {
  const navigate = useNavigate()
  const cityInputRef = useRef(null)

  // Auth state
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // City autocomplete
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Preference fields — initialised from localStorage, then overwritten by Supabase
  const [city, setCity] = useState('')
  const [neighbourhoods, setNeighbourhoods] = useState([])
  const [timeline, setTimeline] = useState('')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [flatType, setFlatType] = useState('')
  const [bedrooms, setBedrooms] = useState(1)
  const [occupants, setOccupants] = useState('')
  const [mustHaves, setMustHaves] = useState([])
  const [commuteAnchor, setCommuteAnchor] = useState('')
  const [dealBreakers, setDealBreakers] = useState('')

  const filteredCities = city.length >= 1
    ? SPANISH_CITIES.filter(c => c.toLowerCase().startsWith(city.toLowerCase())).slice(0, 6)
    : []

  // Load user + preferences on mount
  useEffect(() => {
    async function load() {
      try {
        const { data: { user: u } } = await supabase.auth.getUser()
        setUser(u)

        // Load from Supabase first, fall back to localStorage
        let prefs = null
        if (u) {
          prefs = await db.getPreferences(u.id)
        }
        if (!prefs) {
          try { prefs = JSON.parse(localStorage.getItem('estato_user_profile') || 'null') } catch { /* ignore */ }
        }

        if (prefs) applyPrefs(prefs)
      } catch (err) {
        console.error('Failed to load preferences:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function applyPrefs(prefs) {
    setCity(prefs.city || '')
    setNeighbourhoods(prefs.neighbourhoods || [])
    setTimeline(prefs.move_in_timeline || prefs.timeline || '')
    setBudgetMin(prefs.budget?.min ? String(prefs.budget.min) : '')
    setBudgetMax(prefs.budget?.max ? String(prefs.budget.max) : '')
    setFlatType(prefs.flat_type || prefs.flatType || '')
    // bedrooms can be "Studio", "1", 1, 0, etc.
    const rawBeds = prefs.bedrooms
    if (rawBeds === 'Studio' || rawBeds === 0 || rawBeds === '0') setBedrooms(0)
    else setBedrooms(parseInt(rawBeds, 10) || 1)
    setOccupants(prefs.occupants || '')
    setMustHaves(prefs.must_haves || [])
    setCommuteAnchor(prefs.commute_anchor || '')
    setDealBreakers(Array.isArray(prefs.deal_breakers) ? prefs.deal_breakers.join(', ') : prefs.deal_breakers || '')
  }

  function toggleNeighbourhood(n) {
    setNeighbourhoods(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])
  }

  function toggleMustHave(m) {
    setMustHaves(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const prefs = {
      city: city.trim(),
      neighbourhoods,
      move_in_timeline: timeline,
      budget: {
        min: budgetMin ? parseInt(budgetMin, 10) : null,
        max: budgetMax ? parseInt(budgetMax, 10) : null,
      },
      flat_type: flatType,
      bedrooms: bedrooms === 0 ? 'Studio' : bedrooms,
      occupants,
      must_haves: mustHaves,
      commute_anchor: commuteAnchor.trim(),
      deal_breakers: dealBreakers.split(',').map(s => s.trim()).filter(Boolean),
    }

    try {
      localStorage.setItem('estato_user_profile', JSON.stringify(prefs))
      if (user) await db.savePreferences(user.id, prefs)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      console.error('Failed to save preferences:', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    await auth.signOut()
    navigate('/')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: 'var(--background)' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading…</p>
      </div>
    )
  }

  return (
    <>
      <style>{`
        .acc-input::placeholder { color: var(--text-secondary); }
        .acc-input:focus { outline: none; }
        .acc-number::-webkit-inner-spin-button,
        .acc-number::-webkit-outer-spin-button { -webkit-appearance: none; }
        .acc-number { -moz-appearance: textfield; }
      `}</style>

      <form onSubmit={handleSave} style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: '48px 24px 80px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        fontFamily: 'Inter, SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
      }}>
        {/* Page heading */}
        <div style={{ marginBottom: 8 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Account</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
            Your profile and search preferences.
          </p>
        </div>

        {/* ── Account info ── */}
        <Section title="Account">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(99,134,241,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <User size={18} color="var(--accent)" />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
                  {user?.user_metadata?.full_name || 'Guest'}
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                  {user?.email || 'Not signed in'}
                </p>
              </div>
            </div>
            {user && (
              <button
                type="button"
                onClick={handleSignOut}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 8, border: 'none',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-secondary)',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  transition: 'all 200ms ease',
                  flexShrink: 0,
                }}
              >
                <LogOut size={14} />
                Sign out
              </button>
            )}
          </div>
          {!user && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              Sign in to sync your preferences across devices.
            </p>
          )}
        </Section>

        {/* ── Search preferences ── */}
        <Section title="Search Preferences">

          {/* City */}
          <div>
            <FieldLabel>City</FieldLabel>
            <div style={{ position: 'relative' }}>
              <input
                ref={cityInputRef}
                className="acc-input"
                type="text"
                value={city}
                onChange={e => { setCity(e.target.value); setShowSuggestions(true) }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="e.g. Madrid"
                autoComplete="off"
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.06)', border: 'none',
                  borderRadius: 8, padding: '10px 14px', fontSize: 15,
                  color: 'var(--text-primary)', caretColor: 'var(--accent)', boxSizing: 'border-box',
                }}
              />
              {showSuggestions && filteredCities.length > 0 && (
                <div
                  onMouseDown={e => e.preventDefault()}
                  style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                    background: '#1E1E22', borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 20, overflow: 'hidden',
                  }}
                >
                  {filteredCities.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setCity(c); setShowSuggestions(false) }}
                      style={{
                        display: 'block', width: '100%', padding: '10px 14px',
                        background: 'none', border: 'none', textAlign: 'left',
                        fontSize: 15, color: 'var(--text-primary)', cursor: 'pointer',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Neighbourhoods */}
          {city.trim() && (
            <div>
              <FieldLabel>Neighbourhoods</FieldLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {MADRID_NEIGHBOURHOODS.map(n => (
                  <Chip key={n} label={n} selected={neighbourhoods.includes(n)} onClick={() => toggleNeighbourhood(n)} />
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div>
            <FieldLabel>Move-in timeline</FieldLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TIMELINES.map(t => (
                <PillButton key={t} label={t} selected={timeline === t} onClick={() => setTimeline(timeline === t ? '' : t)} />
              ))}
            </div>
          </div>

          {/* Budget */}
          <div>
            <FieldLabel>Monthly budget</FieldLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-secondary)', pointerEvents: 'none' }}>€</span>
                <input
                  className="acc-input acc-number"
                  type="number"
                  min="0"
                  value={budgetMin}
                  onChange={e => setBudgetMin(e.target.value)}
                  placeholder="Min"
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.06)', border: 'none',
                    borderRadius: 8, padding: '10px 14px 10px 26px', fontSize: 15,
                    color: 'var(--text-primary)', caretColor: 'var(--accent)', boxSizing: 'border-box',
                  }}
                />
              </div>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)', flexShrink: 0 }}>—</span>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-secondary)', pointerEvents: 'none' }}>€</span>
                <input
                  className="acc-input acc-number"
                  type="number"
                  min="0"
                  value={budgetMax}
                  onChange={e => setBudgetMax(e.target.value)}
                  placeholder="Max"
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.06)', border: 'none',
                    borderRadius: 8, padding: '10px 14px 10px 26px', fontSize: 15,
                    color: 'var(--text-primary)', caretColor: 'var(--accent)', boxSizing: 'border-box',
                  }}
                />
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>/month</span>
            </div>
          </div>

          {/* Flat type */}
          <div>
            <FieldLabel>Type of place</FieldLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['Whole flat', 'Room in shared flat'].map(t => (
                <PillButton key={t} label={t} selected={flatType === t} onClick={() => setFlatType(flatType === t ? '' : t)} />
              ))}
            </div>
          </div>

          {/* Bedrooms */}
          <div>
            <FieldLabel>Bedrooms</FieldLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                type="button"
                onClick={() => setBedrooms(b => Math.max(0, b - 1))}
                disabled={bedrooms === 0}
                style={{
                  width: 36, height: 36, borderRadius: 8, border: 'none',
                  background: 'rgba(255,255,255,0.07)',
                  color: bedrooms === 0 ? 'var(--text-secondary)' : 'var(--text-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: bedrooms === 0 ? 'not-allowed' : 'pointer',
                  opacity: bedrooms === 0 ? 0.4 : 1, transition: 'all 200ms ease', flexShrink: 0,
                }}
              >
                <Minus size={16} />
              </button>
              <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', minWidth: 70, textAlign: 'center' }}>
                {bedrooms === 0 ? 'Studio' : bedrooms}
              </span>
              <button
                type="button"
                onClick={() => setBedrooms(b => Math.min(5, b + 1))}
                disabled={bedrooms === 5}
                style={{
                  width: 36, height: 36, borderRadius: 8, border: 'none',
                  background: 'rgba(255,255,255,0.07)',
                  color: bedrooms === 5 ? 'var(--text-secondary)' : 'var(--text-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: bedrooms === 5 ? 'not-allowed' : 'pointer',
                  opacity: bedrooms === 5 ? 0.4 : 1, transition: 'all 200ms ease', flexShrink: 0,
                }}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Who's moving in */}
          <div>
            <FieldLabel>Who's moving in?</FieldLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {OCCUPANTS.map(o => (
                <PillButton key={o} label={o} selected={occupants === o} onClick={() => setOccupants(occupants === o ? '' : o)} />
              ))}
            </div>
          </div>

          {/* Must-haves */}
          <div>
            <FieldLabel>Must-haves</FieldLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {MUST_HAVE_OPTIONS.map(m => (
                <Chip key={m} label={m} selected={mustHaves.includes(m)} onClick={() => toggleMustHave(m)} />
              ))}
            </div>
          </div>

          {/* Commute */}
          <div>
            <FieldLabel>Commute destination</FieldLabel>
            <input
              className="acc-input"
              type="text"
              value={commuteAnchor}
              onChange={e => setCommuteAnchor(e.target.value)}
              placeholder="e.g. Paseo de la Castellana, Madrid"
              style={{
                width: '100%', background: 'rgba(255,255,255,0.06)', border: 'none',
                borderRadius: 8, padding: '10px 14px', fontSize: 15,
                color: 'var(--text-primary)', caretColor: 'var(--accent)', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Deal-breakers */}
          <div>
            <FieldLabel>Deal-breakers</FieldLabel>
            <input
              className="acc-input"
              type="text"
              value={dealBreakers}
              onChange={e => setDealBreakers(e.target.value)}
              placeholder="e.g. Ground floor, no natural light, far from metro"
              style={{
                width: '100%', background: 'rgba(255,255,255,0.06)', border: 'none',
                borderRadius: 8, padding: '10px 14px', fontSize: 15,
                color: 'var(--text-primary)', caretColor: 'var(--accent)', boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>Separate multiple items with commas.</p>
          </div>

        </Section>

        {/* Save button */}
        <button
          type="submit"
          disabled={saving}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 8, border: 'none',
            fontSize: 15, fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
            background: saved ? 'rgba(52,211,105,0.18)' : 'var(--accent)',
            color: saved ? 'var(--success)' : '#fff',
            transition: 'all 280ms ease',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {saved
            ? <><Check size={16} strokeWidth={2.5} /> Saved</>
            : saving ? 'Saving…' : 'Save preferences'
          }
        </button>
      </form>
    </>
  )
}
