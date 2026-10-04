import { supabase } from '../lib/supabase'
import { requireSupabase, unwrapQuery } from './query'
import { toServiceError } from '../lib/errors'
import { auditService } from './auditService'
import type { UserRole } from '../types/auth'

// Matriks akses role × menu (menu Pengaturan) — mengatur menu & tombol CRUD
// di aplikasi; enforcement keamanan terakhir tetap RLS di database.

export interface RolePermissionRow {
  role: UserRole
  menu_path: string
  can_view: boolean
  can_create: boolean
  can_update: boolean
  can_delete: boolean
}

export type PermissionAction = 'view' | 'create' | 'update' | 'delete'

export function permissionKey(role: string, menuPath: string): string {
  return role + '|' + menuPath
}

// Default bila baris belum ada di database (selaras seed migration 000022).
export function defaultPermission(role: UserRole, menuPath: string, action: PermissionAction): boolean {
  const crud = ['/lokasi', '/bidang', '/pihak', '/project', '/survey', '/pembahasan', '/legalitas', '/pembebasan', '/arsip', '/serah-terima']
  switch (role) {
    case 'SUPERADMIN':
      return action === 'view'
        ? true
        : crud.includes(menuPath)
    case 'ADMIN':
      return action === 'view'
        ? menuPath !== '/audit-log'
        : crud.includes(menuPath)
    case 'SURVEYOR':
      if (action === 'view') {
        return !['/legalitas', '/pembebasan', '/project', '/audit-log'].includes(menuPath)
      }
      if (action === 'delete') return ['/survey', '/pembahasan'].includes(menuPath)
      return ['/lokasi', '/bidang', '/survey', '/pembahasan', '/serah-terima'].includes(menuPath)
    case 'LEGAL':
      if (action === 'view') {
        return !['/project', '/pembebasan', '/audit-log', '/serah-terima'].includes(menuPath)
      }
      if (action === 'delete') return menuPath === '/legalitas'
      return ['/legalitas', '/survey', '/arsip'].includes(menuPath)
    default:
      return false
  }
}

export const permissionService = {
  async list(): Promise<RolePermissionRow[]> {
    requireSupabase()
    return (
      (await unwrapQuery<RolePermissionRow[]>(
        supabase
          .from('role_permissions')
          .select('role, menu_path, can_view, can_create, can_update, can_delete')
          .order('role')
          .order('menu_path'),
      )) ?? []
    )
  },

  // Simpan matriks dari menu Pengaturan (hanya SUPERADMIN — RLS).
  // Sanitasi: kirim hanya kolom yang valid agar payload tidak membawa
  // properti liar dari state UI.
  async saveBulk(rows: RolePermissionRow[]): Promise<void> {
    requireSupabase()
    const clean = rows.map((row) => ({
      role: row.role,
      menu_path: row.menu_path,
      can_view: Boolean(row.can_view),
      can_create: Boolean(row.can_create),
      can_update: Boolean(row.can_update),
      can_delete: Boolean(row.can_delete),
    }))
    const { error } = await supabase
      .from('role_permissions')
      .upsert(clean, { onConflict: 'role,menu_path' })
    if (error) throw toServiceError(error)
    auditService.log('UPDATE', 'ROLE_PERMISSIONS', undefined, clean.length + ' baris akses diperbarui')
  },
}
