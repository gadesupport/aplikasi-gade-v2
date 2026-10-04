import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './useAuth'
import { permissionService, defaultPermission, permissionKey } from '../services/permissionService'
import type { PermissionAction, RolePermissionRow } from '../services/permissionService'
import type { UserRole } from '../types/auth'

// Context akses role × menu (menu Pengaturan).
// can() dipakai sidebar, route guard, dan tombol CRUD.
// SUPERADMIN selalu mendapat akses penuh.

interface PermissionContextValue {
  can: (action: PermissionAction, menuPath: string) => boolean
  getRow: (role: UserRole, menuPath: string) => RolePermissionRow | null
  reload: () => void
  rows: RolePermissionRow[]
}

const PermissionContext = createContext<PermissionContextValue | null>(null)

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [rows, setRows] = useState<RolePermissionRow[]>([])
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    let active = true
    permissionService
      .list()
      .then((data) => {
        if (active) setRows(data)
      })
      .catch(() => {
        // Gagal memuat → fallback ke defaultPermission.
        if (active) setRows([])
      })
    return () => {
      active = false
    }
  }, [reloadCount, user?.role])

  const value = useMemo<PermissionContextValue>(
    () => ({
      rows,
      reload: () => setReloadCount((count) => count + 1),
      getRow: (role: UserRole, menuPath: string) =>
        rows.find((row) => row.role === role && row.menu_path === menuPath) ?? null,
      can: (action: PermissionAction, menuPath: string) => {
        if (!user) return false
        if (user.role === 'SUPERADMIN') return true
        const row = rows.find(
          (candidate) => candidate.role === user.role && candidate.menu_path === menuPath,
        )
        if (row) {
          const key = ('can_' + action) as 'can_view' | 'can_create' | 'can_update' | 'can_delete'
          return row[key]
        }
        return defaultPermission(user.role, menuPath, action)
      },
    }),
    [user, rows],
  )

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>
}

export function usePermissions(): PermissionContextValue {
  const context = useContext(PermissionContext)
  if (!context) {
    throw new Error('usePermissions harus dipakai di dalam PermissionProvider.')
  }
  return context
}

export { permissionKey }
