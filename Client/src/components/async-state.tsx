import { useTranslation } from 'react-i18next'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from './ui/button'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={'animate-spin ' + (className ?? 'h-4 w-4')} aria-hidden="true" />
}

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation()
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-24 text-slate-500">
      <Spinner className="h-8 w-8" />
      <p className="text-sm">{t(label ?? 'Loading…')}</p>
    </div>
  )
}

export interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="mx-auto my-12 max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
      <AlertCircle className="mx-auto h-8 w-8 text-red-500" aria-hidden="true" />
      {/* red-800 (not red-900): the pastel bg flips dark in dark mode and only
          the 600/700/800 text levels flip with it — red-900 would stay dark
          and disappear against it. */}
      <h2 className="mt-3 text-base font-semibold text-red-800">{t(title ?? 'Something went wrong')}</h2>
      <p className="mt-1 text-sm text-red-700">{t(message)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          {t('Try again')}
        </Button>
      )}
    </div>
  )
}
