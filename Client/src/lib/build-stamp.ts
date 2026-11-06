/**
 * Dev-only tab-age marker: the moment THIS bundle instance was evaluated.
 * Stamped once per page load, so two tabs opened from the same reload share a
 * stamp, and a tab that missed Vite's hot-reload keeps an old one. DEV ONLY —
 * a long-lived dev tab running stale JavaScript is invisible otherwise, and
 * stale client code is exactly how "old-gym snap-back" gets reported against a
 * fixed backend.
 */
export const BUILD_STAMP = import.meta.env.DEV
  ? new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  : ''
