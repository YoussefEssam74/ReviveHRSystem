import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getAnnouncements,
  getNotifications,
  getUnreadCount,
  postAnnouncement,
  putReadAll,
  putReadOne,
  type AnnouncementListParams,
  type CreateAnnouncementBody,
  type NotificationListParams,
} from '../api/notifications.api'

/** Paged inbox for the signed-in user (newest first). */
export function useNotifications(params: NotificationListParams) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: ({ signal }) => getNotifications(params, signal),
  })
}

/** Unread counter behind the header bell (same key/refetch cadence as the bell). */
export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: ({ signal }) => getUnreadCount(signal),
    refetchInterval: 60_000,
  })
}

/** PUT /api/notifications/read-all — invalidates every notifications cache. */
export function useMarkAllRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => putReadAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

/** PUT /api/notifications/{id}/read — marks one row read. */
export function useMarkRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => putReadOne(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

/** Paged announcements list (announcements.view). */
export function useAnnouncements(params: AnnouncementListParams) {
  return useQuery({
    queryKey: ['announcements', params],
    queryFn: ({ signal }) => getAnnouncements(params, signal),
  })
}

/** POST /api/announcements — compose (announcements.manage). */
export function useCreateAnnouncement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateAnnouncementBody) => postAnnouncement(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
    },
  })
}
