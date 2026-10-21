import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  Calendar,
  CheckCheck,
  ChevronRight,
  ClipboardList,
  FileText,
  Megaphone,
  Settings as SettingsIcon,
  Users,
} from 'lucide-react'
import {
  getNotifications,
  putMarkAllRead,
  putMarkRead,
  type NotificationItem,
  type UnreadCountResponse,
} from '../../notifications/api/notifications.api'
// The shared bell cache lives under ['notifications', …] (see use-notifications).
// The page reads and invalidates that same namespace so the badge, the bell
// dropdown and this list can never diverge on read/unread state.
import { useUnreadCount } from '../../notifications/hooks/use-notifications'
import { EmptyState } from '../../../components/ui/primitives'
import { Button } from '../../../components/ui/button'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { useToast } from '../../../components/ui/toast'
import { describeApiError } from '../../../lib/api-client'
import { timeAgo } from '../../../lib/format'
import { cn } from '../../../lib/utils'

/**
 * Notification links carry mock page ids (events, announcements, recruitment,
 * /schedule …). Only ids with a portal destination navigate the row; the rest
 * are inert and render without a chevron.
 */
const PORTAL_LINKS: Record<string, string> = {
  requests: '/employee/requests',
  '/schedule': '/employee/schedule',
  payroll: '/employee/payroll',
  documents: '/employee/documents',
  evaluations: '/employee/evaluations',
  attendance: '/employee/attendance',
}

const COLOR_CLASSES: Record<string, string> = {
  green: 'bg-brand-100 text-brand-600',
  blue: 'bg-blue-100 text-blue-600',
  yellow: 'bg-yellow-100 text-yellow-600',
  red: 'bg-red-100 text-red-600',
  purple: 'bg-purple-100 text-purple-600',
}

const CATEGORY_ICONS: Record<string, typeof Bell> = {
  Requests: ClipboardList,
  Recruitment: Users,
  Document: FileText,
  Announcements: Megaphone,
  System: SettingsIcon,
  Attendance: Calendar,
}

function categoryIcon(category: string) {
  return CATEGORY_ICONS[category] ?? Bell
}

const PAGE_SIZE = 20
const FILTERS = ['All', 'Requests', 'Document', 'Recruitment', 'Announcements'] as const

export default function NotificationsPage() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [category, setCategory] = useState<string | null>(null)
  const [onlyUnread, setOnlyUnread] = useState(false)
  const [page, setPage] = useState(1)

  // Same cached unread-count the bell badge uses — one value, one namespace.
  const unreadQuery = useUnreadCount()
  const listQuery = useQuery({
    queryKey: ['notifications', 'list', { category: category ?? null, unread: onlyUnread, page }],
    queryFn: ({ signal }) =>
      getNotifications({
        category: category ?? undefined,
        unread: onlyUnread || undefined,
        page,
        pageSize: PAGE_SIZE,
        signal,
      }),
  })

  const markOne = useMutation({
    mutationFn: (id: number) => putMarkRead(id),
    onSuccess: () => {
      // The bell badge stays truthy between refetches: decrement it locally.
      queryClient.setQueryData<UnreadCountResponse>(['notifications', 'unread-count'], (previous) =>
        previous && previous.count > 0 ? { count: previous.count - 1 } : previous,
      )
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  const markAll = useMutation({
    mutationFn: () => putMarkAllRead(),
    onSuccess: async () => {
      toast('All notifications marked as read')
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  function openNotification(notification: NotificationItem) {
    if (!notification.read && !markOne.isPending) markOne.mutate(notification.id)
    const destination = notification.link ? PORTAL_LINKS[notification.link] : undefined
    if (destination) navigate(destination)
  }

  const unread = unreadQuery.data?.count ?? 0
  const items = listQuery.data?.items ?? []
  const total = listQuery.data?.total ?? 0
  const totalPages = listQuery.data?.totalPages ?? 1

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-charcoal-900">Notifications</h1>
          <p className="mt-0.5 text-[11px] text-charcoal-500">{unread} unread</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => markAll.mutate()} loading={markAll.isPending} disabled={unread === 0}>
          <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Mark All Read
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((filter) => {
          const active = filter === 'All' ? category == null && !onlyUnread : category === filter
          return (
            <button
              key={filter}
              type="button"
              onClick={() => {
                setCategory(filter === 'All' ? null : filter)
                setOnlyUnread(false)
                setPage(1)
              }}
              className={cn(
                'rounded-full px-3 py-1 text-[11px] font-semibold transition-colors',
                active ? 'bg-charcoal-800 text-white' : 'bg-charcoal-100 text-charcoal-600 hover:bg-charcoal-200',
              )}
            >
              {filter}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => {
            setOnlyUnread((current) => !current)
            setPage(1)
          }}
          className={cn(
            'rounded-full px-3 py-1 text-[11px] font-semibold transition-colors',
            onlyUnread ? 'bg-brand-600 text-white' : 'bg-charcoal-100 text-charcoal-600 hover:bg-charcoal-200',
          )}
        >
          Unread
        </button>
      </div>

      {/* List */}
      {listQuery.isLoading ? (
        <LoadingState label="Loading notifications…" />
      ) : listQuery.isError ? (
        <ErrorState message={describeApiError(listQuery.error)} onRetry={() => listQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={onlyUnread ? 'No unread notifications' : 'No notifications'}
          hint="Requests, announcements and schedule updates show up here."
        />
      ) : (
        <div className="space-y-1">
          {items.map((notification) => {
            const Icon = categoryIcon(notification.category)
            const navigates = Boolean(notification.link && PORTAL_LINKS[notification.link])
            return (
              <div
                key={notification.id}
                role="button"
                tabIndex={0}
                onClick={() => openNotification(notification)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') openNotification(notification)
                }}
                className={cn(
                  'card card-interactive transition-all',
                  !notification.read && 'border-brand-200 bg-brand-50/30',
                )}
              >
                <div className="flex items-start gap-2.5 p-2">
                  <div
                    className={cn(
                      'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
                      COLOR_CLASSES[notification.color] ?? 'bg-charcoal-100 text-charcoal-600',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className={cn('truncate text-xs font-semibold text-charcoal-900', notification.read && 'font-medium')}>
                        {notification.title}
                      </p>
                      {!notification.read && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-brand-500" />}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-charcoal-600">{notification.description}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-charcoal-50 px-2 py-0.5 text-[9px] font-medium text-charcoal-600">
                        {notification.category}
                      </span>
                      <span className="text-[10px] text-charcoal-400" title={notification.date}>
                        {timeAgo(notification.date)}
                      </span>
                    </div>
                  </div>
                  {navigates ? (
                    <ChevronRight className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-charcoal-400" aria-hidden="true" />
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-[10px] text-charcoal-400">
            {total} notification{total === 1 ? '' : 's'}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
              Previous
            </Button>
            <span className="text-[11px] font-semibold text-charcoal-600">
              {page} / {totalPages}
            </span>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
