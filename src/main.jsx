import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'

import { DensityProvider } from './contexts/DensityContext'
import { AssistantProvider } from './contexts/AssistantContext'
import { AppLayout } from './components/layout/AppLayout'

// Lazy-load all page components for code splitting
const Landing = lazy(() => import('./pages/Landing').then(m => ({ default: m.Landing })))
const Onboarding = lazy(() => import('./pages/Onboarding').then(m => ({ default: m.Onboarding })))
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })))
const Account = lazy(() => import('./pages/Account').then(m => ({ default: m.Account })))
const Approve = lazy(() => import('./pages/Approve').then(m => ({ default: m.Approve })))
const Chat = lazy(() => import('./pages/Chat').then(m => ({ default: m.Chat })))
const Screening = lazy(() => import('./pages/Screening').then(m => ({ default: m.Screening })))
const Matches = lazy(() => import('./pages/Matches').then(m => ({ default: m.Matches })))
const Chats = lazy(() => import('./pages/Chats').then(m => ({ default: m.Chats })))
const Agent = lazy(() => import('./pages/Agent').then(m => ({ default: m.Agent })))
const Activity = lazy(() => import('./pages/Activity').then(m => ({ default: m.Activity })))
const Review = lazy(() => import('./pages/Review').then(m => ({ default: m.Review })))
const HousemateHunt = lazy(() => import('./pages/HousemateHunt').then(m => ({ default: m.HousemateHunt })))

function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        {/* Onboarding — standalone, light surface */}
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Chat, Approve & Review — standalone (full-screen, no sidebar) */}
        <Route path="/approve/:id" element={<Approve />} />
        <Route path="/chat/:matchId" element={<Chat />} />
        <Route path="/review" element={<Review />} />
        <Route path="/housemates" element={<HousemateHunt />} />
        <Route path="/screening" element={<Screening />} />

        {/* Dashboard — standalone, full-screen (no sidebar) */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/account"   element={<AppLayout><Account /></AppLayout>} />
        <Route path="/matches"   element={<AppLayout><Matches /></AppLayout>} />
        <Route path="/chats"               element={<AppLayout><Chats /></AppLayout>} />
        <Route path="/chats/:conversationId" element={<AppLayout><Chats /></AppLayout>} />
        <Route path="/agent"     element={<AppLayout><Agent /></AppLayout>} />
        <Route path="/activity"  element={<AppLayout><Activity /></AppLayout>} />

        {/* Landing / root */}
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <DensityProvider>
        <AssistantProvider>
          <AppRoutes />
        </AssistantProvider>
      </DensityProvider>
    </BrowserRouter>
  </StrictMode>
)
