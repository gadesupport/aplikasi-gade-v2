import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import FullPageSpinner from './components/FullPageSpinner'
import PlaceholderPage from './components/PlaceholderPage'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { MENU_ITEMS } from './lib/menu'
import DashboardPage from './pages/DashboardPage'
import LocationDetailPage from './pages/LocationDetailPage'
import LocationFormPage from './pages/LocationFormPage'
import LocationsPage from './pages/LocationsPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import ParcelDetailPage from './pages/ParcelDetailPage'
import ParcelFormPage from './pages/ParcelFormPage'
import ParcelsPage from './pages/ParcelsPage'
import PartyFormPage from './pages/PartyFormPage'
import PartiesPage from './pages/PartiesPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <FullPageSpinner />
  if (user) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <GuestOnly>
                <LoginPage />
              </GuestOnly>
            }
          />

          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="lokasi" element={<LocationsPage />} />
            <Route path="lokasi/baru" element={<LocationFormPage />} />
            <Route path="lokasi/:id" element={<LocationDetailPage />} />
            <Route path="lokasi/:id/edit" element={<LocationFormPage />} />
            <Route path="bidang" element={<ParcelsPage />} />
            <Route path="bidang/baru" element={<ParcelFormPage />} />
            <Route path="bidang/:id" element={<ParcelDetailPage />} />
            <Route path="bidang/:id/edit" element={<ParcelFormPage />} />
            <Route path="pihak" element={<PartiesPage />} />
            <Route path="pihak/baru" element={<PartyFormPage />} />
            <Route path="pihak/:id/edit" element={<PartyFormPage />} />
            {MENU_ITEMS.filter(
              (item) =>
                item.path !== '/lokasi' && item.path !== '/bidang' && item.path !== '/pihak',
            ).map((item) => (
              <Route
                key={item.path}
                path={item.path.slice(1)}
                element={
                  item.path === '/dashboard' ? (
                    <DashboardPage />
                  ) : (
                    <PlaceholderPage title={item.label} description={item.description} />
                  )
                }
              />
            ))}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
