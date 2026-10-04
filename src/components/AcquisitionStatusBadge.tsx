import Badge from './Badge'
import type { BadgeTone } from './Badge'
import { ACQUISITION_STATUS_LABELS } from '../types/acquisition'
import type { AcquisitionStatus } from '../types/acquisition'

const STATUS_TONES: Record<AcquisitionStatus, BadgeTone> = {
  NEGOSIASI: 'amber',
  SIAP_TRANSAKSI: 'indigo',
  TRANSAKSI: 'orange',
  SELESAI: 'emerald',
  BATAL: 'slate',
}

export default function AcquisitionStatusBadge({ status }: { status: AcquisitionStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{ACQUISITION_STATUS_LABELS[status]}</Badge>
}
