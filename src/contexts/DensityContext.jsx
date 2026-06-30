import { createContext, useContext, useState, useCallback, useMemo } from 'react'

const DensityContext = createContext(null)

export function DensityProvider({ children }) {
  const [density, setDensityState] = useState(() => {
    try {
      return localStorage.getItem('estato_density') || 'standard'
    } catch {
      return 'standard'
    }
  })

  const setDensity = useCallback((value) => {
    setDensityState(value)
    try {
      localStorage.setItem('estato_density', value)
    } catch {}
  }, [])

  const value = useMemo(() => ({ density, setDensity }), [density, setDensity])

  return (
    <DensityContext.Provider value={value}>
      {children}
    </DensityContext.Provider>
  )
}

export function useDensity() {
  const ctx = useContext(DensityContext)
  if (!ctx) throw new Error('useDensity must be used within DensityProvider')
  return ctx
}
