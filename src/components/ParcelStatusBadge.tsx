import Badge from './Badge'
import type { BadgeTone } from './Badge'
import { PARCEL_STATUS_LABELS } from '../types/parcel'
import type { ParcelStatus } from '../types/parcel'

const STATUS_TONES: Record<ParcelStatus, BadgeTone> = {
  TERIDENTIFIKASI: 'teal',
  SURVEY: 'sky',
  LEGAL_CHECK: 'violet',
  NEGOSIASI: 'amber',
  SIAP_TRANSAKSI: 'indigo',
  TRANSAKSI: 'orange',
  SELESAI: 'emerald',
  DITOLAK: 'red',
  DITUNDA: 'slate',
}

export default function ParcelStatusBadge({ status }: { status: ParcelStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{PARCEL_STATUS_LABELS[status]}</Badge>
}
