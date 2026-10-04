import Badge from './Badge'
import type { BadgeTone } from './Badge'
import { PROJECT_STATUS_LABELS } from '../types/project'
import type { ProjectStatus } from '../types/project'

const STATUS_TONES: Record<ProjectStatus, BadgeTone> = {
  PERENCANAAN: 'sky',
  BERJALAN: 'amber',
  SELESAI: 'emerald',
  DIBATALKAN: 'slate',
}

export default function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{PROJECT_STATUS_LABELS[status]}</Badge>
}
