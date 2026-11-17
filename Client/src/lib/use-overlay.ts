import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Shared behaviour for Dialog, Modal and Drawer: lock the page behind the
 * overlay, move focus inside it, keep Tab cycling within it, close on Escape,
 * and return focus to the element that opened it.
 *
 * The effect is keyed on `open` only — callers pass inline `onClose` closures,
 * and re-running on every parent render would steal focus back mid-typing.
 */
export function useOverlay(open: boolean, onClose: () => void, overlayRef: RefObject<HTMLElement | null>) {
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const overlay = overlayRef.current
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const focusable = () =>
      Array.from(overlay?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter(
        (element) => element.offsetWidth > 0 || element.offsetHeight > 0 || element === document.activeElement,
      )

    // One frame, so the panel is painted before its first control is focused.
    // Prefer an explicit autofocus, then the first field (typing target), then
    // any focusable — never jump straight to a Close/destructive button.
    const frame = requestAnimationFrame(() => {
      const target =
        overlay?.querySelector<HTMLElement>('[autofocus]') ??
        overlay?.querySelector<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])',
        ) ??
        focusable()[0] ??
        overlay
      target?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const items = focusable()
      if (items.length === 0) {
        event.preventDefault()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement

      // Focus escaped the panel (or rests on the panel itself): pull it back in.
      if (active === overlay || !overlay?.contains(active)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
        return
      }
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      trigger?.focus()
    }
  }, [open, overlayRef])
}
