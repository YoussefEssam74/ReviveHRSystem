import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthSession } from '../../../contexts/AuthSessionContext'
import { getNotifications, getUnreadCount, putMarkAllRead, putMarkRead, type NotificationItem } from '../api/notifications.api'

/** Notification row (alias mirroring the mock's data.js notification shape). */
export type NotificationRow = NotificationItem

/** Bell dropdown list: the most recent rows. Enabled only while open. */
export function useNotificationsList(enabled: boolean, pageSize = 6) {
  const { session } = useAuthSession()
  return useQuery({
    queryKey: ['notifications', 'list', { pageSize }],
    queryFn: ({ signal }) => getNotifications({ pageSize, signal }),
    enabled: Boolean(session) && enabled,
    staleTime: 10_000,
  })
}

/** Bell badge count — fresh often, cheap endpoint. */
export function useUnreadCount() {
  const { session } = useAuthSession()
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: ({ signal }) => getUnreadCount(signal),
    enabled: Boolean(session),
    refetchInterval: 45_000,
    staleTime: 20_000,
  })
}

/** Marks one notification read and refreshes the badge. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => putMarkRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

/** Marks every notification read (bell "Mark all read" button). */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => putMarkAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
