import { useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useOverlay } from '../../lib/use-overlay'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  /** Tailwind max-width override (default max-w-lg). */
  className?: string
}

/**
 * Modal dialog: bottom sheet on phones, centered card from sm up. The body
 * scrolls inside the panel and the page behind stays locked. Closes on Escape,
 * backdrop click, and the header ✕.
 */
export function Dialog({ open, onClose, title, description, children, footer, className }: DialogProps) {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)
  useOverlay(open, onClose, panelRef)

  if (!open) return null

  // Callers that pass their own max-width keep it; `sm:max-w-lg` is only the default.
  const widthClass = className?.includes('max-w-') ? className : cn('sm:max-w-lg', className)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          // Capped to the viewport with a pinned footer: a tall form (e.g. Create
          // Account with the face camera) scrolls its body instead of pushing the
          // action buttons off-screen.
          'overlay-panel safe-bottom relative z-10 flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl outline-none sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl',
          widthClass,
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close')}
            className="touch-target -me-1 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">{children}</div>
        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-100 bg-white px-4 py-3 sm:px-6 sm:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
