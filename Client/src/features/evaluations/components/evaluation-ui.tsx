import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../../lib/utils'

/* ==================== shared atoms (Mock UI/HR pages-evaluations.js) ==================== */

/** Small caps section heading with an optional count pill. */
export function SectionLabel({ count, children }: { count?: number; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <p className="bento-label text-charcoal-500">{children}</p>
      {count != null && <span className="badge badge-brand text-[9px]">{count}</span>}
    </div>
  )
}

/** Dashed "nothing here" panel used by every section. */
export function EmptyPanel({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-xl border border-dashed border-charcoal-300 bg-white p-8 text-center">
      <p className="text-sm font-semibold text-charcoal-700">{title}</p>
      <p className="mt-1 text-xs text-charcoal-500">{hint}</p>
    </div>
  )
}

/** Initials avatar matching the mock's brand-tinted circles. */
export function InitialsAvatar({ name, tone = 'brand' }: { name: string; tone?: 'brand' | 'blue' }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span
      className={cn(
        'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
        tone === 'blue' ? 'bg-blue-100 text-blue-600' : 'bg-brand-100 text-brand-700',
      )}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  )
}

/** Small "Target · branch" meta fragment shared by the cards. */
export function FormMetaLine({
  questions,
  position,
  gym,
  created,
}: {
  questions: number
  position: string | null
  gym: string
  created?: string
}) {
  const { t } = useTranslation()
  return (
    <p className="mt-0.5 text-[10px] text-charcoal-500">
      {questions === 1 ? t('1 question') : t('{{count}} questions', { count: questions })} · {t('Target:')}{' '}
      <span className="font-medium text-charcoal-700">{position && position !== 'All' ? position : t('All Staff')}</span>{' '}
      · {gym === 'All' ? t('All branches') : gym}
      {created ? ` · ${t('Created {{date}}', { date: created })}` : ''}
    </p>
  )
}
