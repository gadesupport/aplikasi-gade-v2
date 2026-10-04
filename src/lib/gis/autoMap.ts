import type { GadeField } from '../../types/gisImport'

// Saran mapping otomatis (§24): pencocokan nama source field → GADE field
// dengan normalisasi (huruf besar, tanpa pemisah) + kata kunci.

const RULES: { field: GadeField; any?: string[]; all?: string[] }[] = [
  { field: 'nomor_bidang', any: ['NOBIDANG', 'NOMORBIDANG', 'BIDANGNO', 'PARCELNO', 'NOPOLY'] },
  { field: 'jenis_hak', any: ['JENISHAK', 'HAK', 'LANDRIGHT'] },
  { field: 'nomor_hak', any: ['NOMORHAK', 'NOHAK', 'HAKNO', 'SERTIFIKATNO', 'NOSERT'] },
  { field: 'nama_pihak', all: ['NAMA', 'PEMILIK'] },
  { field: 'nama_pihak', all: ['NAMA', 'PIHAK'] },
  { field: 'nama_pihak', any: ['PEMILIK', 'OWNER'] },
  { field: 'kode', any: ['KODEBIDANG', 'KODEPARCEL'] },
  { field: 'kode', any: ['KODE', 'CODE'] },
  { field: 'luas', any: ['LUAS', 'AREA', 'AREAM2', 'SHAPEAREA', 'HEKTAR'] },
  { field: 'status', any: ['STATUS', 'STATUSPEMBEBASAN'] },
]

// field sumber dinormalisasi: NO_BIDANG → NOBIDANG; "No. Bidang" → NOBIDANG.
export function suggestMapping(sourceFields: string[]): Record<string, GadeField> {
  const mapping: Record<string, GadeField> = {}
  const claimed = new Set<GadeField>()
  for (const raw of sourceFields) {
    const normalized = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
    let assigned: GadeField | null = null
    for (const rule of RULES) {
      if (claimed.has(rule.field)) continue
      const matchesAll = Boolean(rule.all?.length) && (rule.all ?? []).every((keyword) => normalized.includes(keyword))
      const matchesAny = Boolean(rule.any?.length) && (rule.any ?? []).some(
        (keyword) => normalized === keyword || normalized.includes(keyword),
      )
      if (matchesAll || matchesAny) {
        assigned = rule.field
        break
      }
    }
    if (assigned) {
      mapping[raw] = assigned
      claimed.add(assigned)
    }
  }
  return mapping
}
