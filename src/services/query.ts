import type { PostgrestError } from '@supabase/supabase-js'
import { ServiceError, toServiceError } from '../lib/errors'
import { isSupabaseConfigured } from '../lib/env'

// Bentuk hasil baku setiap query Supabase di service layer.
export interface QueryResult<T> {
  data: T | null
  error: PostgrestError | null
}

// Precondition operasi service: Supabase harus sudah dikonfigurasi via .env.
export function requireSupabase(): void {
  if (!isSupabaseConfigured) {
    throw new ServiceError(
      'Supabase belum dikonfigurasi. Salin .env.example menjadi .env lalu isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.',
      { code: 'SUPABASE_NOT_CONFIGURED' },
    )
  }
}

// Fondasi service layer: setiap service membungkus query Supabase lewat
// helper ini agar error konsisten menjadi ServiceError dan tidak menyebar
// ke UI. Contoh: return unwrapQuery(supabase.from('lokasi').select('*'))
export async function unwrapQuery<T>(query: PromiseLike<QueryResult<T>>): Promise<T | null> {
  const { data, error } = await query
  if (error) throw toServiceError(error)
  return data
}

// Untuk query .single() — dijamin mengembalikan tepat satu baris.
export async function unwrapQuerySingle<T>(query: PromiseLike<QueryResult<T>>): Promise<T> {
  const data = await unwrapQuery(query)
  if (data === null) throw new ServiceError('Data tidak ditemukan.', { code: 'PGRST116' })
  return data
}

// Untuk query list dengan count total (pagination).
export async function unwrapQueryWithCount<T>(
  query: PromiseLike<QueryResult<T> & { count?: number | null }>,
): Promise<{ data: T; count: number }> {
  const { data, error, count } = await query
  if (error) throw toServiceError(error)
  return { data: data as T, count: count ?? 0 }
}

// Karakter yang bisa merusak filter .or() PostgREST dibuang dari input pencarian.
export function sanitizeSearchTerm(term: string): string {
  return term.trim().replace(/[%_,()\\]/g, ' ').trim()
}
