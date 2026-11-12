import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Megaphone, Send } from 'lucide-react'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { Textarea } from '../../../components/ui/textarea'
import { Dialog } from '../../../components/ui/dialog'
import { Badge } from '../../../components/ui/badge'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { Pagination } from '../../../components/ui/pagination'
import { useMe } from '../../../contexts/MeContext'
import { EDIT } from '../../../lib/permissions'
import { formatDate, statusBadgeClass } from '../../../lib/format'
import { describeApiError } from '../../../lib/api-client'
import {
  ANNOUNCEMENT_ALL_AUDIENCE,
  ANNOUNCEMENT_TYPES,
  type CreateAnnouncementBody,
} from '../api/notifications.api'
import { useAnnouncements, useCreateAnnouncement } from '../hooks/useNotifications'

/**
 * Announcements tab — company broadcast history with read-rate bars, plus the
 * compose dialog (POST /api/announcements, announcements.manage). Reads are
 * announcements.view; without manage the compose action is hidden (the API
 * enforces both regardless).
 */
export function AnnouncementsPanel() {
  const { t } = useTranslation()
  const { can, me } = useMe()
  const canManage = can('announcements', EDIT)
  const [page, setPage] = useState(1)
  const [composeOpen, setComposeOpen] = useState(false)
  const { data, isLoading, error } = useAnnouncements({ page, pageSize: 20 })

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {data ? t('{{count}} announcements sent', { count: data.total }) : t('Company-wide broadcasts')}
        </p>
        {canManage ? (
          <Button onClick={() => setComposeOpen(true)}>
            <Megaphone className="h-4 w-4" aria-hidden="true" />
            {t('Compose announcement')}
          </Button>
        ) : (
          <p className="text-xs text-slate-400">
            {t('Composing requires')} <code className="rounded bg-slate-100 px-1">announcements.manage</code>.
          </p>
        )}
      </div>

      <Card>
        {isLoading ? (
          <LoadingState label={t('Loading announcements…')} />
        ) : error ? (
          <ErrorState message={describeApiError(error)} />
        ) : (data?.items?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={t('No announcements')}
            message={t('Broadcasts sent to staff will appear here with their read rate.')}
          />
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {data!.items.map((item) => (
                <li key={item.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
                          {item.audience}
                        </span>
                        {item.type && <span>{item.type}</span>}
                        {item.sentDate && <span>{formatDate(item.sentDate)}</span>}
                      </div>
                      {item.message && <p className="mt-1.5 line-clamp-2 text-xs text-slate-600">{item.message}</p>}
                    </div>
                    <Badge className={statusBadgeClass(item.status)}>{item.status}</Badge>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.max(0, Math.min(100, item.readRate))}%` }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-end text-[11px] font-medium text-slate-500">
                      {t('Read rate {{rate}}%', { rate: item.readRate })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination
              page={data!.page}
              pageSize={data!.pageSize}
              total={data!.total}
              totalPages={data!.totalPages}
              onPageChange={setPage}
              noun="announcements"
            />
          </>
        )}
      </Card>

      {composeOpen && canManage && (
        <ComposeDialog
          audiences={[ANNOUNCEMENT_ALL_AUDIENCE, ...(me?.gyms ?? []).map((g) => g.gymName)]}
          onClose={() => setComposeOpen(false)}
        />
      )}
    </>
  )
}

function ComposeDialog({ audiences, onClose }: { audiences: string[]; onClose: () => void }) {
  const { t } = useTranslation()
  const create = useCreateAnnouncement()
  const [title, setTitle] = useState('')
  const [audience, setAudience] = useState(audiences[0] ?? ANNOUNCEMENT_ALL_AUDIENCE)
  const [type, setType] = useState<string>(ANNOUNCEMENT_TYPES[0])
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const valid = title.trim().length > 0 && message.trim().length > 0

  const onSubmit = async () => {
    if (!valid) return
    setFormError(null)
    const body: CreateAnnouncementBody = {
      title: title.trim(),
      audience,
      type,
      message: message.trim(),
    }
    try {
      await create.mutateAsync(body)
      onClose()
    } catch (err) {
      setFormError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('Compose announcement')}
      description={t('Sends a notification to every user in the selected audience.')}
      className="sm:max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={onSubmit} loading={create.isPending} disabled={!valid}>
            <Send className="h-4 w-4" aria-hidden="true" />
            {t('Send announcement')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="announcement-title">{t('Title')}</Label>
          <Input
            id="announcement-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('Announcement title')}
            className="mt-1"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="announcement-audience">{t('Audience')}</Label>
            <Select
              id="announcement-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="mt-1"
            >
              {audiences.map((option) => (
                <option key={option} value={option}>
                  {option === ANNOUNCEMENT_ALL_AUDIENCE ? t('All Employees') : option}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="announcement-type">{t('Type')}</Label>
            <Select
              id="announcement-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1"
            >
              {ANNOUNCEMENT_TYPES.map((option) => (
                <option key={option} value={option}>
                  {t(option)}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="announcement-message">{t('Message')}</Label>
          <Textarea
            id="announcement-message"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('What should everyone know?')}
            className="mt-1"
          />
        </div>
        {formError && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {formError}
          </p>
        )}
      </div>
    </Dialog>
  )
}
