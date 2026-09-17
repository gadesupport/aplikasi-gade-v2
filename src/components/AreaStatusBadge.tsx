import Badge from './Badge'
import type { BadgeTone } from './Badge'
import { AREA_STATUS_LABELS } from '../types/areaStats'
import type { AreaStatus } from '../types/areaStats'

const STATUS_TONES: Record<AreaStatus, BadgeTone> = {
  TERPETAK_PENUH: 'emerald',
  BELUM_PENUH: 'amber',
  OVERLAP: 'red',
  GEOMETRY_INVALID: 'violet',
}

export default function AreaStatusBadge({ status }: { status: AreaStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{AREA_STATUS_LABELS[status]}</Badge>
}
