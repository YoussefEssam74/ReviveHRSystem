import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

/** Right-side detail drawer (attendance day detail, request detail). */
export function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="drawer-enter absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-white shadow-xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-charcoal-100 px-4 py-3">
          <h2 className="truncate text-sm font-semibold text-charcoal-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-charcoal-400 hover:bg-charcoal-100 hover:text-charcoal-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </aside>
    </div>
  )
}
