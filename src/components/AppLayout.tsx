import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import { MENU_ITEMS } from '../lib/menu'
import { usePermissions } from '../hooks/usePermissions'

export default function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { can } = usePermissions()
  const location = useLocation()

  // Route guard view: cocokkan path saat ini dengan menu (termasuk sub-route).
  const menuItem = MENU_ITEMS.find(
    (item) => location.pathname === item.path || location.pathname.startsWith(item.path + '/'),
  )
  const allowed = !menuItem || can('view', menuItem.path)

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex min-h-screen flex-col lg:pl-64">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-8">
          {allowed ? (
            <Outlet />
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Anda tidak memiliki izin mengakses menu ini. Hubungi SUPERADMIN bila memerlukan
              akses.
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
