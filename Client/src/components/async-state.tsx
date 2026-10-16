import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from './ui/button'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={'animate-spin ' + (className ?? 'h-4 w-4')} aria-hidden="true" />
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-24 text-slate-500">
      <Spinner className="h-8 w-8" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="mx-auto my-12 max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
      <AlertCircle className="mx-auto h-8 w-8 text-red-500" aria-hidden="true" />
      <h2 className="mt-3 text-base font-semibold text-red-900">{title}</h2>
      <p className="mt-1 text-sm text-red-700">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
