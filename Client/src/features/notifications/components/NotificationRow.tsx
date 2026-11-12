import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { formatDateTime } from '../../../lib/format'
import type { NotificationItem } from '../api/notifications.api'

/** Badge tone classes for the API's `color` field (yellow | green | blue | red | purple). */
const TONE_CLASSES: Record<string, string> = {
  yellow: 'bg-amber-50 text-amber-700 ring-amber-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  purple: 'bg-violet-50 text-violet-700 ring-violet-200',
}

export interface NotificationRowProps {
  item: NotificationItem
  /** True while this row's Mark read call is in flight. */
  isMarking: boolean
  onMarkRead: (id: number) => void
}

/** One inbox row — unread rows are emphasized with a dot + heavier title. */
export function NotificationRow({ item, isMarking, onMarkRead }: NotificationRowProps) {
  const { t } = useTranslation()
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <span
          className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${item.read ? 'bg-slate-200' : 'bg-emerald-500'}`}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`${item.read ? 'font-medium text-slate-600' : 'font-semibold text-slate-900'}`}>
              {item.title}
            </p>
            <Badge className={TONE_CLASSES[item.color ?? '']}>{item.category}</Badge>
          </div>
          {item.description && <p className="mt-0.5 text-sm text-slate-600">{item.description}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span>{formatDateTime(item.date)}</span>
            {item.link?.startsWith('/') ? (
              <Link to={item.link} className="font-medium text-emerald-600 hover:text-emerald-700">
                {t('Open →')}
              </Link>
            ) : (
              item.link && <span>{item.link}</span>
            )}
          </div>
        </div>
      </div>

      {!item.read && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 self-start"
          disabled={isMarking}
          onClick={() => onMarkRead(item.id)}
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          {t('Mark read')}
        </Button>
      )}
    </li>
  )
}
