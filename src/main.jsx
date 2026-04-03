import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'

import { DensityProvider } from './contexts/DensityContext'
import { AppLayout } from './components/layout/AppLayout'
import { Onboarding } from './pages/Onboarding'
import { Dashboard } from './pages/Dashboard'
import { Approve } from './pages/Approve'
import { Chat } from './pages/Chat'

function AppRoutes() {
  return (
    <Routes>
      {/* Onboarding — standalone, light surface */}
      <Route path="/onboarding" element={<Onboarding />} />

      {/* Chat & Approve — standalone (full-screen, no sidebar) */}
      <Route path="/approve/:id" element={<Approve />} />
      <Route path="/chat/:matchId" element={<Chat />} />

      {/* App shell with sidebar nav */}
      <Route
        path="/dashboard"
        element={
          <AppLayout>
            <Dashboard />
          </AppLayout>
        }
      />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/onboarding" replace />} />
      <Route path="*" element={<Navigate to="/onboarding" replace />} />
    </Routes>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <DensityProvider>
        <AppRoutes />
      </DensityProvider>
    </BrowserRouter>
  </StrictMode>
)
