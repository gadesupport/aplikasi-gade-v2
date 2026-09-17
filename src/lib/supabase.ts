import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './env'

// Konfigurasi dan validasi environment ada di lib/env.ts.
// Placeholder client agar aplikasi tetap boot tanpa .env;
// akses data tetap ditolak oleh service layer saat isSupabaseConfigured === false.
export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? SUPABASE_URL : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? SUPABASE_ANON_KEY : 'placeholder-anon-key',
)
