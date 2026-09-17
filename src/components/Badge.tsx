import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export type BadgeTone =
  | 'sky'
  | 'amber'
  | 'orange'
  | 'emerald'
  | 'red'
  | 'slate'
  | 'violet'
  | 'indigo'
  | 'teal'

const TONES: Record<BadgeTone, string> = {
  sky: 'bg-sky-100 text-sky-700',
  amber: 'bg-amber-100 text-amber-700',
  orange: 'bg-orange-100 text-orange-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-700',
  slate: 'bg-slate-200 text-slate-600',
  violet: 'bg-violet-100 text-violet-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  teal: 'bg-teal-100 text-teal-700',
}

export default function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONES[tone],
      )}
    >
      {children}
    </span>
  )
}
