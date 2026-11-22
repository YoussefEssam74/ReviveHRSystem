import { AlertTriangle, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '../../../lib/utils'
import { alertHref } from './platform-ui'
import { usePlatformAlerts } from '../hooks/usePlatform'

/**
 * Slim "something needs attention" strip for a console page.
 *
 * The queue is derived server-side from live state, so an item disappears the
 * moment its cause is fixed. Pages narrow the queue to the alerts they can act
 * on (`types`) and, on a gym record, to that account (`companyId`).
 */
export function AttentionStrip({
  types,
  companyId,
  limit = 2,
  className,
}: {
  types?: string[]
  companyId?: number
  limit?: number
  className?: string
}) {
  const { t } = useTranslation()
  const alerts = usePlatformAlerts()

  const items = (alerts.data?.items ?? []).filter(
    (alert) => (!types || types.includes(alert.type)) && (companyId === undefined || alert.companyId === companyId),
  )
  if (items.length === 0) return null

  const critical = items.some((alert) => alert.severity === 'critical')
  const shown = items.slice(0, limit)
  const hidden = items.length - shown.length

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2 rounded-[10px] border px-2.5 py-1.5',
        critical ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50',
        className,
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md',
          critical ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600',
        )}
      >
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        {shown.map((alert) => (
          <p key={alert.id} className="text-[11px] leading-snug text-charcoal-700">
            <span className="font-semibold">{alert.title}</span>
            <span className="text-charcoal-500"> — {alert.detail}</span>
            <Link to={alertHref(alert)} className="ms-1 inline-flex items-center font-semibold text-brand-700 hover:underline">
              {alert.actionLabel}
              <ChevronRight className="h-2.5 w-2.5" aria-hidden="true" />
            </Link>
          </p>
        ))}
      </div>
      {hidden > 0 && (
        <Link
          to="/platform/dashboard"
          className="flex-shrink-0 whitespace-nowrap text-[10px] font-semibold text-brand-700 hover:underline"
        >
          {t('+{{count}} more', { count: hidden })}
        </Link>
      )}
    </div>
  )
}
