import { ServiceError } from './errors'

// Parse angka desimal ≥ 0 dari input form. Input kosong → null.
// Menerima koma atau titik sebagai pemisah desimal.
export function parseNonNegativeDecimal(label: string, raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.')
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ServiceError(`${label} harus berupa angka ≥ 0.`)
  }
  return parsed
}
