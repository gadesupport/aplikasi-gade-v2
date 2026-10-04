import Badge from './Badge'
import type { BadgeTone } from './Badge'
import { ARCHIVE_RELATION_LABELS, ARCHIVE_STATUS_LABELS } from '../types/archive'
import type { ArchiveRelationType, ArchiveStatus } from '../types/archive'

const STATUS_TONES: Record<ArchiveStatus, BadgeTone> = {
  TERSEDIA: 'emerald',
  DIPINJAM: 'amber',
  HILANG: 'red',
  RUSAK: 'orange',
  DIARSIPKAN: 'slate',
}

export function ArchiveStatusBadge({ status }: { status: ArchiveStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{ARCHIVE_STATUS_LABELS[status]}</Badge>
}

const RELATION_TONES: Record<ArchiveRelationType, BadgeTone> = {
  LOCATION: 'sky',
  PARCEL: 'violet',
  PROJECT: 'indigo',
  GENERAL: 'slate',
}

export function ArchiveRelationBadge({ type }: { type: ArchiveRelationType }) {
  return <Badge tone={RELATION_TONES[type]}>{ARCHIVE_RELATION_LABELS[type]}</Badge>
}
