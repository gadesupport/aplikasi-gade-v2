import { LEGALITY_DOC_TYPES } from '../types/legality'
import type { LegalityDocType, LegalityRecord, LegalityStatus } from '../types/legality'

// Urutan prioritas agregasi status per jenis dokumen pada checklist:
// dokumen "Ada" menang, lalu yang butuh perhatian, lalu tidak relevan.
const STATUS_PRIORITY: LegalityStatus[] = [
  'ADA',
  'PERLU_VERIFIKASI',
  'PROSES',
  'TIDAK_RELEVAN',
  'BELUM_ADA',
]

export interface LegalityChecklistItem {
  jenis: LegalityDocType
  status: LegalityStatus
  rows: LegalityRecord[]
}

export interface LegalityChecklist {
  items: LegalityChecklistItem[]
  adaCount: number
  total: number
  // Jumlah jenis yang ditandai Tidak Relevan (dikecualikan dari penyebut).
  tidakRelevanCount: number
  // Persentase = Ada ÷ (total − Tidak Relevan) × 100.
  percentage: number
}

// Checklist legalitas satu bidang: satu item per jenis dokumen standar.
// Bila satu jenis punya beberapa baris (mis. KTP dua ahli waris), status
// item mengikuti baris terbaik sesuai STATUS_PRIORITY.
export function summarizeLegalityChecklist(rows: LegalityRecord[]): LegalityChecklist {
  const items: LegalityChecklistItem[] = LEGALITY_DOC_TYPES.map((jenis) => {
    const typeRows = rows.filter((row) => row.jenis_dokumen === jenis)
    let status: LegalityStatus = 'BELUM_ADA'
    for (const candidate of STATUS_PRIORITY) {
      if (typeRows.some((row) => row.status === candidate)) {
        status = candidate
        break
      }
    }
    return { jenis, status, rows: typeRows }
  })

  const total = LEGALITY_DOC_TYPES.length
  const adaCount = items.filter((item) => item.status === 'ADA').length
  const tidakRelevanCount = items.filter((item) => item.status === 'TIDAK_RELEVAN').length
  const denominator = total - tidakRelevanCount
  const percentage = denominator === 0 ? 100 : Math.round((adaCount / denominator) * 100)

  return { items, adaCount, total, tidakRelevanCount, percentage }
}
