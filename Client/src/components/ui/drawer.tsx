import { useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useOverlay } from '../../lib/use-overlay'

/** Right-side detail drawer (attendance day detail, request detail). */
export function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLElement>(null)
  useOverlay(open, onClose, panelRef)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="drawer-enter safe-bottom absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-white shadow-xl outline-none"
      >
        <header className="flex items-center justify-between gap-3 border-b border-charcoal-100 px-4 py-3">
          <h2 className="truncate text-sm font-semibold text-charcoal-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="touch-target -mr-1 rounded-lg p-1.5 text-charcoal-400 hover:bg-charcoal-100 hover:text-charcoal-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
      </aside>
    </div>
  )
}
