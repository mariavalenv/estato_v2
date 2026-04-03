import { createContext, useContext, useState, useEffect } from 'react'

const DensityContext = createContext(null)

export function DensityProvider({ children }) {
  const [density, setDensityState] = useState(() => {
    try {
      return localStorage.getItem('flatmate-density') || 'standard'
    } catch {
      return 'standard'
    }
  })

  function setDensity(value) {
    setDensityState(value)
    try {
      localStorage.setItem('flatmate-density', value)
    } catch {}
  }

  return (
    <DensityContext.Provider value={{ density, setDensity }}>
      {children}
    </DensityContext.Provider>
  )
}

export function useDensity() {
  const ctx = useContext(DensityContext)
  if (!ctx) throw new Error('useDensity must be used within DensityProvider')
  return ctx
}
