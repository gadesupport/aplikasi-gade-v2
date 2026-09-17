import Badge from './Badge'
import type { BadgeTone } from './Badge'
import { LEGALITY_STATUS_LABELS } from '../types/legality'
import type { LegalityStatus } from '../types/legality'

const STATUS_TONES: Record<LegalityStatus, BadgeTone> = {
  ADA: 'emerald',
  BELUM_ADA: 'slate',
  PROSES: 'sky',
  TIDAK_RELEVAN: 'slate',
  PERLU_VERIFIKASI: 'amber',
}

export default function LegalityStatusBadge({ status }: { status: LegalityStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{LEGALITY_STATUS_LABELS[status]}</Badge>
}
