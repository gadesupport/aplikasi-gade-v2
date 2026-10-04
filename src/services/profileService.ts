import { supabase } from '../lib/supabase'
import { auditService } from './auditService'
import { requireSupabase, unwrapQuery } from './query'
import type { Profile, UserRole } from '../types/auth'

const COLUMNS = 'id, nama, role, created_at, updated_at'

const ROLES: UserRole[] = ['SUPERADMIN', 'ADMIN', 'SURVEYOR', 'LEGAL']

function normalizeRole(value: string): UserRole {
  return ROLES.includes(value as UserRole) ? (value as UserRole) : 'ADMIN'
}

// Profil & manajemen pengguna (menu Pengaturan).
// RLS profiles: update baris sendiri; ubah role/baris lain hanya SUPERADMIN.
export const profileService = {
  async getMyProfile(): Promise<Profile | null> {
    requireSupabase()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return null
    return unwrapQuery<Profile>(
      supabase.from('profiles').select(COLUMNS).eq('id', userData.user.id).maybeSingle(),
    )
  },

  // Ubah nama sendiri (RLS profiles_update_own).
  async updateMyProfile(nama: string): Promise<Profile> {
    requireSupabase()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      throw new Error('Sesi tidak ditemukan. Silakan login ulang.')
    }
    const namaTrimmed = nama.trim()
    if (!namaTrimmed) {
      throw new Error('Nama wajib diisi.')
    }
    const row = await unwrapQuery<Profile>(
      supabase
        .from('profiles')
        .update({ nama: namaTrimmed })
        .eq('id', userData.user.id)
        .select(COLUMNS)
        .single(),
    )
    if (!row) throw new Error('Gagal menyimpan profil.')
    auditService.log('UPDATE', 'PROFILE', row.id, row.nama)
    return row
  },

  // Daftar semua profil — hanya terlihat bermakna untuk SUPERADMIN
  // (mengelola role); user lain tetap bisa membaca nama/role (RLS select).
  async listProfiles(): Promise<Profile[]> {
    requireSupabase()
    return (
      (await unwrapQuery<Profile[]>(
        supabase.from('profiles').select(COLUMNS).order('nama', { ascending: true }).limit(500),
      )) ?? []
    )
  },

  // Ubah role pengguna — hanya SUPERADMIN (RLS + guard trigger database).
  async updateRole(id: string, role: UserRole): Promise<Profile> {
    requireSupabase()
    if (!ROLES.includes(role)) {
      throw new Error('Role tidak dikenal.')
    }
    const row = await unwrapQuery<Profile>(
      supabase
        .from('profiles')
        .update({ role: normalizeRole(role) })
        .eq('id', id)
        .select(COLUMNS)
        .single(),
    )
    if (!row) throw new Error('Profil tidak ditemukan.')
    auditService.log('UPDATE', 'PROFILE', row.id, row.nama)
    auditService.log('STATUS_CHANGE', 'PROFILE', row.id, row.nama + ' -> ' + row.role)
    return row
  },
}
