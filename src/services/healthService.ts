import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '../lib/env'
import { ServiceError, toServiceError } from '../lib/errors'

export interface ConnectionStatus {
  ok: boolean
  latencyMs: number | null
  message: string
}

async function pingAuthEndpoint(): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_ANON_KEY },
    })
  } catch {
    throw new ServiceError('Tidak dapat menghubungi server Supabase. Periksa koneksi internet.', {
      code: 'NETWORK_ERROR',
    })
  }
  if (!response.ok) {
    throw new ServiceError(`Supabase merespons dengan status ${response.status}.`, {
      code: `HTTP_${response.status}`,
    })
  }
}

// Verifikasi koneksi ke Supabase (endpoint auth /health, hanya anon key).
// Dipakai untuk pengecekan koneksi, mis. di halaman Pengaturan.
export const healthService = {
  async checkConnection(): Promise<ConnectionStatus> {
    if (!isSupabaseConfigured) {
      return {
        ok: false,
        latencyMs: null,
        message: 'Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY pada .env.',
      }
    }
    const startedAt = performance.now()
    try {
      await pingAuthEndpoint()
      return {
        ok: true,
        latencyMs: Math.round(performance.now() - startedAt),
        message: 'Koneksi ke Supabase berhasil.',
      }
    } catch (error) {
      const serviceError = toServiceError(error, 'Tidak dapat menghubungi Supabase.')
      return { ok: false, latencyMs: null, message: serviceError.message }
    }
  },
}
