import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { RotateCcw, Mic, MicOff, AlertCircle } from 'lucide-react'
import { supabase, db } from '../supabase.js'
import { getAgentPermissions, getPreferenceLearningLog } from '../lib/dashboard/fetchers.js'
import { saveAgentPermissions, acceptPreferenceUpdate, dismissPreferenceUpdate } from '../lib/dashboard/actions.js'

/* ── Shared UI primitives ────────────────────────────────────── */

function Section({ title, children }) {
  return (
    <div className="rounded-card p-6 shadow-card flex flex-col gap-5" style={{ background: 'var(--surface)' }}>
      <p className="text-heading font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>
      {children}
    </div>
  )
}

function FieldRow({ label, sub, children }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-body font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
        {sub && <p className="text-meta mt-0.5" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
      </div>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative shrink-0 transition-colors duration-200"
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: checked ? 'var(--accent)' : 'rgba(0,0,0,0.15)',
        border: 'none', cursor: 'pointer',
      }}
    >
      <span
        className="absolute top-0.5 transition-transform duration-200"
        style={{
          left: 2, width: 20, height: 20, borderRadius: '50%',
          background: '#fff',
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
          display: 'block',
        }}
      />
    </button>
  )
}

/* ── Skeleton ────────────────────────────────────────────────── */

function SectionSkeleton() {
  return (
    <div className="rounded-card p-6 shadow-card animate-pulse" style={{ background: 'var(--surface)' }}>
      <div className="h-5 w-1/3 rounded mb-5" style={{ background: 'var(--background)' }} />
      {[70, 60, 80].map((w, i) => (
        <div key={i} className="h-4 rounded mb-3" style={{ background: 'var(--background)', width: `${w}%` }} />
      ))}
    </div>
  )
}

/* ── ProfileSummary ──────────────────────────────────────────── */

function ProfileSummary({ prefs }) {
  if (!prefs) {
    return (
      <Section title="Your profile">
        <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
          No profile yet. Complete the screening to build your preferences.
        </p>
      </Section>
    )
  }

  const fields = [
    { label: 'City',              value: prefs.city },
    { label: 'Neighbourhoods',    value: prefs.neighbourhoods?.join(', ') },
    { label: 'Budget',            value: prefs.budget?.max ? `Up to €${prefs.budget.max.toLocaleString()} / mo` : prefs.budget?.min ? `From €${prefs.budget.min.toLocaleString()} / mo` : null },
    { label: 'Move-in timeline',  value: prefs.move_in_timeline },
    { label: 'Flat type',         value: prefs.flat_type },
    { label: 'Must-haves',        value: prefs.must_haves?.join(', ') },
    { label: 'Deal-breakers',     value: prefs.deal_breakers?.join(', ') },
  ].filter((f) => f.value)

  return (
    <Section title="Your profile">
      <div className="flex flex-col gap-3">
        {fields.map(({ label, value }) => (
          <div key={label} className="flex justify-between items-baseline gap-4">
            <span className="text-meta shrink-0" style={{ color: 'var(--text-secondary)' }}>{label}</span>
            <span className="text-body font-medium text-right" style={{ color: 'var(--text-primary)' }}>{value}</span>
          </div>
        ))}
      </div>
      <button
        className="self-start text-body font-medium transition-opacity hover:opacity-70"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 0 }}
        onClick={() => {/* TODO: open screening reset or inline edit */}}
      >
        Edit preferences
      </button>
    </Section>
  )
}

/* ── AgentPermissions ────────────────────────────────────────── */

function AgentPermissions({ userId, initialPerms }) {
  const [perms, setPerms] = useState(initialPerms)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const update = useCallback(async (key, value) => {
    const next = { ...perms, [key]: value }
    setPerms(next)
    setSaving(true)
    await saveAgentPermissions(userId, next)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }, [perms, userId])

  const FREQUENCY_OPTIONS = [
    { value: 'on_demand',      label: 'On demand only' },
    { value: 'important_only', label: 'When something important happens' },
    { value: 'daily',          label: 'Daily briefing' },
  ]

  return (
    <Section title="Agent permissions">
      {saved && (
        <p className="text-meta" style={{ color: 'var(--success)' }}>Saved</p>
      )}

      <FieldRow label="Contact landlords autonomously" sub="Agent reaches out to listed landlords on your behalf">
        <Toggle checked={perms.can_contact_landlords} onChange={(v) => update('can_contact_landlords', v)} />
      </FieldRow>

      <FieldRow label="Initiate flatmate introductions" sub="Agent can introduce you to compatible flatmate candidates">
        <Toggle checked={perms.can_initiate_introductions} onChange={(v) => update('can_initiate_introductions', v)} />
      </FieldRow>

      <FieldRow label={`Auto-reject below score ${perms.auto_reject_below_score}`} sub="Matches below this threshold are dismissed without asking you">
        <input
          type="range"
          min={0}
          max={100}
          value={perms.auto_reject_below_score}
          onChange={(e) => update('auto_reject_below_score', Number(e.target.value))}
          className="w-28"
          style={{ accentColor: 'var(--accent)' }}
        />
      </FieldRow>

      <FieldRow label="Maximum commute" sub={`${perms.max_commute_minutes} minutes`}>
        <input
          type="range"
          min={5}
          max={120}
          value={perms.max_commute_minutes}
          onChange={(e) => update('max_commute_minutes', Number(e.target.value))}
          className="w-28"
          style={{ accentColor: 'var(--accent)' }}
        />
      </FieldRow>

      <FieldRow label="Maximum budget" sub="Hard ceiling — agent will not consider listings above this">
        <input
          type="number"
          value={perms.max_budget ?? ''}
          onChange={(e) => update('max_budget', e.target.value ? Number(e.target.value) : null)}
          placeholder="No limit"
          className="w-28 px-3 py-1.5 rounded-btn text-body outline-none"
          style={{
            background: 'var(--background)', border: '1px solid rgba(0,0,0,0.08)',
            color: 'var(--text-primary)',
          }}
        />
      </FieldRow>

      {saving && <p className="text-meta" style={{ color: 'var(--text-secondary)' }}>Saving…</p>}
    </Section>
  )
}

/* ── PreferenceLearningLog ───────────────────────────────────── */

function PreferenceLearningLog({ log, onLogUpdate }) {
  async function handleAccept(id) {
    await acceptPreferenceUpdate(id)
    onLogUpdate((prev) =>
      prev.map((e) => (e.id === id ? { ...e, accepted_by_user: true } : e))
    )
  }

  async function handleDismiss(id) {
    await dismissPreferenceUpdate(id)
    onLogUpdate((prev) => prev.filter((e) => e.id !== id))
  }

  if (log.length === 0) {
    return (
      <Section title="How your agent has learned">
        <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
          Your agent hasn't updated your preferences yet. As you review matches, it will learn what you're really looking for.
        </p>
      </Section>
    )
  }

  return (
    <Section title="How your agent has learned">
      <div className="flex flex-col gap-4">
        {log.map((entry) => {
          const isHigh = entry.confidence === 'high'
          const isPending = entry.accepted_by_user === false
          return (
            <div key={entry.id} className="flex gap-3">
              {/* Timeline dot: green = applied, amber = pending */}
              <div
                className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                style={{ background: isHigh ? 'var(--success)' : 'var(--warning, #f59e0b)' }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-body" style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                  {entry.agent_explanation}
                </p>
                <p className="mt-0.5" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {new Date(entry.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  {isPending && ' · Pending your approval'}
                </p>
                {isPending && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleAccept(entry.id)}
                      className="px-3 py-1 rounded-btn text-meta font-medium transition-opacity hover:opacity-80"
                      style={{
                        background: 'var(--accent)',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDismiss(entry.id)}
                      className="px-3 py-1 rounded-btn text-meta transition-opacity hover:opacity-70"
                      style={{
                        background: 'var(--background)',
                        color: 'var(--text-secondary)',
                        border: '1px solid rgba(0,0,0,0.08)',
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

/* ── VoiceAgentControls ──────────────────────────────────────── */

function VoiceAgentControls({ userId, initialPerms, onUpdate }) {
  const FREQUENCY_OPTIONS = [
    { value: 'on_demand',      label: 'On demand only' },
    { value: 'important_only', label: 'When something important happens' },
    { value: 'daily',          label: 'Daily briefing' },
  ]

  return (
    <Section title="Voice agent">
      <FieldRow label="Voice briefings" sub="Agent can speak summaries using your device's audio">
        <Toggle
          checked={initialPerms.voice_briefings_enabled}
          onChange={(v) => onUpdate('voice_briefings_enabled', v)}
        />
      </FieldRow>

      <FieldRow label="Briefing frequency" sub="How often your agent should proactively brief you">
        <div className="relative">
          <select
            value={initialPerms.briefing_frequency}
            onChange={(e) => onUpdate('briefing_frequency', e.target.value)}
            className="text-meta pl-3 pr-6 py-1.5 rounded-btn appearance-none cursor-pointer outline-none"
            style={{
              background: 'var(--background)', border: '1px solid rgba(0,0,0,0.08)',
              color: 'var(--text-secondary)',
            }}
          >
            {FREQUENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </FieldRow>

      <div className="pt-2">
        <button
          className="flex items-center gap-2 text-body font-medium transition-opacity hover:opacity-70"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 0 }}
          onClick={() => {/* TODO: play preview voice sample */}}
        >
          <Mic size={15} /> Preview agent voice
        </button>
      </div>
    </Section>
  )
}

/* ── ScreeningReset ──────────────────────────────────────────── */

function ScreeningReset({ onReset }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <Section title="Restart screening">
      <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
        Your circumstances have changed — new city, new budget, or new situation. Restart the screening conversation and your agent will learn fresh preferences.
      </p>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="self-start flex items-center gap-2 px-4 py-2 rounded-btn text-body font-medium transition-opacity hover:opacity-70"
          style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#ef4444', cursor: 'pointer',
          }}
        >
          <RotateCcw size={14} /> Reset preferences
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <p className="text-body" style={{ color: 'var(--text-secondary)' }}>Are you sure? This clears all current preferences.</p>
          <button
            onClick={onReset}
            className="px-4 py-2 rounded-btn text-body font-semibold"
            style={{ background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            Yes, reset
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="px-4 py-2 rounded-btn text-body"
            style={{ background: 'var(--background)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      )}
    </Section>
  )
}

/* ── Agent Page ──────────────────────────────────────────────── */

export function Agent() {
  const navigate = useNavigate()
  const [userId, setUserId] = useState(null)
  const [prefs, setPrefs] = useState(null)
  const [permissions, setPermissions] = useState(null)
  const [learningLog, setLearningLog] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { navigate('/'); return }
      setUserId(user.id)

      const [savedPrefs, perms, log] = await Promise.all([
        db.getPreferences(user.id),
        getAgentPermissions(user.id),
        getPreferenceLearningLog(user.id),
      ])
      setPrefs(savedPrefs)
      setPermissions(perms)
      setLearningLog(log)
      setLoading(false)
    })
  }, [navigate])

  async function handlePermissionUpdate(key, value) {
    if (!userId || !permissions) return
    const next = { ...permissions, [key]: value }
    setPermissions(next)
    await saveAgentPermissions(userId, next)
  }

  function handleReset() {
    try { localStorage.removeItem('estato_quick_form') } catch {}
    try { localStorage.removeItem('estato_user_profile') } catch {}
    navigate('/screening')
  }

  if (loading) {
    return (
      <div className="px-6 py-8 max-w-2xl mx-auto flex flex-col gap-6">
        {Array.from({ length: 4 }).map((_, i) => <SectionSkeleton key={i} />)}
      </div>
    )
  }

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="text-display font-semibold" style={{ color: 'var(--text-primary)' }}>
        Your agent
      </h1>

      <ProfileSummary prefs={prefs} />

      {permissions && (
        <AgentPermissions userId={userId} initialPerms={permissions} />
      )}

      <PreferenceLearningLog log={learningLog} onLogUpdate={setLearningLog} />

      {permissions && (
        <VoiceAgentControls
          userId={userId}
          initialPerms={permissions}
          onUpdate={handlePermissionUpdate}
        />
      )}

      <ScreeningReset onReset={handleReset} />
    </div>
  )
}
