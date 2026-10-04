import Badge from './Badge'
import type { BadgeTone } from './Badge'
import { HANDOVER_TYPE_LABELS } from '../types/handover'
import type { HandoverType } from '../types/handover'

const TYPE_TONES: Record<HandoverType, BadgeTone> = {
  BERKAS_MASUK: 'sky',
  BERKAS_KELUAR: 'orange',
  BERKAS_KEMBALI: 'emerald',
}

export default function HandoverTypeBadge({ type }: { type: HandoverType }) {
  return <Badge tone={TYPE_TONES[type]}>{HANDOVER_TYPE_LABELS[type]}</Badge>
}
