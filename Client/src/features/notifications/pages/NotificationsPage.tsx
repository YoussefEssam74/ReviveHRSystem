import { useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Select } from '../../../components/ui/select'
import { Tabs, type TabItem } from '../../../components/ui/tabs'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { Pagination } from '../../../components/ui/pagination'
import { NotificationRow } from '../components/NotificationRow'
import { AnnouncementsPanel } from '../components/AnnouncementsPanel'
import { NOTIFICATION_CATEGORIES } from '../api/notifications.api'
import { useMarkAllRead, useMarkRead, useNotifications, useUnreadCount } from '../hooks/useNotifications'
import { describeApiError } from '../../../lib/api-client'

/** The page's two sections (mock: "Notifications & Announcements"). */
type Section = 'notifications' | 'announcements'
/** Inbox filters inside the Notifications section. */
type InboxTab = 'all' | 'unread'

/**
 * Notifications & Announcements (S5.7) — the signed-in user's own notifications
 * plus the company announcement history. Composing announcements needs
 * announcements.manage (hidden otherwise); everything else is self-service.
 */
export default function NotificationsPage() {
  const [section, setSection] = useState<Section>('notifications')
  const [tab, setTab] = useState<InboxTab>('all')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, isLoading, error } = useNotifications({
    unread: tab === 'unread' || undefined,
    category: category || undefined,
    page,
    pageSize: 20,
  })
  const { data: unread } = useUnreadCount()
  const markAll = useMarkAllRead()
  const markRead = useMarkRead()

  const unreadCount = unread?.count ?? 0
  const sectionTabs: TabItem<Section>[] = [
    { value: 'notifications', label: 'Notifications', count: unreadCount > 0 ? unreadCount : undefined },
    { value: 'announcements', label: 'Announcements' },
  ]
  const inboxTabs: TabItem<InboxTab>[] = [
    { value: 'all', label: 'All' },
    { value: 'unread', label: 'Unread', count: unreadCount > 0 ? unreadCount : undefined },
  ]

  const onSection = (value: Section) => {
    setSection(value)
    setActionError(null)
  }
  const onTab = (value: InboxTab) => {
    setTab(value)
    setPage(1)
  }
  const onCategory = (value: string) => {
    setCategory(value)
    setPage(1)
  }

  const onMarkAll = async () => {
    setActionError(null)
    try {
      await markAll.mutateAsync()
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  const onMarkRead = async (id: number) => {
    setActionError(null)
    try {
      await markRead.mutateAsync(id)
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  return (
    <div>
      <PageHeader
        title="Notifications & Announcements"
        description={
          section === 'notifications'
            ? unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}.`
              : 'You are all caught up.'
            : 'System notifications and company announcements.'
        }
        actions={
          section === 'notifications' ? (
            <Button variant="outline" onClick={onMarkAll} loading={markAll.isPending} disabled={unreadCount === 0}>
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs items={sectionTabs} value={section} onChange={onSection} className="w-fit" />
        {section === 'notifications' && (
          <div className="flex flex-wrap items-center gap-3">
            <Tabs items={inboxTabs} value={tab} onChange={onTab} className="w-fit" />
            <Select
              value={category}
              onChange={(e) => onCategory(e.target.value)}
              className="sm:w-56"
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {NOTIFICATION_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {section === 'announcements' ? (
        <AnnouncementsPanel />
      ) : (
        <Card>
          {isLoading ? (
            <LoadingState label="Loading notifications…" />
          ) : error ? (
            <ErrorState message={describeApiError(error)} />
          ) : (data?.items?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Bell}
              title={tab === 'unread' ? 'No unread notifications' : 'No notifications'}
              message={tab === 'unread' || category ? 'Try adjusting your filters.' : "You're all caught up."}
            />
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {data!.items.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    isMarking={markRead.isPending && markRead.variables === item.id}
                    onMarkRead={onMarkRead}
                  />
                ))}
              </ul>
              {actionError && (
                <p role="alert" className="border-t border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {actionError}
                </p>
              )}
              <Pagination
                page={data!.page}
                pageSize={data!.pageSize}
                total={data!.total}
                totalPages={data!.totalPages}
                onPageChange={setPage}
                noun="notifications"
              />
            </>
          )}
        </Card>
      )}
    </div>
  )
}
