import { useState, useCallback } from 'react'

/* ── Shared landing / dashboard palette ──────────────────────────
   The same two palettes used by the landing page and the /dashboard.
   Clicking the dog logo cycles between them and persists to the
   shared localStorage key, so every surface that opts into this
   theme (dashboard, screening, …) stays in sync.
   ──────────────────────────────────────────────────────────── */

export const THEMES = {
  light: { id: 'light', bg: '#FFFFFF', ink: '#000000', logoBg: '#C94A3D' },
  terracotta: { id: 'terracotta', bg: '#C94A3D', ink: '#111111', logoBg: '#FFFFFF' },
}

export const THEME_ORDER = ['light', 'terracotta']

/* Brand warm/red pair used for selected & primary accents. */
export const CREME = '#F5EDD8'
export const RED = '#C94A3D'

/* Selected/primary fill + text for accents (chips, buttons, bubbles).
   On the white theme it fills red with creme text; on the terracotta
   (red) theme it fills creme with red text. Both read on a white
   surface, which is where these accents sit in the screening flow. */
export function selectedColors(theme) {
  const isTerracotta = theme?.id === 'terracotta'
  return {
    bg: isTerracotta ? CREME : RED,
    fg: isTerracotta ? RED : CREME,
  }
}

const STORAGE_KEY = 'estato:landingTheme'

/* Tint of the theme's ink colour at a given alpha — used for the
   subtle fills, hairline borders and secondary text that keep the
   look monochrome and flat across both palettes. */
export function inkTint(theme, alpha) {
  const hex = (theme?.ink || '#000000').replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/* Map the active theme onto the app's CSS custom properties. Setting
   these on a container re-themes any descendant that styles itself
   with var(--background) / var(--text-primary) / … (e.g. the listing
   detail panel) without having to thread props through it. */
export function buildThemeVars(theme) {
  return {
    '--background': theme.bg,
    '--surface': inkTint(theme, 0.05),
    '--surface-raised': inkTint(theme, 0.09),
    '--text-primary': theme.ink,
    '--text-secondary': inkTint(theme, 0.55),
    '--accent': theme.ink,
    '--accent-muted': inkTint(theme, 0.1),
    '--success': theme.ink,
  }
}

/* The single source of truth for the active theme. Seeds from
   localStorage and writes back on every cycle. */
export function useLandingTheme() {
  const [themeId, setThemeId] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || 'light' } catch { return 'light' }
  })

  const cycle = useCallback(() => {
    setThemeId((curr) => {
      const idx = THEME_ORDER.indexOf(curr)
      const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length]
      try { localStorage.setItem(STORAGE_KEY, next) } catch {}
      return next
    })
  }, [])

  const theme = THEMES[themeId] || THEMES.light
  return { theme, themeId, cycle }
}
