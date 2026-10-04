import { NavLink } from 'react-router-dom'
import { MENU_GROUP_ORDER, MENU_ITEMS } from '../lib/menu'
import { usePermissions } from '../hooks/usePermissions'
import { cn } from '../lib/cn'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { can } = usePermissions()
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/60 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 text-slate-100 transition-transform duration-200 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-800 px-4">
          <img
            src="/logo-gade.jpg"
            alt="Logo GADE"
            className="h-11 w-11 rounded-lg bg-white object-contain p-0.5"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-wide">GadeSystem</p>
            <p className="truncate text-[11px] text-slate-400">Garda Depan Pertanahan</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            aria-label="Tutup menu"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {MENU_GROUP_ORDER.map((group) => {
            const items = MENU_ITEMS.filter((item) => item.group === group && can('view', item.path))
            if (items.length === 0) return null
            return (
              <div key={group}>
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  {group}
                </p>
                <div className="space-y-1">
                  {items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="shrink-0 border-t border-slate-800 px-5 py-3">
          <p className="text-[11px] text-slate-500">GadeSystem v0.1.0</p>
        </div>
      </aside>
    </>
  )
}
