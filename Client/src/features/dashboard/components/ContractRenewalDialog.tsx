import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { describeApiError } from '../../../lib/api-client'
import { postContractChange } from '../../employees/api/employees.api'
import type { HrDashboardAction } from '../api/dashboard.api'
import type { ToastTone } from '../hooks/useMockToast'

const LEVELS = ['Junior', 'Mid', 'Senior', 'Manager']

export interface ContractRenewalDialogProps {
  action: HrDashboardAction
  onClose: () => void
  toast: (message: string, tone?: ToastTone) => void
}

/**
 * Contract renewal (mock openContractRenewalModal): re-baselines the employee's
 * level / salary / effective date through POST /api/employees/{id}/contract.
 */
export default function ContractRenewalDialog({ action, onClose, toast }: ContractRenewalDialogProps) {
  const queryClient = useQueryClient()
  const [level, setLevel] = useState('')
  const [salary, setSalary] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)

  const renew = useMutation({
    mutationFn: () =>
      postContractChange(action.employeeId ?? action.refId, {
        level: level || undefined,
        salary: salary ? Number(salary) : undefined,
        effectiveDate,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast(`Contract updated for ${action.title}.`)
      onClose()
    },
    onError: (submitError) => setError(describeApiError(submitError)),
  })

  const submit = () => {
    setError(null)
    if (salary && (!Number.isFinite(Number(salary)) || Number(salary) <= 0)) {
      setError('Salary must be a positive number.')
      return
    }
    renew.mutate()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Contract Renewal"
      description={`${action.title} · due ${new Date(action.date).toLocaleDateString()}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={renew.isPending}>
            Issue renewal
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

        <p className="rounded-lg border border-charcoal-200 bg-charcoal-50 px-3 py-2 text-[11px] text-charcoal-600">
          {action.detail}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="contract-level">Level</Label>
            <Select id="contract-level" value={level} onChange={(event) => setLevel(event.target.value)}>
              <option value="">Keep current</option>
              {LEVELS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="contract-salary">New salary (EGP)</Label>
            <Input
              id="contract-salary"
              type="number"
              min={0}
              value={salary}
              onChange={(event) => setSalary(event.target.value)}
              placeholder="Keep current"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="contract-effective">Effective date</Label>
          <Input
            id="contract-effective"
            type="date"
            value={effectiveDate}
            onChange={(event) => setEffectiveDate(event.target.value)}
          />
        </div>
      </div>
    </Dialog>
  )
}
