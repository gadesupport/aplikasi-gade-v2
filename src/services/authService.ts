import type { AuthError, User } from '@supabase/supabase-js'
import { ServiceError } from '../lib/errors'
import { isSupabaseConfigured } from '../lib/env'
import { supabase } from '../lib/supabase'
import { auditService } from './auditService'
import { requireSupabase, unwrapQuery } from './query'
import type { AuthUser, Profile, SignInCredentials, UserRole } from '../types/auth'

const ROLES: string[] = ['SUPERADMIN', 'ADMIN', 'SURVEYOR', 'LEGAL']

// Kode error Supabase Auth → pesan yang bisa dipahami pengguna.
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email atau password salah.',
  email_not_confirmed: 'Email belum dikonfirmasi. Periksa inbox Anda.',
  user_banned: 'Akun diblokir. Hubungi administrator.',
  over_request_rate_limit: 'Terlalu banyak percobaan. Coba lagi beberapa saat.',
  network_error: 'Tidak dapat menghubungi server. Periksa koneksi internet.',
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string' && code) return code
  }
  return undefined
}

function toAuthError(error: AuthError): ServiceError {
  const code = getErrorCode(error)
  return new ServiceError((code && AUTH_ERROR_MESSAGES[code]) || error.message, {
    code,
    cause: error,
  })
}

function toRole(value: unknown): UserRole {
  return typeof value === 'string' && ROLES.includes(value) ? (value as UserRole) : 'ADMIN'
}

function mapUser(user: User, profile: Profile | null): AuthUser {
  const metadataNama = user.user_metadata?.['nama']
  return {
    id: user.id,
    email: user.email ?? '',
    nama:
      profile?.nama ||
      (typeof metadataNama === 'string' ? metadataNama : '') ||
      user.email ||
      '',
    role: profile?.role ?? toRole(user.user_metadata?.['role']),
  }
}

// Nama dan role tersimpan di tabel public.profiles (dibuat otomatis
// oleh trigger saat user dibuat — lihat supabase/migrations).
async function fetchProfile(userId: string): Promise<Profile | null> {
  return unwrapQuery<Profile>(
    supabase
      .from('profiles')
      .select('id, nama, role, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle(),
  )
}

// Profil gagal dimuat bukan alasan menolak login — lanjut dengan data metadata.
function loadProfile(user: User): Promise<Profile | null> {
  return fetchProfile(user.id).catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[GadeSystem] Gagal memuat profil pengguna: ${message}`)
    return null
  })
}

// Satu-satunya jalur akses Supabase Auth. UI tidak boleh memanggil supabase langsung.
export const authService = {
  async signIn({ email, password }: SignInCredentials): Promise<AuthUser> {
    requireSupabase()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw toAuthError(error)
    if (!data.user) throw new ServiceError('Login gagal: pengguna tidak ditemukan.')
    auditService.log('LOGIN', 'AUTH', data.user.id, `Login: ${data.user.email}`)
    const profile = await loadProfile(data.user)
    return mapUser(data.user, profile)
  },

  async signOut(): Promise<void> {
    if (!isSupabaseConfigured) return
    auditService.log('LOGOUT', 'AUTH')
    const { error } = await supabase.auth.signOut()
    if (error) throw toAuthError(error)
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    if (!isSupabaseConfigured) return null
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return null
    const profile = await loadProfile(data.user)
    return mapUser(data.user, profile)
  },

  // Berlangganan perubahan status auth (login/logout, token refresh, tab lain).
  // Mengembalikan fungsi unsubscribe.
  onAuthStateChange(onChange: (user: AuthUser | null) => void): () => void {
    if (!isSupabaseConfigured) return () => {}
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user
      if (!user) {
        onChange(null)
        return
      }
      const profile = await loadProfile(user)
      onChange(mapUser(user, profile))
    })
    return () => {
      void data.subscription.unsubscribe()
    }
  },
}
