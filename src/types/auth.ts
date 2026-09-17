export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'SURVEYOR' | 'LEGAL'

export interface AuthUser {
  id: string
  email: string
  nama: string
  role: UserRole
}

// Baris tabel public.profiles (lihat supabase/migrations).
export interface Profile {
  id: string
  nama: string
  role: UserRole
  created_at: string
  updated_at: string
}

export interface SignInCredentials {
  email: string
  password: string
}
