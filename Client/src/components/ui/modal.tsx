import { useTranslation } from 'react-i18next'
import { useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useOverlay } from '../../lib/use-overlay'
import { Button } from './button'

export interface ModalProps {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  /** Md = max-w-md, Wide = max-w-2xl, Full = max-w-3xl (mock's {wide, full} options). */
  width?: 'md' | 'wide' | 'full'
  footer?: ReactNode
  children: ReactNode
}

/** Mock modal shell: backdrop + white rounded card with scale-in animation. */
export function Modal({ open, title, subtitle, onClose, width = 'md', footer, children }: ModalProps) {
  const { t } = useTranslation()
  const backdropRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  useOverlay(open, onClose, panelRef)

  if (!open) return null

  const maxWidth = width === 'full' ? 'max-w-3xl' : width === 'wide' ? 'max-w-2xl' : 'max-w-md'

  return (
    <div
      ref={backdropRef}
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === backdropRef.current) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'modal-content overlay-panel safe-bottom flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl outline-none',
          maxWidth,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-charcoal-100 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-charcoal-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[11px] text-charcoal-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="touch-target -me-1 rounded-lg p-1.5 text-charcoal-400 hover:bg-charcoal-100 hover:text-charcoal-700"
            aria-label={t('Close')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-charcoal-100 px-4 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel ?? t('Cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel ?? t('Confirm')}
          </Button>
        </>
      }
    >
      <div className="text-sm text-charcoal-700">{message}</div>
    </Modal>
  )
}
