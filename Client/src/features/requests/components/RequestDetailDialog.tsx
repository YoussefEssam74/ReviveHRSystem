import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { Download, Eye, FileText } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Drawer } from '../../../components/ui/drawer'
import { useToast } from '../../../components/ui/toast'
import { describeApiError } from '../../../lib/api-client'
import { formatDate, formatTimeLabel } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import { downloadRequestAttachment } from '../../portal/api/requests.api'
import type { RequestListItem } from '../api/requests.api'
import {
  bmDecisionTimeLabel,
  hrDecisionTimeLabel,
  requestStatusLabel,
  requestTypeLabel,
  requestUrgency,
  submittedTimeLabel,
} from '../lib/request-status'
import { UrgencyTag } from './RequestCard'

export interface RequestDetailDialogProps {
  request: RequestListItem
  canDecide: boolean
  onClose: () => void
  onDecide: (mode: 'approve' | 'undo') => void
  /** Optional archive/restore action (the inbox table keeps it out of the row actions). */
  onArchive?: (restore: boolean) => void
}

/** A sick-leave request carries the medical certificate; other types carry a generic document. */
function attachmentLabel(type: string, t: (key: string) => string): string {
  return type === 'Sick Leave' ? t('Medical certificate') : t('Supporting document')
}

function saveAttachment({ blob, fileName }: { blob: Blob; fileName: string | null }) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName ?? 'request-attachment'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** The stored document HR (and the BM before them) must see, with view + download. */
function RequestAttachmentCard({ requestId, type }: { requestId: number; type: string }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [preview, setPreview] = useState<{ url: string; name: string; mime: string } | null>(null)

  const view = useMutation({
    mutationFn: () => downloadRequestAttachment(requestId),
    onSuccess: (data) => {
      if (data.blob.type.startsWith('image/') || data.blob.type === 'application/pdf') {
        setPreview({ url: URL.createObjectURL(data.blob), name: data.fileName ?? 'attachment', mime: data.blob.type })
      } else {
        saveAttachment(data)
      }
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  const download = useMutation({
    mutationFn: () => downloadRequestAttachment(requestId),
    onSuccess: saveAttachment,
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-charcoal-900">{attachmentLabel(type, t)}</p>
          <p className="text-[10px] text-charcoal-500">{t('Uploaded with this request')}</p>
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1 justify-center"
          loading={view.isPending}
          onClick={() => view.mutate()}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          {t('View')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="flex-1 justify-center"
          loading={download.isPending}
          onClick={() => download.mutate()}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          {t('Download')}
        </Button>
      </div>

      {preview && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-white">
            <span className="truncate">{preview.name}</span>
            <button type="button" onClick={() => setPreview(null)} className="rounded px-2 py-1 hover:bg-white/10">
              {t('Close')}
            </button>
          </div>
          {preview.mime === 'application/pdf' ? (
            <iframe title={preview.name} src={preview.url} className="min-h-0 flex-1 rounded-lg bg-white" />
          ) : (
            <img src={preview.url} alt={preview.name} className="mx-auto min-h-0 max-h-full rounded-lg object-contain" />
          )}
        </div>
      )}
    </div>
  )
}

/** Read-only request detail in a right-side drawer: identity, reason, document, balance, decisions, timeline. */
export function RequestDetailDialog({ request, canDecide, onClose, onDecide, onArchive }: RequestDetailDialogProps) {
  const { t } = useTranslation()
  const balance = request.leaveBalance
  const submittedTime = submittedTimeLabel(request)
  const bmDecided = bmDecisionTimeLabel(request)
  const hrDecided = hrDecisionTimeLabel(request)
  // No time limit: a decision can be pulled back however late the correction lands.
  const undoable = canDecide && (request.status === 'Approved' || request.status === 'Rejected')

  return (
    <Drawer open onClose={onClose} title={`R${request.id} - ${request.employee}`}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-gray text-[9px]">{requestTypeLabel(request.type)}</span>
          <span className="badge badge-gray text-[9px]">{request.gym}</span>
          <span className="badge badge-gray text-[9px]">
            {requestStatusLabel(request.status, request.awaitingManager)}
          </span>
          {requestUrgency(request) !== 'Normal' && <UrgencyTag request={request} />}
        </div>

        <p className="text-[11px] text-charcoal-600">
          {formatDate(request.requestedDate)}
          {request.endDate && request.endDate !== request.requestedDate ? ` - ${formatDate(request.endDate)}` : ''} |{' '}
          {t('Submitted')} {formatDate(request.submittedDate)}
          {submittedTime ? ` | ${submittedTime}` : ''}
        </p>

        {request.reason && (
          <div className="rounded-lg bg-charcoal-50 p-2.5">
            <p className="text-[9px] uppercase tracking-wide text-charcoal-500">{t('Reason')}</p>
            <p className="mt-0.5 text-xs text-charcoal-800">{request.reason}</p>
          </div>
        )}

        {request.hasAttachment && <RequestAttachmentCard requestId={request.id} type={request.type} />}

        {balance && (
          <div className="rounded-lg border border-charcoal-200 bg-charcoal-50 p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[9px] uppercase tracking-wide text-charcoal-500">{balance.label}</p>
              <p
                className={cn(
                  'text-[11px] font-bold',
                  balance.left <= 0 ? 'text-red-600' : balance.afterApproval <= 0 ? 'text-yellow-600' : 'text-brand-600',
                )}
              >
                {balance.left}/{balance.total} left
                {request.status === 'Pending HR Review' ? ` -> ${balance.afterApproval}` : ''}
              </p>
            </div>
            <p className="mt-1 text-[10px] text-charcoal-600">
              {request.status === 'Rejected'
                ? t('Request rejected - no payment recorded.')
                : request.status === 'Approved'
                  ? request.payment === 'unpaid'
                    ? t('Recorded as unpaid - payroll deduction applies.')
                    : t('Recorded as paid - deducted from the balance.')
                  : balance.left <= 0
                    ? t('No balance left - HR sets paid or unpaid at approval.')
                    : t('{{after}} of {{total}} days remaining after approval.', {
                        after: balance.afterApproval,
                        total: balance.total,
                      })}
            </p>
          </div>
        )}

        <div className="rounded-lg bg-charcoal-50 p-2.5">
          <p className="text-[9px] uppercase tracking-wide text-charcoal-500">{t('Building manager decision')}</p>
          <p
            className={cn(
              'mt-0.5 text-xs font-medium',
              request.bmDecision === 'Approved' ? 'text-brand-700' : request.bmDecision ? 'text-red-700' : 'text-charcoal-400',
            )}
          >
            {request.bmDecision ?? t('No BM decision recorded yet.')}
            {request.bmComment ? ` - ${request.bmComment}` : ''}
          </p>
          {bmDecided && <p className="mt-0.5 text-[10px] text-charcoal-400">{bmDecided}</p>}
        </div>

        {request.hrDecision && (
          <div className="rounded-lg bg-charcoal-50 p-2.5">
            <p className="text-[9px] uppercase tracking-wide text-charcoal-500">{t('HR final decision')}</p>
            <p
              className={cn(
                'mt-0.5 text-xs font-medium',
                request.hrDecision === 'Approved' ? 'text-brand-700' : 'text-red-700',
              )}
            >
              {request.hrDecision}
              {request.payment && (
                <span className={cn('badge ml-1 text-[9px]', request.payment === 'paid' ? 'badge-green' : 'badge-red')}>
                  {request.payment === 'paid' ? t('Paid') : t('Unpaid')}
                </span>
              )}
              {request.hrComment ? ` - ${request.hrComment}` : ''}
            </p>
            {hrDecided && <p className="mt-0.5 text-[10px] text-charcoal-400">{hrDecided}</p>}
          </div>
        )}

        <div>
          <p className="bento-label mb-1.5 text-charcoal-500">{t('TIMELINE')}</p>
          {request.timeline.length === 0 ? (
            <p className="text-[10px] text-charcoal-400">{t('No timeline.')}</p>
          ) : (
            <ol className="space-y-1.5">
              {request.timeline.map((step, index) => (
                <li key={`${step.step}-${index}`} className="flex items-center gap-2 text-xs">
                  <span className={cn('h-1.5 w-1.5 rounded-full', step.done ? 'bg-brand-500' : 'bg-charcoal-300')} />
                  <span className="font-medium text-charcoal-900">{step.step}</span>
                  <span className="text-[10px] text-charcoal-400">{formatTimeLabel(step.date)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="sticky bottom-0 -mx-4 -mb-4 mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-charcoal-100 bg-white px-4 py-3">
          {request.status === 'Pending HR Review' && canDecide && (
            <Button size="sm" onClick={() => onDecide('approve')}>
              {t('Decide')}
            </Button>
          )}
          {undoable && (
            <Button variant="dangerOutline" size="sm" onClick={() => onDecide('undo')}>
              {t('Undo Decision')}
            </Button>
          )}
          {onArchive && (
            <Button variant="ghost" size="sm" onClick={() => onArchive(request.status === 'Archived')}>
              {request.status === 'Archived' ? t('Restore to inbox') : t('Archive')}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('Close')}
          </Button>
        </div>
      </div>
    </Drawer>
  )
}
