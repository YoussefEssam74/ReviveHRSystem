import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '../../lib/utils'

type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
  leaving: boolean
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const KIND_STYLES: Record<ToastKind, { border: string; icon: typeof Info }> = {
  success: { border: 'border-l-green-500', icon: CheckCircle2 },
  error: { border: 'border-l-red-500', icon: AlertCircle },
  info: { border: 'border-l-blue-500', icon: Info },
}

const ICON_COLOR: Record<ToastKind, string> = {
  success: 'text-green-600',
  error: 'text-red-600',
  info: 'text-blue-600',
}

/** Portal toasts: top-right stack, auto-dismiss, mock's slide-in/out animation. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    window.setTimeout(() => setItems((current) => current.filter((t) => t.id !== id)), 320)
  }, [])

  const toast = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      const id = nextId.current++
      setItems((current) => [...current.slice(-4), { id, kind, message, leaving: false }])
      window.setTimeout(() => dismiss(id), 4200)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" role="status" aria-live="polite">
        {items.map(({ id, kind, message, leaving }) => {
          const style = KIND_STYLES[kind]
          const Icon = style.icon
          return (
            <div
              key={id}
              className={cn(
                'pointer-events-auto flex items-start gap-2.5 rounded-xl border border-charcoal-200 border-l-4 bg-white p-3 shadow-lg',
                style.border,
                leaving ? 'toast-exit' : 'toast-enter',
              )}
            >
              <Icon className={cn('mt-0.5 h-4 w-4 flex-shrink-0', ICON_COLOR[kind])} aria-hidden="true" />
              <p className="flex-1 text-xs text-charcoal-800">{message}</p>
              <button
                type="button"
                onClick={() => dismiss(id)}
                className="rounded p-0.5 text-charcoal-400 hover:bg-charcoal-100 hover:text-charcoal-700"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}
