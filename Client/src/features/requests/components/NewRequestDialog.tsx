import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { Textarea } from '../../../components/ui/textarea'
import { describeApiError } from '../../../lib/api-client'
import { cn } from '../../../lib/utils'
import { useEmployees } from '../../employees/hooks/useEmployees'
import { getEmployeeLeaveBalance } from '../api/requests.api'
import { BALANCE_TYPES } from '../lib/request-status'
import { useCreateRequest } from '../hooks/useRequests'

/** The HR form's type list — RequestTypeCatalog labels plus resignation. */
const REQUEST_TYPES = [
  'Annual Leave',
  'Sick Leave',
  'Late Attendance',
  'Early Leave',
  'Shift Swap',
  'Weekly Off Swap',
  'Check-in Correction',
  'Salary Advance',
  'Paid Holiday',
  'Deduction Correction',
  'Resignation',
]

const today = () => new Date().toISOString().slice(0, 10)

export interface NewRequestDialogProps {
  onClose: () => void
  onCreated?: (employee: string) => void
}

/** HR submits a request on an employee's behalf, with the live leave-balance preview. */
export function NewRequestDialog({ onClose, onCreated }: NewRequestDialogProps) {
  const employees = useEmployees({ pageSize: 100, status: 'Active' })
  const [employeeId, setEmployeeId] = useState('')
  const [type, setType] = useState('Annual Leave')
  const [date, setDate] = useState(today())
  const [endDate, setEndDate] = useState(today())
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const options = useMemo(() => employees.data?.items ?? [], [employees.data])
  const selected = useMemo(
    () => options.find((option) => String(option.id) === employeeId) ?? null,
    [options, employeeId],
  )

  const isBalanceType = BALANCE_TYPES.includes(type)
  const balanceQuery = useQuery({
    queryKey: ['requests', 'balance', selected?.id, type],
    queryFn: ({ signal }) => getEmployeeLeaveBalance(selected!.id, signal),
    enabled: Boolean(selected) && isBalanceType,
  })

  const bucket = balanceQuery.data
    ? type === 'Sick Leave'
      ? balanceQuery.data.sick
      : balanceQuery.data.dayOff
    : null
  const left = bucket ? Math.max(0, bucket.total - bucket.used) : null

  const create = useCreateRequest()

  const submit = async () => {
    setError(null)
    if (!selected) {
      setError('Choose an employee.')
      return
    }
    try {
      await create.mutateAsync({
        employee: selected.name,
        type,
        requestedDate: date,
        endDate: endDate && endDate !== date ? endDate : undefined,
        reason: reason.trim() || undefined,
      })
      onCreated?.(selected.name)
      onClose()
    } catch (err) {
      setError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="New Request"
      description="Created on the employee's behalf — it lands straight in Pending HR Review."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Submit Request
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div>
          <Label htmlFor="new-req-emp">Employee</Label>
          <Select id="new-req-emp" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
            <option value="">Select an employee…</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} ({option.gym})
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="new-req-type">Type</Label>
          <Select id="new-req-type" value={type} onChange={(event) => setType(event.target.value)}>
            {REQUEST_TYPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>

        {isBalanceType && selected && (
          <div className="rounded-lg border border-charcoal-200 bg-charcoal-50 p-2.5">
            <p className="text-[9px] uppercase tracking-wide text-charcoal-500">
              {type === 'Sick Leave' ? 'Sick leave balance' : 'Annual leave balance'}
            </p>
            {balanceQuery.isLoading ? (
              <p className="mt-0.5 text-xs text-charcoal-500">Loading balance…</p>
            ) : left == null ? (
              <p className="mt-0.5 text-xs text-charcoal-400">No balance on file.</p>
            ) : (
              <p
                className={cn(
                  'mt-0.5 text-xs font-bold',
                  left <= 0 ? 'text-red-600' : left === 1 ? 'text-yellow-600' : 'text-brand-600',
                )}
              >
                {left} <span className="font-normal text-charcoal-400">of {bucket!.total} days left</span>
                {left <= 0
                  ? ' — no balance left · HR decides paid/unpaid'
                  : left === 1
                    ? ' — this uses the last day'
                    : ' — deducted when approved'}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="new-req-date">Date</Label>
            <Input id="new-req-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="new-req-end">End / Last Day</Label>
            <Input
              id="new-req-end"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="new-req-reason">Reason</Label>
          <Textarea
            id="new-req-reason"
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason…"
          />
        </div>
      </div>
    </Dialog>
  )
}
