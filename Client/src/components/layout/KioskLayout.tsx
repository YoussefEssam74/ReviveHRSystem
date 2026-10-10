import { Outlet } from 'react-router-dom'

/**
 * Standalone shell for the public attendance station (kiosk). Deliberately not
 * wrapped in AppLayout: a kiosk is a shared terminal with no web user signed in,
 * so it must never show navigation, a sign-in button, or a sign-out button. The
 * station itself authenticates with the session cookie it redeems from a 6-digit
 * enrollment code. The layout is only a viewport-fitting frame (exactly one
 * screen tall, no scroll, light surface like the mock) - the kiosk page owns
 * the header and the whole screen from there down.
 */
export function KioskLayout() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50 text-charcoal-800 antialiased">
      <Outlet />
    </div>
  )
}
