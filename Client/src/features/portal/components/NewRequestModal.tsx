import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  const selectedType = typesQuery.data?.find((type) => type.id === form.typeId) ?? null

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
      toast(`${selectedType?.label ?? 'Request'} submitted — pending review`)
      await queryClient.invalidateQueries({ queryKey: ['portal', 'requests'] })
      await queryClient.invalidateQueries({ queryKey: ['portal', 'leave-balance'] })
      await queryClient.invalidateQueries({ queryKey: ['portal', 'excused-hours'] })
      await queryClient.invalidateQueries({ queryKey: ['portal', 'dashboard'] })
      onClose()
    },
    onError: (error) => setFormError(describeApiError(error)),
  })

  function handleSubmit() {
    setFormError(null)
    if (!form.typeId) {
      setFormError('Please select a request type.')
      return
    }
    if (!form.reason.trim()) {
      setFormError('Please add a reason for your request.')
      return
    }
    if (selectedType?.consumesLeave === 'Annual' && annualRemaining !== null && annualRemaining <= 0) {
      setFormError('No annual leave days remaining — you cannot submit an annual-leave request.')
      return
    }
    if (selectedType?.requiresAttachment && !form.attachment) {
      setFormError('A medical certificate must be attached to a sick-leave request.')
      return
    }
    submitMutation.mutate()
  }

  return (
    <Modal
      open
      title="New Request"
      width="wide"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={submitMutation.isPending} disabled={typesQuery.isLoading}>
            {submitMutation.isPending ? 'Submitting…' : 'Submit'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label htmlFor="req-type" className="form-label">
            Request Type
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
            }}
          >
            <option value="">{typesQuery.isLoading ? 'Loading types…' : 'Select type...'}</option>
            {typesQuery.data?.map((type) => (
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
                {budgetQuery.data.remainingHours} of {budgetQuery.data.capHours} h left
              </span>
            </div>
          </div>
        )}

        {selectedType && (
          <div className="space-y-3 border-t border-charcoal-100 pt-3">
            {selectedType.fields.map((field) => {
              if (field === 'date' || field === 'date-from') {
                return <DateField key={field} id="req-date" label={FIELD_TO_LABEL[field]!} value={form.dateFrom} onChange={(v) => set('dateFrom', v)} />
              }
              if (field === 'date-to') {
                return <DateField key={field} id="req-date-to" label="To Date" value={form.dateTo} onChange={(v) => set('dateTo', v)} />
              }
              if (field === 'target-date') {
                return (
                  <DateField
                    key={field}
                    id="req-target-date"
                    label="Off Day Taken"
                    value={form.targetDate}
                    onChange={(v) => set('targetDate', v)}
                  />
                )
              }
              if (field === 'time' || field === 'time-from') {
                return <TimeField key={field} id="req-time" label={FIELD_TO_LABEL[field]!} value={form.time} onChange={(v) => set('time', v)} />
              }
              if (field === 'time-to') {
                return <TimeField key={field} id="req-time-to" label="To Time" value={form.time} onChange={(v) => set('time', v)} />
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
                      Colleague
                    </label>
                    <select
                      id="req-colleague"
                      className="form-select"
                      value={form.colleagueId}
                      disabled={colleaguesQuery.isLoading}
                      onChange={(event) => set('colleagueId', event.target.value)}
                    >
                      <option value="">{colleaguesQuery.isLoading ? 'Loading colleagues…' : 'Select...'}</option>
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
                      Amount
                    </label>
                    <input
                      id="req-amount"
                      type="number"
                      min="1"
                      step="0.01"
                      className="form-input"
                      placeholder="e.g. 2500"
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
                      Medical Certificate
                    </label>
                    <input
                      id="req-certificate"
                      type="file"
                      className="form-input"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.gif"
                      onChange={(event) => {
                        set('attachment', event.target.files?.[0] ?? null)
                      }}
                    />
                  </div>
                )
              }
              // reason (and any free-text token the API adds later)
              return (
                <div key={field}>
                  <label htmlFor="req-reason" className="form-label">
                    {FIELD_TO_LABEL[field] ?? field.charAt(0).toUpperCase() + field.slice(1).replace(/-/g, ' ')}
                  </label>
                  <textarea
                    id="req-reason"
                    rows={2}
                    className="form-input"
                    placeholder="Details..."
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
  if (loading) return <Skeleton className="h-16 w-full rounded-lg" />
  if (error || !balance) return null

  const remaining = balance.dayOff.total - balance.dayOff.used
  const usedPct = balance.dayOff.total > 0 ? Math.round((balance.dayOff.used / balance.dayOff.total) * 100) : 0
  if (remaining <= 0) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
        <div>
          <p className="text-xs font-bold text-red-800">Annual Leave Exhausted</p>
          <p className="mt-0.5 text-[10px] text-red-600">
            You've used all {balance.dayOff.total} annual leave days. Day-off requests are blocked until next year.
          </p>
        </div>
      </div>
    )
  }
  const barColor = remaining <= 2 ? 'bg-yellow-500' : 'bg-brand-500'
  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-bold text-brand-800">Annual Leave Balance</p>
        <span className={cn('text-[10px] font-bold', remaining <= 2 ? 'text-yellow-700' : 'text-brand-700')}>
          {remaining} of {balance.dayOff.total} days left
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-200">
        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${usedPct}%` }} />
      </div>
      <p className="mt-1 text-[9px] text-brand-600">
        {balance.dayOff.used} day{balance.dayOff.used !== 1 ? 's' : ''} used so far
      </p>
    </div>
  )
}
