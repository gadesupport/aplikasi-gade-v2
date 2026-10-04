import type { ReactNode } from 'react'
import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AcquisitionsPage from './pages/AcquisitionsPage'
import AppLayout from './components/AppLayout'
import ArchiveDetailPage from './pages/ArchiveDetailPage'
import ArchiveFormPage from './pages/ArchiveFormPage'
import ArchivesPage from './pages/ArchivesPage'
import AuditLogPage from './pages/AuditLogPage'
import LegalityFormPage from './pages/LegalityFormPage'
import LegalitiesPage from './pages/LegalitiesPage'
import DiscussionDetailPage from './pages/DiscussionDetailPage'
import DiscussionFormPage from './pages/DiscussionFormPage'
import DiscussionsPage from './pages/DiscussionsPage'
import HandoversPage from './pages/HandoversPage'
import FullPageSpinner from './components/FullPageSpinner'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { PermissionProvider } from './hooks/usePermissions'
import SettingsPage from './pages/SettingsPage'
import DashboardPage from './pages/DashboardPage'
import LocationDetailPage from './pages/LocationDetailPage'
import LocationFormPage from './pages/LocationFormPage'
import LocationsPage from './pages/LocationsPage'
import LoginPage from './pages/LoginPage'
import MapPage from './pages/MapPage'
import NotFoundPage from './pages/NotFoundPage'
import ParcelDetailPage from './pages/ParcelDetailPage'
import ParcelFormPage from './pages/ParcelFormPage'
import ParcelsPage from './pages/ParcelsPage'
import ReportsPage from './pages/ReportsPage'
import PartyFormPage from './pages/PartyFormPage'
import PartiesPage from './pages/PartiesPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import ProjectFormPage from './pages/ProjectFormPage'
import ProjectsPage from './pages/ProjectsPage'
import SurveyDetailPage from './pages/SurveyDetailPage'
import SurveyFormPage from './pages/SurveyFormPage'
import SurveysPage from './pages/SurveysPage'

// Halaman impor/ekspor GIS membawa parser/penulis berat — dimuat lazy.
const GISImportPage = lazy(() => import('./pages/GISImportPage'))
const GISExportPage = lazy(() => import('./pages/GISExportPage'))

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
        <PermissionProvider>
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
            <Route path="peta" element={<MapPage />} />
            <Route
              path="peta/impor"
              element={
                <Suspense fallback={<FullPageSpinner />}>
                  <GISImportPage />
                </Suspense>
              }
            />
            <Route
              path="peta/ekspor"
              element={
                <Suspense fallback={<FullPageSpinner />}>
                  <GISExportPage />
                </Suspense>
              }
            />
            <Route path="survey" element={<SurveysPage />} />
            <Route path="survey/baru" element={<SurveyFormPage />} />
            <Route path="survey/:id" element={<SurveyDetailPage />} />
            <Route path="survey/:id/edit" element={<SurveyFormPage />} />
            <Route path="laporan" element={<ReportsPage />} />
            <Route path="legalitas" element={<LegalitiesPage />} />
            <Route path="legalitas/baru" element={<LegalityFormPage />} />
            <Route path="legalitas/:id/edit" element={<LegalityFormPage />} />
            <Route path="pembahasan" element={<DiscussionsPage />} />
            <Route path="pembahasan/baru" element={<DiscussionFormPage />} />
            <Route path="pembahasan/:id" element={<DiscussionDetailPage />} />
            <Route path="pembahasan/:id/edit" element={<DiscussionFormPage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
            <Route path="pembebasan" element={<AcquisitionsPage />} />
            <Route path="project" element={<ProjectsPage />} />
            <Route path="project/baru" element={<ProjectFormPage />} />
            <Route path="project/:id" element={<ProjectDetailPage />} />
            <Route path="project/:id/edit" element={<ProjectFormPage />} />
            <Route path="arsip" element={<ArchivesPage />} />
            <Route path="arsip/baru" element={<ArchiveFormPage />} />
            <Route path="arsip/:id" element={<ArchiveDetailPage />} />
            <Route path="arsip/:id/edit" element={<ArchiveFormPage />} />
            <Route path="serah-terima" element={<HandoversPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="pengaturan" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
        </PermissionProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
