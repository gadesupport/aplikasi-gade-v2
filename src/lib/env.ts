const rawUrl = import.meta.env.VITE_SUPABASE_URL
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const SUPABASE_URL = typeof rawUrl === 'string' ? rawUrl.trim() : ''
export const SUPABASE_ANON_KEY = typeof rawAnonKey === 'string' ? rawAnonKey.trim() : ''

export const isSupabaseConfigured = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0

export function getMissingEnvVars(): string[] {
  const missing: string[] = []
  if (!SUPABASE_URL) missing.push('VITE_SUPABASE_URL')
  if (!SUPABASE_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY')
  return missing
}

// Semua variabel VITE_* ikut terkirim ke browser — hanya anon key yang boleh di sini.
const SECRET_KEY_PATTERNS = ['service_role', 'sb_secret_']

if (isSupabaseConfigured && SECRET_KEY_PATTERNS.some((pattern) => SUPABASE_ANON_KEY.includes(pattern))) {
  console.error(
    '[GadeSystem] VITE_SUPABASE_ANON_KEY berisi service/secret key. Ganti dengan anon key — key ini terkirim ke browser.',
  )
}

if (!isSupabaseConfigured) {
  console.warn(
    `[GadeSystem] Supabase belum dikonfigurasi (${getMissingEnvVars().join(', ')}). Salin .env.example menjadi .env lalu isi nilainya.`,
  )
}
