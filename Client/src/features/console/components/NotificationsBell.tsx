import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { getNotifications, getUnreadCount, putReadAll } from '../api/console.api'
import { EmptyState } from '../../../components/ui/empty-state'
import { formatDate } from '../../../lib/format'

/** Header notifications bell with unread badge and a recent-items dropdown. */
export function NotificationsBell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: ({ signal }) => getUnreadCount(signal),
    refetchInterval: 60_000,
  })

  const { data: recent, isFetching } = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: ({ signal }) => getNotifications({ pageSize: 6 }, signal),
    enabled: open,
  })

  const count = unread?.count ?? 0

  const onMarkAll = async () => {
    await putReadAll()
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={count > 0 ? t('Notifications ({{count}} unread)', { count }) : t('Notifications')}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {count > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            className="absolute end-0 z-40 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-bold text-slate-900">{t('Notifications')}</p>
              <button
                type="button"
                onClick={onMarkAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {t('Mark all read')}
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {isFetching && !recent ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden="true" />
                </div>
              ) : (recent?.items?.length ?? 0) === 0 ? (
                <EmptyState title={t('No notifications')} message={t("You're all caught up.")} />
              ) : (
                recent!.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      navigate('/console/notifications')
                    }}
                    className={`block w-full border-b border-slate-50 px-4 py-3 text-start transition-colors last:border-0 hover:bg-slate-50 ${
                      item.read ? 'opacity-70' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!item.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />}
                      <div className={item.read ? 'ps-4' : ''}>
                        <p className="text-sm font-medium text-slate-900">{item.title}</p>
                        {item.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.description}</p>}
                        <p className="mt-1 text-xs text-slate-400">{formatDate(item.date)}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="border-t border-slate-100 px-4 py-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  navigate('/console/notifications')
                }}
                className="w-full rounded-lg py-1.5 text-center text-sm font-medium text-emerald-600 hover:bg-emerald-50"
              >
                {t('View all')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
