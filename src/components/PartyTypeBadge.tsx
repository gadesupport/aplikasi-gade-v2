import Badge from './Badge'
import type { BadgeTone } from './Badge'
import { PARTY_TYPE_LABELS } from '../types/party'
import type { PartyType } from '../types/party'

const TYPE_TONES: Record<PartyType, BadgeTone> = {
  PEMEGANG_HAK: 'teal',
  AHLI_WARIS: 'violet',
  KUASA: 'amber',
  PENGUASA: 'sky',
  PIHAK_LAIN: 'slate',
}

export default function PartyTypeBadge({ type }: { type: PartyType }) {
  return <Badge tone={TYPE_TONES[type]}>{PARTY_TYPE_LABELS[type]}</Badge>
}
