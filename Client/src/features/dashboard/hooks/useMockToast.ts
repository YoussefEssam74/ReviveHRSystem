import { useCallback, useRef, useState } from 'react'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export interface MockToast {
  id: number
  message: string
  tone: ToastTone
}

/**
 * Mock-core `showToast` equivalent: stacked bottom-right toasts (styled in
 * DashboardToasts.tsx) shared by the dashboard page and its dialogs.
 */
export function useMockToast() {
  const [toasts, setToasts] = useState<MockToast[]>([])
  const nextId = useRef(1)

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId.current++
    setToasts((prev) => [...prev.slice(-4), { id, message, tone }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, 4200)
  }, [])

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  return { toasts, toast, remove }
}
