import { createContext, useContext, useState, useMemo } from 'react'

const AssistantContext = createContext({ open: false, setOpen: () => {} })

export function AssistantProvider({ children }) {
  const [open, setOpen] = useState(false)
  const value = useMemo(() => ({ open, setOpen }), [open])
  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  )
}

export function useAssistant() {
  return useContext(AssistantContext)
}
