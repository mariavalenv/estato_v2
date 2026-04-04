import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'

import { DensityProvider } from './contexts/DensityContext'
import { AppLayout } from './components/layout/AppLayout'
import { Landing } from './pages/Landing'
import { Onboarding } from './pages/Onboarding'
import { Dashboard } from './pages/Dashboard'
import { Account } from './pages/Account'
import { Approve } from './pages/Approve'
import { Chat } from './pages/Chat'
import { Screening } from './pages/Screening'

function AppRoutes() {
  return (
    <Routes>
      {/* Onboarding — standalone, light surface */}
      <Route path="/onboarding" element={<Onboarding />} />

      {/* Chat, Approve & Screening — standalone (full-screen, no sidebar) */}
      <Route path="/approve/:id" element={<Approve />} />
      <Route path="/chat/:matchId" element={<Chat />} />
      <Route path="/screening" element={<Screening />} />

      {/* App shell with sidebar nav */}
      <Route
        path="/dashboard"
        element={
          <AppLayout>
            <Dashboard />
          </AppLayout>
        }
      />
      <Route
        path="/account"
        element={
          <AppLayout>
            <Account />
          </AppLayout>
        }
      />

      {/* Landing / root */}
      <Route path="/" element={<Landing />} />
      <Route path="*" element={<Navigate to="/" replace />} />
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
