import Badge from './Badge'
import type { BadgeTone } from './Badge'
import { DISCUSSION_DECISION_LABELS } from '../types/discussion'
import type { DiscussionDecision } from '../types/discussion'

const DECISION_TONES: Record<DiscussionDecision, BadgeTone> = {
  LAYAK: 'emerald',
  PERLU_KAJIAN: 'amber',
  TIDAK_LAYAK: 'red',
}

export default function DecisionBadge({ decision }: { decision: DiscussionDecision }) {
  return <Badge tone={DECISION_TONES[decision]}>{DISCUSSION_DECISION_LABELS[decision]}</Badge>
}
