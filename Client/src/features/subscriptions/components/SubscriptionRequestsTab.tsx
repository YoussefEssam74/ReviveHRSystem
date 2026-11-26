import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Inbox, X } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { Dialog } from '../../../components/ui/dialog'
import { EmptyState } from '../../../components/ui/empty-state'
import { Field, Textarea } from '../../../components/ui/field'
import { Tabs } from '../../../components/ui/tabs'
import { Table, TBody, TD, TH, THead, TR } from '../../../components/ui/table'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { useToast } from '../../../components/ui/toast'
import { describeApiError } from '../../../lib/api-client'
import { formatDateTime } from '../../../lib/format'
import type { SubscriptionRequest } from '../api/subscriptions.api'
import {
  useApproveSubscriptionRequest,
  useRejectSubscriptionRequest,
  useSubscriptionRequests,
} from '../hooks/useSubscriptions'

type RequestFilter = 'Pending' | 'Approved' | 'Rejected' | 'All'

const FILTERS: { value: RequestFilter; label: string }[] = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'All', label: 'All' },
]

/** Revive Admin review queue for gym renewal / plan-change requests. */
export function SubscriptionRequestsTab() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [filter, setFilter] = useState<RequestFilter>('Pending')
  const requests = useSubscriptionRequests(filter)
  const approve = useApproveSubscriptionRequest()
  const reject = useRejectSubscriptionRequest()

  const [review, setReview] = useState<{ request: SubscriptionRequest; action: 'approve' | 'reject' } | null>(null)
  const [note, setNote] = useState('')

  const pending = approve.isPending || reject.isPending

  const openReview = (request: SubscriptionRequest, action: 'approve' | 'reject') => {
    setReview({ request, action })
    setNote('')
  }

  const submitReview = async () => {
    if (!review) return
    try {
      const result = review.action === 'approve'
        ? await approve.mutateAsync({ requestId: review.request.id, note: note.trim() || null })
        : await reject.mutateAsync({ requestId: review.request.id, note: note.trim() || null })
      toast(result.message)
      setReview(null)
    } catch (error) {
      toast(describeApiError(error), 'error')
    }
  }

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <Tabs
            items={FILTERS.map((item) => ({ value: item.value, label: item.label }))}
            value={filter}
            onChange={(value) => setFilter(value as RequestFilter)}
          />
          <p className="text-xs text-slate-500">
            {t('{{count}} request(s)', { count: requests.data?.length ?? 0 })}
          </p>
        </div>

        {requests.isLoading ? (
          <LoadingState label={t('Loading requests…')} />
        ) : requests.error ? (
          <ErrorState message={describeApiError(requests.error)} onRetry={() => void requests.refetch()} />
        ) : (requests.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Inbox}
            title={t('No subscription requests here')}
            message={filter === 'Pending'
              ? t('Gym upgrade and renewal requests will appear here for review.')
              : t('No requests have this status yet.')}
          />
        ) : (
          <Table>
            <THead>
              <TH>{t('Gym')}</TH>
              <TH>{t('Request')}</TH>
              <TH>{t('Plan change')}</TH>
              <TH>{t('Requested by')}</TH>
              <TH>{t('Submitted')}</TH>
              <TH>{t('Status')}</TH>
              <TH className="text-end">{t('Actions')}</TH>
            </THead>
            <TBody>
              {requests.data!.map((request) => (
                <TR key={request.id}>
                  <TD>
                    <p className="font-medium text-slate-900">{request.gymName}</p>
                    {request.note && <p className="max-w-xs truncate text-xs text-slate-500">{request.note}</p>}
                  </TD>
                  <TD className="text-xs">{t(request.type === 'PlanChange' ? 'Plan change' : 'Renewal')}</TD>
                  <TD className="text-xs">
                    {request.currentPlanName ?? t('Custom')}
                    {request.requestedPlanName ? ` → ${request.requestedPlanName}` : ''}
                  </TD>
                  <TD className="text-xs">{request.requestedByUserName}</TD>
                  <TD className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(request.createdAtUtc)}</TD>
                  <TD>
                    <Badge
                      color={
                        request.status === 'Approved'
                          ? 'green'
                          : request.status === 'Rejected'
                            ? 'red'
                            : request.status === 'Pending'
                              ? 'yellow'
                              : 'gray'
                      }
                    >
                      {t(request.status)}
                    </Badge>
                  </TD>
                  <TD className="text-end">
                    {request.status === 'Pending' ? (
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => openReview(request, 'approve')}>
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('Approve')}
                        </Button>
                        <Button variant="dangerOutline" size="sm" onClick={() => openReview(request, 'reject')}>
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('Reject')}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">
                        {request.reviewedAtUtc ? formatDateTime(request.reviewedAtUtc) : '—'}
                      </span>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Dialog
        open={review != null}
        onClose={() => setReview(null)}
        title={review?.action === 'approve' ? t('Approve subscription request') : t('Reject subscription request')}
        description={t('{{gym}} — {{type}} request', {
          gym: review?.request.gymName ?? '',
          type: review?.request.type === 'PlanChange' ? t('Plan change') : t('Renewal'),
        })}
        footer={
          <>
            <Button variant="outline" onClick={() => setReview(null)} disabled={pending}>{t('Cancel')}</Button>
            <Button
              variant={review?.action === 'reject' ? 'danger' : 'primary'}
              onClick={submitReview}
              loading={pending}
            >
              {review?.action === 'approve' ? t('Approve request') : t('Reject request')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {review?.request.requestedPlanName && (
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              {t('Requested plan: {{plan}}', { plan: review.request.requestedPlanName })}
            </p>
          )}
          <Field label={t('Review note')} hint={t('Optional. Included in the gym notification.')}>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={500} />
          </Field>
        </div>
      </Dialog>
    </>
  )
}
