import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../../components/ui/modal'
import { Button } from '../../../components/ui/button'
import { useToast } from '../../../components/ui/toast'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { getEmployees } from '../api/employees.api'
import { useCreateRequest } from '../../requests/hooks/useRequests'
import { REQUEST_TYPE_CATALOG } from '../../requests/lib/request-status'
import { describeApiError } from '../../../lib/api-client'
import { fetchAllPages } from '../../../lib/paged'

/** Local "today" DateOnly in yyyy-MM-dd (no timezone drift). */
function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * "Create Request for an Employee" — files on the employee's own record, so it
 * skips the manager stage and lands straight in HR review.
 */
export function CreateRequestForEmployeeModal({
  initialEmployeeId,
  onClose,
}: {
  initialEmployeeId?: number | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [employeeId, setEmployeeId] = useState(initialEmployeeId ? String(initialEmployeeId) : '')
  const [type, setType] = useState(REQUEST_TYPE_CATALOG[0])
  const [requestedDate, setRequestedDate] = useState(todayIso())
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  // Pickers must list the whole gym: walk the pages (one page is capped at 100).
  const roster = useQuery({
    queryKey: ['employees', 'roster', 'fileable'],
    queryFn: ({ signal }) =>
      fetchAllPages((page) => getEmployees({ page, pageSize: 100 }, signal), signal),
    staleTime: 60_000,
  })
  const rosterOptions = (roster.data ?? []).filter((employee) => employee.status !== 'Terminated')
  const selected = rosterOptions.find((employee) => String(employee.id) === employeeId) ?? null

  const create = useCreateRequest()

  return (
    <Modal
      open
      title={t('Create Request for an Employee')}
      subtitle={t('Filed on the employee’s own record and routed to HR for the final decision.')}
      onClose={onClose}
      width="md"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (create.isPending) return
          if (!selected) {
            toast(t('Select the employee'), 'error')
            return
          }
          if (reason.trim().length === 0) {
            toast(t('Please add a reason for the request'), 'error')
            return
          }
          create.mutate(
            {
              employee: selected.name,
              type,
              requestedDate,
              endDate: endDate && endDate !== requestedDate ? endDate : undefined,
              reason: reason.trim(),
            },
            {
              onSuccess: () => {
                toast(t('Request filed for {{name}} — pending HR review', { name: selected.name }))
                onClose()
              },
              onError: (error) => toast(describeApiError(error), 'error'),
            },
          )
        }}
        className="space-y-3"
      >
        <div>
          <label className="form-label" htmlFor="er-employee">
            {t('Employee')}
          </label>
          {roster.isPending ? (
            <LoadingState />
          ) : roster.error ? (
            <ErrorState message={describeApiError(roster.error)} onRetry={() => roster.refetch()} />
          ) : (
            <select
              id="er-employee"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              className="form-input"
              aria-label={t('Employee')}
            >
              <option value="">{t('Select employee...')}</option>
              {rosterOptions.map((employee) => (
                <option key={employee.id} value={String(employee.id)}>
                  {employee.name} — {employee.position}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="form-label" htmlFor="er-type">
            {t('Request Type')}
          </label>
          <select
            id="er-type"
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="form-input"
          >
            {REQUEST_TYPE_CATALOG.map((option) => (
              <option key={option} value={option}>
                {t(option)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label" htmlFor="er-date">
              {t('Requested Date')}
            </label>
            <input
              id="er-date"
              type="date"
              value={requestedDate}
              onChange={(event) => setRequestedDate(event.target.value)}
              className="form-input"
              required
            />
          </div>
          <div>
            <label className="form-label" htmlFor="er-end">
              {t('End date (optional)')}
            </label>
            <input
              id="er-end"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="form-input"
              min={requestedDate}
            />
          </div>
        </div>
        <div>
          <label className="form-label" htmlFor="er-reason">
            {t('Reason')}
          </label>
          <textarea
            id="er-reason"
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="form-input"
            placeholder={t('Why is this request being filed for them?')}
            required
          />
        </div>
        <div className="rounded-lg bg-charcoal-50 p-2.5 text-[10px] text-charcoal-500">
          {t('Because HR raises it on the employee’s behalf, the request skips the manager stage and goes straight to HR review.')}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" size="sm" variant="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button type="submit" size="sm" variant="primary" loading={create.isPending}>
            {t('Submit Request')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
