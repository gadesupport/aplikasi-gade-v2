import type { PostgrestError } from '@supabase/supabase-js'

// Error baku untuk seluruh service layer. UI hanya perlu mengenali ServiceError.
export class ServiceError extends Error {
  readonly code?: string

  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'ServiceError'
    this.code = options?.code
  }
}

export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError
}

function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    'code' in error &&
    'details' in error &&
    'hint' in error
  )
}

// Pesan teknis PostgreSQL/PostgREST → pesan yang bisa dipahami pengguna.
const POSTGREST_ERROR_MESSAGES: Record<string, string> = {
  '23505': 'Data sudah ada (duplikat). Periksa kembali isian Anda.',
  '23503': 'Data terkait tidak ditemukan atau masih dirujuk data lain.',
  '23514': 'Data tidak lolos validasi (mis. polygon self-intersecting). Perbaiki bentuk polygon lalu simpan lagi.',
  '42501': 'Anda tidak memiliki izin untuk aksi ini.',
  PGRST116: 'Data tidak ditemukan atau tidak unik.',
  PGRST301: 'Sesi berakhir. Silakan login kembali.',
}

export function toServiceError(
  error: unknown,
  fallbackMessage = 'Terjadi kesalahan tak terduga. Silakan coba lagi.',
): ServiceError {
  if (isServiceError(error)) return error
  if (isPostgrestError(error)) {
    return new ServiceError(POSTGREST_ERROR_MESSAGES[error.code] ?? error.message, {
      code: error.code,
      cause: error,
    })
  }
  if (error instanceof Error && error.message) {
    return new ServiceError(error.message, { cause: error })
  }
  return new ServiceError(fallbackMessage, { cause: error })
}
