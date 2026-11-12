import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../../lib/utils'
import type { MockToast, ToastTone } from '../hooks/useMockToast'

const toneBody: Record<ToastTone, string> = {
  success: 'border-brand-200 bg-brand-50 text-brand-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
}

const toneIcon: Record<ToastTone, string> = {
  success: 'text-green-500',
  error: 'text-red-500',
  info: 'text-blue-500',
  warning: 'text-amber-500',
}

function Icon({ tone }: { tone: ToastTone }) {
  if (tone === 'success') return <IconCheck />
  if (tone === 'info') return <IconInfo />
  return <IconAlert />
}

/** Bottom-right toast stack per Mock UI/HR core.js showToast. */
export function DashboardToasts({ toasts, onDismiss }: { toasts: MockToast[]; onDismiss: (id: number) => void }) {
  const { t } = useTranslation()
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none fixed bottom-4 end-4 z-[60] flex w-full max-w-xs flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((item) => (
        <div
          key={item.id}
          className={cn(
            'pointer-events-auto flex max-w-xs items-start gap-2 rounded-lg border px-3 py-2 shadow-lg toast-enter',
            toneBody[item.tone],
          )}
        >
          <span className={cn('mt-0.5 flex-shrink-0', toneIcon[item.tone])}>
            <Icon tone={item.tone} />
          </span>
          <p className="flex-1 text-xs font-medium">{item.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(item.id)}
            className="flex-shrink-0 opacity-60 transition-opacity hover:opacity-100"
            aria-label={t('Dismiss notification')}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}

function IconCheck() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function IconAlert() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function IconInfo() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
