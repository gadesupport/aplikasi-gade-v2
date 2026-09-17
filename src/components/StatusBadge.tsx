import Badge from './Badge'
import type { BadgeTone } from './Badge'
import { LOCATION_STATUS_LABELS } from '../types/location'
import type { LocationStatus } from '../types/location'

const STATUS_TONES: Record<LocationStatus, BadgeTone> = {
  SURVEY: 'sky',
  PEMBAHASAN: 'amber',
  PROSES_PEMBEBASAN: 'orange',
  SELESAI: 'emerald',
  DITOLAK: 'red',
  DITUNDA: 'slate',
}

export default function StatusBadge({ status }: { status: LocationStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{LOCATION_STATUS_LABELS[status]}</Badge>
}
