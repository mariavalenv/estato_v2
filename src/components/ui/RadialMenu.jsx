// RadialMenu — viewport-anchored bloom navigation.
//
// Six tab "blobs" radiate outward from the central orb. Each tab is a small
// PinkBlob (canvas) with an SVG icon floating on top. Hover proximity drives
// both menu open/close and per-tab visibility:
//
//   * The menu opens when the cursor enters within ~2.2 × the orb radius.
//   * Each tab's opacity is a function of cursor distance: full <160px,
//     fading 160-240px, hidden beyond 240px.
//   * The menu closes 220ms after the cursor leaves both the orb area and
//     all per-tab proximity zones (grace period prevents flicker).
//
// Tabs are position: fixed and measured against the viewport, so they stay
// anchored to the orb regardless of scroll.

import { useEffect, useRef, useState } from 'react'
import { PinkBlob, useCurrentColor } from './PinkBlob'

/* ── Tab config ─────────────────────────────────────────────────── */

// Angles in degrees, math convention (0 = right, 90 = down).
//   chats     -90  → top
//   houses    -30  → upper right
//   flatmates  30  → lower right
//   agent      90  → bottom
//   activity  150  → lower left
//   profile   210  → upper left
const TABS = [
  { id: 'chats',     angle: -90, label: 'Chats' },
  { id: 'houses',    angle: -30, label: 'Houses' },
  { id: 'flatmates', angle:  30, label: 'Flatmates' },
  { id: 'agent',     angle:  90, label: 'Agent' },
  { id: 'activity',  angle: 150, label: 'Activity' },
  { id: 'profile',   angle: 210, label: 'Profile' },
]

// Sub-tab geometry — each entry projects OUTWARD from its parent
// tab. `offsetAngle` is added to the parent's radial angle to give
// the direction of projection from the parent's centre, and
// SUB_OFFSET_RADIUS is the distance. Two subs per parent at ±35°
// flank the outward direction so they read as globules splitting
// off the parent rather than orbiting the central orb.
const SUB_TABS = {
  chats: [
    { id: 'flatmates', label: 'Flatmates', icon: 'users',    offsetAngle: -35 },
    { id: 'landlords', label: 'Landlords', icon: 'building', offsetAngle:  35 },
  ],
  houses: [
    { id: 'favourites', label: 'Favorites', icon: 'heart',   offsetAngle:  35 },
    { id: 'explore',    label: 'Explore',   icon: 'compass', offsetAngle: -35 },
  ],
  flatmates: [
    { id: 'favourites', label: 'Favorites', icon: 'heart',   offsetAngle: -35 },
    { id: 'new',        label: 'New',       icon: 'sparkle', offsetAngle:  35 },
  ],
}

/* ── SVG icons (float on top of each tab blob) ─────────────────── */

const ICON_PROPS = {
  width: 20, height: 20, viewBox: '0 0 18 18',
  fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
  strokeLinecap: 'round', strokeLinejoin: 'round',
}

function ChatsIcon()    { return (<svg {...ICON_PROPS}><path d="M15 3H3a1 1 0 00-1 1v8a1 1 0 001 1h4l2 2 2-2h4a1 1 0 001-1V4a1 1 0 00-1-1z" /></svg>) }
function HousesIcon()   { return (<svg {...ICON_PROPS}><path d="M2 8L9 2l7 6" /><path d="M4 7v8h4v-4h2v4h4V7" /></svg>) }
function FlatmatesIcon(){ return (<svg {...ICON_PROPS}><circle cx="7" cy="6" r="2.5" /><path d="M2 16c0-2.76 2.24-5 5-5s5 2.24 5 5" /><circle cx="13" cy="6" r="2" opacity=".5" /><path d="M13 11c1.66.35 3 1.84 3 3.5" opacity=".5" /></svg>) }
function AgentIcon()    { return (<svg {...ICON_PROPS}><path d="M9 2v2M9 14v2M2 9h2M14 9h2" /><path d="M4.22 4.22l1.42 1.42M12.36 12.36l1.42 1.42M4.22 13.78l1.42-1.42M12.36 5.64l1.42-1.42" /><circle cx="9" cy="9" r="2.5" /></svg>) }
function ActivityIcon() { return (<svg {...ICON_PROPS}><polyline points="2,12 5,8 8,10 11,5 14,8 16,6" /><line x1="2" y1="15" x2="16" y2="15" opacity=".3" /></svg>) }
function ProfileIcon()  { return (<svg {...ICON_PROPS}><circle cx="9" cy="6.5" r="3" /><path d="M2.5 17c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5" /></svg>) }

const ICONS = {
  chats: ChatsIcon, houses: HousesIcon, flatmates: FlatmatesIcon,
  agent: AgentIcon, activity: ActivityIcon, profile: ProfileIcon,
}

/* ── Sub-tab icons ─────────────────────────────────────────────── */

const SUB_ICON_PROPS = {
  width: 14, height: 14, viewBox: '0 0 16 16',
  fill: 'none', stroke: 'currentColor', strokeWidth: 1.5,
  strokeLinecap: 'round', strokeLinejoin: 'round',
}

function HeartIcon()    { return (<svg {...SUB_ICON_PROPS}><path d="M8 13.5S2 9.5 2 5.8C2 3.7 3.7 2 5.5 2 6.8 2 7.6 2.7 8 3.2 8.4 2.7 9.2 2 10.5 2 12.3 2 14 3.7 14 5.8 14 9.5 8 13.5 8 13.5z" /></svg>) }
function CompassIcon()  { return (<svg {...SUB_ICON_PROPS}><circle cx="8" cy="8" r="6" /><polygon points="10.5,5.5 6.5,6.5 5.5,10.5 9.5,9.5" fill="currentColor" stroke="none" opacity=".7" /></svg>) }
function SparkleIcon()  { return (<svg {...SUB_ICON_PROPS}><path d="M8 2l1.5 4.5L14 8l-4.5 1.5L8 14l-1.5-4.5L2 8l4.5-1.5z" /></svg>) }
function UsersIcon()    { return (<svg {...SUB_ICON_PROPS}><circle cx="6" cy="5.5" r="2" /><path d="M2 14c0-2.2 1.8-4 4-4s4 1.8 4 4" /><circle cx="11" cy="5.5" r="1.6" opacity=".6" /></svg>) }
function BuildingIcon() { return (<svg {...SUB_ICON_PROPS}><rect x="3" y="2" width="10" height="12" rx="0.5" /><line x1="6" y1="5" x2="6" y2="5.01" /><line x1="10" y1="5" x2="10" y2="5.01" /><line x1="6" y1="8" x2="6" y2="8.01" /><line x1="10" y1="8" x2="10" y2="8.01" /><rect x="6.5" y="11" width="3" height="3" /></svg>) }

const SUB_ICONS = {
  heart: HeartIcon, compass: CompassIcon, sparkle: SparkleIcon,
  users: UsersIcon, building: BuildingIcon,
}

/* ── Constants from the spec ────────────────────────────────────── */

const TAB_SIZE = 100
const SUB_TAB_SIZE = 100
const SUB_OFFSET_RADIUS = 140 // distance from parent tab centre to each sub-blob
const REVEAL_FULL = 180     // px — full opacity below this distance
const REVEAL_FADE = 260     // px — invisible above this
const CLOSE_GRACE_MS = 220  // grace period before closing on cursor exit
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

/* ── Burst ring (one-shot animation on menu open) ──────────────── */

function ensureBurstKeyframes() {
  if (typeof document === 'undefined') return
  if (document.getElementById('estato-burst-kf')) return
  const style = document.createElement('style')
  style.id = 'estato-burst-kf'
  style.textContent = `
    @keyframes estatoBurst {
      0%   { transform: translate(-50%, -50%) scale(0.68); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(2.30); opacity: 0; }
    }
    @keyframes estatoSubPop {
      0%   { transform: translateX(-50%) translateY(8px) scale(0.6); opacity: 0; }
      100% { transform: translateX(-50%) translateY(0)   scale(1);   opacity: 1; }
    }
  `
  document.head.appendChild(style)
}

/* ── RadialMenu ─────────────────────────────────────────────────── */

export function RadialMenu({
  orbRef,             // ref to the orb DOM element (for viewport anchoring)
  orbSize = 200,      // rendered orb diameter in px
  open,               // controlled by parent
  onOpenChange,       // called when proximity-hover toggles open
  activeTab,          // currently selected main tab
  onTabSelect,        // (tabId) => void
  onSubTabSelect,     // (tabId, subId) => void
  onDismiss,          // called when user clicks outside any tab/sub-tab while a tab is active
}) {
  const [orbCenter, setOrbCenter] = useState({ x: 0, y: 0 })
  const [opacities, setOpacities] = useState(() => TABS.map(() => 0))
  const [showBurst, setShowBurst] = useState(false)
  const cursorRef = useRef({ x: -9999, y: -9999 })
  const closeTimerRef = useRef(null)
  const openRef = useRef(open)
  useEffect(() => { openRef.current = open }, [open])

  useEffect(() => { ensureBurstKeyframes() }, [])

  // Orbit radius — bumped from the spec's `size * 0.72 + 18` to give
  // the larger 72 px tab blobs more breathing room around the central
  // orb. This still scales with orb size for future-proofing.
  const radius = orbSize * 0.95 + 24
  // Open trigger zone — slightly wider than the spec's 2.2 × orb radius
  // to compensate for the bigger orbit, so cursor activation still
  // feels intuitive when approaching the orb.
  const triggerR = orbSize * 1.25

  // Tab positions in viewport coords, recalculated on every frame.
  const tabPositions = TABS.map((t) => {
    const rad = (t.angle * Math.PI) / 180
    return {
      x: orbCenter.x + Math.cos(rad) * radius,
      y: orbCenter.y + Math.sin(rad) * radius,
    }
  })

  // Single rAF loop drives:
  //   1. Reading the orb's viewport rect (handles scroll/resize for free).
  //   2. Computing each tab's opacity from cursor distance.
  //   3. Triggering open/close with the 220ms grace period.
  useEffect(() => {
    let raf
    function onMove(e) {
      cursorRef.current = { x: e.clientX, y: e.clientY }
    }

    function loop() {
      const orbEl = orbRef?.current
      if (orbEl) {
        const rect = orbEl.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2

        const cursor = cursorRef.current
        const dxOrb = cursor.x - cx
        const dyOrb = cursor.y - cy
        const distToOrb = Math.sqrt(dxOrb * dxOrb + dyOrb * dyOrb)
        const inOrbZone = distToOrb < triggerR

        // Compute per-tab opacity from distance to that tab's viewport pos.
        const newOpacities = TABS.map((t) => {
          const rad = (t.angle * Math.PI) / 180
          const tx = cx + Math.cos(rad) * radius
          const ty = cy + Math.sin(rad) * radius
          const dx = cursor.x - tx
          const dy = cursor.y - ty
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d <= REVEAL_FULL) return 1
          if (d >= REVEAL_FADE) return 0
          return 1 - (d - REVEAL_FULL) / (REVEAL_FADE - REVEAL_FULL)
        })

        const anyTabHovered = newOpacities.some((o) => o > 0)

        // Open/close gating with 220ms grace.
        if (inOrbZone || anyTabHovered) {
          if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current)
            closeTimerRef.current = null
          }
          if (!openRef.current) onOpenChange?.(true)
        } else if (openRef.current && !closeTimerRef.current) {
          closeTimerRef.current = setTimeout(() => {
            onOpenChange?.(false)
            closeTimerRef.current = null
          }, CLOSE_GRACE_MS)
        }

        // Push state only when something changed enough to matter — keeps
        // React idle when the cursor isn't moving.
        setOrbCenter((prev) => (prev.x === cx && prev.y === cy ? prev : { x: cx, y: cy }))
        setOpacities((prev) => {
          let same = true
          for (let i = 0; i < prev.length; i++) {
            if (Math.abs(prev[i] - newOpacities[i]) > 0.01) { same = false; break }
          }
          return same ? prev : newOpacities
        })
      }
      raf = requestAnimationFrame(loop)
    }

    document.addEventListener('pointermove', onMove)
    raf = requestAnimationFrame(loop)
    return () => {
      document.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
    }
  }, [orbRef, orbSize, onOpenChange, radius, triggerR])

  // Click-outside dismiss — when a tab is active, any pointerdown that
  // lands outside an active tab / sub-tab element clears the selection
  // so the user falls back to "just the orb". Proximity-hover then
  // re-reveals tabs the moment the cursor wanders over them again.
  useEffect(() => {
    if (!activeTab) return
    function onDown(e) {
      const t = e.target
      if (t && typeof t.closest === 'function' && t.closest('[data-radial-tab]')) return
      onDismiss?.()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [activeTab, onDismiss])

  // Burst ring — one-shot when the menu transitions closed → open.
  useEffect(() => {
    if (!open) return
    setShowBurst(true)
    const t = setTimeout(() => setShowBurst(false), 550)
    return () => clearTimeout(t)
  }, [open])

  // Live palette colour — drives status dot, halo tint, and the burst ring.
  const color = useCurrentColor()
  const colorRgb = `rgb(${color[0]},${color[1]},${color[2]})`

  return (
    <>
      {/* Burst ring — fixed, centred on orb */}
      {showBurst && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            left: orbCenter.x,
            top: orbCenter.y,
            width: orbSize,
            height: orbSize,
            borderRadius: '50%',
            border: `1px solid ${colorRgb}`,
            pointerEvents: 'none',
            zIndex: 60,
            animation: 'estatoBurst 550ms ease-out forwards',
            transformOrigin: '50% 50%',
          }}
        />
      )}

      {/* Main tab blobs */}
      {TABS.map((tab, i) => {
        const pos = tabPositions[i]
        const Icon = ICONS[tab.id]
        const isActive = activeTab === tab.id
        // Visibility rules:
        //  - Active tab is always visible (full opacity), regardless
        //    of proximity or whether the menu is "open".
        //  - When some other tab is active, every other tab is hidden
        //    so the user can focus on their selection.
        //  - Otherwise (no active tab) fall back to proximity reveal,
        //    with inactive tabs at 72% intensity per spec.
        let op
        if (isActive) {
          op = 1
        } else if (activeTab) {
          op = 0
        } else {
          op = open ? opacities[i] * 0.72 : 0
        }

        const tabSize = tab.size || TAB_SIZE
        return (
          <div
            key={tab.id}
            data-radial-tab
            style={{
              position: 'fixed',
              left: pos.x - tabSize / 2,
              top: pos.y - tabSize / 2,
              width: tabSize,
              height: tabSize,
              opacity: op,
              pointerEvents: op > 0.25 ? 'auto' : 'none',
              transition: 'opacity 180ms ease',
              zIndex: 50,
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation()
              onTabSelect?.(tab.id)
            }}
          >
            {/* The blob itself — phase offset per tab (i × 1.1) so each
                morphs out of phase with the others while sharing the
                same palette. */}
            <PinkBlob size={tabSize} phase={i * 1.1} state={isActive ? 'speaking' : 'idle'} />

            {/* Icon floating on top */}
            <div
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.95)',
                pointerEvents: 'none',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))',
              }}
            >
              <Icon />
            </div>

            {/* Label */}
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginTop: 6,
                fontSize: 9,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#6E6660',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              {tab.label}
            </div>
          </div>
        )
      })}

      {/* Sub-blobs — siblings that project OUTWARD from each parent
          tab. Each sub gets viewport-fixed coords computed from its
          parent's tab position + (offsetAngle, SUB_OFFSET_RADIUS),
          so the two children appear to bud off the parent away from
          the central orb rather than sitting on the main orbit ring.
          Visibility is gated on activeTab — sub-blobs only appear
          after the user explicitly clicks the parent tab. */}
      {TABS.map((tab, i) => {
        const subs = SUB_TABS[tab.id]
        if (!subs) return null

        const parentPos = tabPositions[i]
        const isActiveParent = activeTab === tab.id
        // Sub-blobs render whenever the parent is the active tab,
        // independent of proximity-hover open state. They stay until
        // the user dismisses the parent or selects a different one.
        const subBaseOpacity = isActiveParent ? 1 : 0

        return subs.map((sub, si) => {
          const subRad = ((tab.angle + sub.offsetAngle) * Math.PI) / 180
          const sx = parentPos.x + Math.cos(subRad) * SUB_OFFSET_RADIUS
          const sy = parentPos.y + Math.sin(subRad) * SUB_OFFSET_RADIUS
          const SubIcon = SUB_ICONS[sub.icon]
          const op = subBaseOpacity

          return (
            <div
              key={`${tab.id}-${sub.id}`}
              data-radial-tab
              style={{
                position: 'fixed',
                left: sx - SUB_TAB_SIZE / 2,
                top: sy - SUB_TAB_SIZE / 2,
                width: SUB_TAB_SIZE,
                height: SUB_TAB_SIZE,
                opacity: op,
                pointerEvents: op > 0.25 ? 'auto' : 'none',
                // Stagger the spring slightly per child so they don't
                // pop in lockstep (50ms feels organic, not mechanical).
                transition: `opacity 220ms ease ${si * 50}ms`,
                zIndex: 49,
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation()
                onSubTabSelect?.(tab.id, sub.id)
              }}
            >
              {/* Sub-blob — own phase offset so sibling globules
                  morph independently of the parent and each other. */}
              <PinkBlob size={SUB_TAB_SIZE} phase={i * 1.1 + (si + 1) * 0.7} />

              {/* Sub icon */}
              <div
                style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.95)',
                  pointerEvents: 'none',
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))',
                }}
              >
                {SubIcon && <SubIcon />}
              </div>

              {/* Sub label */}
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginTop: 4,
                  fontSize: 8,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: '#6E6660',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {sub.label}
              </div>
            </div>
          )
        })
      })}
    </>
  )
}
