import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FileText, X } from 'lucide-react'
import {
  createRequest,
  getExcusedHoursBudget,
  getOwnColleagues,
  getOwnLeaveBalance,
  getRequestTypes,
  type LeaveBalanceResponse,
} from '../api/requests.api'
import { Modal } from '../../../components/ui/modal'
import { Button } from '../../../components/ui/button'
import { Skeleton } from '../../../components/ui/skeleton'
import { useToast } from '../../../components/ui/toast'
import { describeApiError } from '../../../lib/api-client'
import { formatBytes } from '../../../lib/format'
import {
  REQUEST_ATTACHMENT_ACCEPT,
  REQUEST_ATTACHMENT_EXTENSIONS,
  REQUEST_ATTACHMENT_FORMATS_LABEL,
  validateUploadFile,
} from '../../../lib/file-upload'
import { cn } from '../../../lib/utils'

const FIELD_TO_LABEL: Record<string, string> = {
  date: 'Date',
  'date-from': 'From',
  'date-to': 'To Date',
  'target-date': 'Off Day Taken',
  time: 'Time',
  'time-from': 'From',
  'time-to': 'To Time',
  colleague: 'Colleague',
  amount: 'Amount',
  certificate: 'Medical Certificate',
  reason: 'Reason',
}

interface NewRequestFormState {
  typeId: string
  dateFrom: string
  dateTo: string
  targetDate: string
  time: string
  colleagueId: string
  amount: string
  reason: string
  attachment: File | null
}

const EMPTY_FORM: NewRequestFormState = {
  typeId: '',
  dateFrom: '',
  dateTo: '',
  targetDate: '',
  time: '',
  colleagueId: '',
  amount: '',
  reason: '',
  attachment: null,
}

/**
 * The shared New Request modal (mock openNewRequest): the type's rule flags drive
 * which fields render, the leave-balance banner shows for balance-consuming types,
 * and the strip of remaining excused hours shows for late/early types.
 */
export function NewRequestModal({
  employeeId,
  preselect,
  presetDate,
  onClose,
}: {
  employeeId: number
  /** Optionally open with a type already picked (attendance quick-launch chips). */
  preselect?: string
  /** Optionally prefill the from-date (schedule calendar "Request for this day"). */
  presetDate?: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<NewRequestFormState>({
    ...EMPTY_FORM,
    typeId: preselect ?? '',
    dateFrom: presetDate ?? '',
  })
  const [formError, setFormError] = useState<string | null>(null)

  const typesQuery = useQuery({
    queryKey: ['portal', 'request-types'],
    queryFn: ({ signal }) => getRequestTypes(signal),
    staleTime: 10 * 60_000,
  })
  // Unscheduled Attendance is system-generated at the kiosk, never filed by hand.
  const manualTypes = (typesQuery.data ?? []).filter((type) => type.id !== 'unscheduled-attendance')
  const selectedType = manualTypes.find((type) => type.id === form.typeId) ?? null

  // Rule-flag driven needs of the selected type.
  const needsBalance = selectedType?.consumesLeave != null
  const needsColleague = selectedType?.requiresColleague ?? false
  const needsBudget = selectedType?.limitedByMonthlyExcusedHours ?? false

  const balanceQuery = useQuery({
    queryKey: ['portal', 'leave-balance', employeeId],
    queryFn: ({ signal }) => getOwnLeaveBalance(employeeId, signal),
    enabled: needsBalance,
  })
  const colleaguesQuery = useQuery({
    queryKey: ['portal', 'colleagues', employeeId],
    queryFn: ({ signal }) => getOwnColleagues(employeeId, signal),
    enabled: needsColleague,
  })
  const budgetQuery = useQuery({
    queryKey: ['portal', 'excused-hours', employeeId],
    queryFn: ({ signal }) => getExcusedHoursBudget(employeeId, signal),
    enabled: needsBudget,
  })

  const set = <K extends keyof NewRequestFormState>(key: K, value: NewRequestFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const balance = balanceQuery.data ?? null
  const annualRemaining = balance ? balance.dayOff.total - balance.dayOff.used : null

  const submitMutation = useMutation({
    mutationFn: () => {
      const fields: Record<string, string> = {
        type: form.typeId,
        reason: form.reason.trim(),
      }
      if (form.dateFrom) fields.requestDate = form.dateFrom
      if (form.dateTo) fields.endDate = form.dateTo
      if (form.targetDate) fields.targetDate = form.targetDate
      if (form.time) fields.requestTime = form.time
      if (form.colleagueId) fields.swapWithEmployeeId = form.colleagueId
      if (form.amount) fields.amount = form.amount
      return createRequest(employeeId, fields, form.attachment)
    },
    onSuccess: async () => {
      toast(t('{{type}} submitted — pending review', { type: selectedType?.label ?? t('Request') }))
      await queryClient.invalidateQueries({ queryKey: ['portal', 'requests'] })
      await queryClient.invalidateQueries({ queryKey: ['portal', 'leave-balance'] })
      await queryClient.invalidateQueries({ queryKey: ['portal', 'excused-hours'] })
      await queryClient.invalidateQueries({ queryKey: ['portal', 'dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['portal', 'deductions'] })
      onClose()
    },
    onError: (error) => setFormError(describeApiError(error)),
  })

  function handleSubmit() {
    setFormError(null)
    if (!form.typeId) {
      setFormError(t('Please select a request type.'))
      return
    }
    if (!form.reason.trim()) {
      setFormError(t('Please add a reason for your request.'))
      return
    }
    if (selectedType?.consumesLeave === 'Annual' && annualRemaining !== null && annualRemaining <= 0) {
      setFormError(t('No annual leave days remaining — you cannot submit an annual-leave request.'))
      return
    }
    if (selectedType?.requiresAttachment && !form.attachment) {
      setFormError(t('A medical certificate must be attached to a sick-leave request.'))
      return
    }
    if (form.attachment) {
      const invalid = validateUploadFile(form.attachment, {
        allowedExtensions: REQUEST_ATTACHMENT_EXTENSIONS,
        formatsLabel: REQUEST_ATTACHMENT_FORMATS_LABEL,
      })
      if (invalid) {
        setFormError(invalid)
        return
      }
    }
    submitMutation.mutate()
  }

  return (
    <Modal
      open
      title={t('New Request')}
      width="wide"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={submitMutation.isPending} disabled={typesQuery.isLoading}>
            {submitMutation.isPending ? t('Submitting…') : t('Submit')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label htmlFor="req-type" className="form-label">
            {t('Request Type')}
          </label>
          <select
            id="req-type"
            className="form-select"
            value={form.typeId}
            disabled={typesQuery.isLoading}
            onChange={(event) => {
              set('typeId', event.target.value)
              set('dateTo', '')
              set('targetDate', '')
              set('time', '')
              set('colleagueId', '')
              set('amount', '')
              set('attachment', null)
              setFormError(null)
            }}
          >
            <option value="">{typesQuery.isLoading ? t('Loading types…') : t('Select type...')}</option>
            {manualTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
          {typesQuery.isError && <p className="mt-1 text-[11px] text-red-600">{describeApiError(typesQuery.error)}</p>}
        </div>

        {selectedType && needsBalance && (
          <LeaveBalanceBanner balance={balance} loading={balanceQuery.isLoading} error={balanceQuery.error ? describeApiError(balanceQuery.error) : null} />
        )}

        {selectedType && needsBudget && budgetQuery.data && (
          <div className="rounded-lg border border-charcoal-200 bg-charcoal-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-charcoal-800">Excused Hours — {budgetQuery.data.month}</p>
              <span className="text-[10px] font-bold text-charcoal-700">
                {t('{{remaining}} of {{cap}} h left', {
                  remaining: budgetQuery.data.remainingHours,
                  cap: budgetQuery.data.capHours,
                })}
              </span>
            </div>
          </div>
        )}

        {selectedType && (
          <div className="space-y-3 border-t border-charcoal-100 pt-3">
            {selectedType.fields.map((field) => {
              if (field === 'date' || field === 'date-from') {
                return <DateField key={field} id="req-date" label={t(FIELD_TO_LABEL[field]!)} value={form.dateFrom} onChange={(v) => set('dateFrom', v)} />
              }
              if (field === 'date-to') {
                return <DateField key={field} id="req-date-to" label={t('To Date')} value={form.dateTo} onChange={(v) => set('dateTo', v)} />
              }
              if (field === 'target-date') {
                return (
                  <DateField
                    key={field}
                    id="req-target-date"
                    label={t('Off Day Taken')}
                    value={form.targetDate}
                    onChange={(v) => set('targetDate', v)}
                  />
                )
              }
              if (field === 'time' || field === 'time-from') {
                return <TimeField key={field} id="req-time" label={t(FIELD_TO_LABEL[field]!)} value={form.time} onChange={(v) => set('time', v)} />
              }
              if (field === 'time-to') {
                return <TimeField key={field} id="req-time-to" label={t('To Time')} value={form.time} onChange={(v) => set('time', v)} />
              }
              if (field === 'colleague') {
                if (colleaguesQuery.isError) {
                  return (
                    <p key={field} className="text-[11px] text-red-600">
                      {describeApiError(colleaguesQuery.error)}
                    </p>
                  )
                }
                return (
                  <div key={field}>
                    <label htmlFor="req-colleague" className="form-label">
                      {t('Colleague')}
                    </label>
                    <select
                      id="req-colleague"
                      className="form-select"
                      value={form.colleagueId}
                      disabled={colleaguesQuery.isLoading}
                      onChange={(event) => set('colleagueId', event.target.value)}
                    >
                      <option value="">{colleaguesQuery.isLoading ? t('Loading colleagues…') : t('Select...')}</option>
                      {colleaguesQuery.data?.map((colleague) => (
                        <option key={colleague.id} value={String(colleague.id)}>
                          {colleague.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              }
              if (field === 'amount') {
                return (
                  <div key={field}>
                    <label htmlFor="req-amount" className="form-label">
                      {t('Amount')}
                    </label>
                    <input
                      id="req-amount"
                      type="number"
                      min="1"
                      step="0.01"
                      className="form-input"
                      placeholder={t('e.g. 2500')}
                      value={form.amount}
                      onChange={(event) => set('amount', event.target.value)}
                    />
                  </div>
                )
              }
              if (field === 'certificate') {
                return (
                  <div key={field}>
                    <label htmlFor="req-certificate" className="form-label">
                      {t('Medical Certificate')}
                    </label>
                    <label
                      htmlFor="req-certificate"
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-lg border-2 border-dashed px-3 py-2.5 transition-colors',
                        form.attachment
                          ? 'border-brand-300 bg-brand-50/60'
                          : 'border-charcoal-200 hover:border-brand-400',
                      )}
                    >
                      <FileText className="h-4 w-4 shrink-0 text-charcoal-400" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-charcoal-800">
                          {form.attachment ? form.attachment.name : t('Attach a PDF, image or Word file')}
                        </span>
                        <span className="block text-[10px] text-charcoal-500">
                          {form.attachment
                            ? t('{{size}} · ready to submit', { size: formatBytes(form.attachment.size) })
                            : t('{{formats}} up to 10 MB', { formats: REQUEST_ATTACHMENT_FORMATS_LABEL })}
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] font-semibold text-brand-600">
                        {form.attachment ? t('Replace') : t('Browse')}
                      </span>
                    </label>
                    <input
                      id="req-certificate"
                      type="file"
                      className="hidden"
                      accept={REQUEST_ATTACHMENT_ACCEPT}
                      onChange={(event) => {
                        const next = event.target.files?.[0] ?? null
                        event.target.value = ''
                        if (!next) return
                        const invalid = validateUploadFile(next, {
                          allowedExtensions: REQUEST_ATTACHMENT_EXTENSIONS,
                          formatsLabel: REQUEST_ATTACHMENT_FORMATS_LABEL,
                        })
                        if (invalid) {
                          set('attachment', null)
                          setFormError(invalid)
                          return
                        }
                        set('attachment', next)
                        setFormError(null)
                      }}
                    />
                    {form.attachment && (
                      <div className="mt-1 flex items-center justify-between gap-2 rounded bg-white px-2 py-1 text-[10px] text-charcoal-500">
                        <span className="min-w-0 truncate">{t('Attached · {{name}}', { name: form.attachment.name })}</span>
                        <button
                          type="button"
                          onClick={() => {
                            set('attachment', null)
                            setFormError(null)
                          }}
                          className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-charcoal-600 transition-colors hover:text-red-600"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                          {t('Remove')}
                        </button>
                      </div>
                    )}
                  </div>
                )
              }
              // reason (and any free-text token the API adds later)
              return (
                <div key={field}>
                  <label htmlFor="req-reason" className="form-label">
                    {FIELD_TO_LABEL[field] ? t(FIELD_TO_LABEL[field]) : field.charAt(0).toUpperCase() + field.slice(1).replace(/-/g, ' ')}
                  </label>
                  <textarea
                    id="req-reason"
                    rows={2}
                    className="form-input"
                    placeholder={t('Details...')}
                    value={form.reason}
                    onChange={(event) => set('reason', event.target.value)}
                  />
                </div>
              )
            })}
          </div>
        )}

        {formError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {formError}
          </p>
        )}
      </div>
    </Modal>
  )
}

function DateField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <input id={id} type="date" className="form-input" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function TimeField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <input id={id} type="time" className="form-input" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

/** The annual-leave banner from the mock: remaining/total with a progress bar. */
export function LeaveBalanceBanner({
  balance,
  loading,
  error,
}: {
  balance: LeaveBalanceResponse | null
  loading: boolean
  error: string | null
}) {
  const { t } = useTranslation()
  if (loading) return <Skeleton className="h-16 w-full rounded-lg" />
  if (error || !balance) return null

  const remaining = balance.dayOff.total - balance.dayOff.used
  const usedPct = balance.dayOff.total > 0 ? Math.round((balance.dayOff.used / balance.dayOff.total) * 100) : 0
  if (remaining <= 0) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
        <div>
          <p className="text-xs font-bold text-red-800">{t('Annual Leave Exhausted')}</p>
          <p className="mt-0.5 text-[10px] text-red-600">
            {t("You've used all {{count}} annual leave days. Day-off requests are blocked until next year.", {
              count: balance.dayOff.total,
            })}
          </p>
        </div>
      </div>
    )
  }
  const barColor = remaining <= 2 ? 'bg-yellow-500' : 'bg-brand-500'
  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-bold text-brand-800">{t('Annual Leave Balance')}</p>
        <span className={cn('text-[10px] font-bold', remaining <= 2 ? 'text-yellow-700' : 'text-brand-700')}>
          {t('{{remaining}} of {{total}} days left', { remaining, total: balance.dayOff.total })}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-200">
        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${usedPct}%` }} />
      </div>
      <p className="mt-1 text-[9px] text-brand-600">
        {balance.dayOff.used === 1
          ? t('{{count}} day used so far', { count: balance.dayOff.used })
          : t('{{count}} days used so far', { count: balance.dayOff.used })}
      </p>
    </div>
  )
}
