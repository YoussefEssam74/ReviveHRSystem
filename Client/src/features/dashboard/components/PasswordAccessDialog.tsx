import { useMemo, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Dialog } from '../../../components/ui/dialog'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { getTeamMembers } from '../../hr-team/api/hr-team.api'
import { getEmployees, postRoleChange } from '../../employees/api/employees.api'
import { useDashboardPasswordReset } from '../hooks/useDashboard'
import { describeApiError } from '../../../lib/api-client'
import { formatMoney, initialsOf, queueBadgeClass } from '../../../lib/format'
import type { ToastTone } from '../hooks/useMockToast'

export interface PasswordAccessDialogProps {
  onClose: () => void
  toast: (message: string, tone?: ToastTone) => void
}

const ROLE_OPTIONS = ['None (Employee)', 'Team Leader', 'Branch Manager']

function quickPassword(): string {
  return 'Pass#' + Math.floor(10000 + Math.random() * 90000)
}

/**
 * Fast action "Change Password" (mock openChangePasswordAccessModal): pick a staff
 * member, set a password on their login account (POST /api/users/{id}/reset-password)
 * and adjust their system role (POST /api/employees/{id}/role-change) when needed.
 */
export default function PasswordAccessDialog({ onClose, toast }: PasswordAccessDialogProps) {
  const { data: staff } = useQuery({
    queryKey: ['employees', 'page', { page: 1, pageSize: 100 }],
    queryFn: ({ signal }) => getEmployees({ page: 1, pageSize: 100 }, signal),
  })

  const [employeeId, setEmployeeId] = useState<number | null>(null)
  const [newPassword, setNewPassword] = useState(quickPassword)
  const [role, setRole] = useState<string>('keep')
  const [error, setError] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)

  const employee = useMemo(
    () => staff?.items.find((candidate) => candidate.id === employeeId) ?? staff?.items[0] ?? null,
    [staff, employeeId],
  )
  const effectiveEmployeeId = employee?.id ?? null
  const reset = useDashboardPasswordReset(effectiveEmployeeId ?? 0)

  const userSearch = useQuery({
    queryKey: ['users', 'employee-login', employee?.email ?? ''],
    queryFn: ({ signal }) => getTeamMembers({ type: 'employee', search: employee?.email ?? '' }, signal),
    enabled: Boolean(employee?.email),
    retry: false,
  })
  const linkedUser = userSearch.data?.items?.find((user) => user.email?.toLowerCase() === employee?.email?.toLowerCase()) ?? null

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!employee) {
      setError('Select an employee first')
      return
    }
    if (newPassword.length < 8) {
      setError('Passwords must be at least 8 characters')
      return
    }
    if (!linkedUser) {
      setError('This employee has no login account yet — accounts are created with the employee profile.')
      return
    }

    setError(null)
    setResolving(true)
    try {
      await reset.mutateAsync(newPassword)
      if (role !== 'keep') {
        try {
          await postRoleChange(employee.id, { systemRole: role })
        } catch (roleError) {
          toast(`Password changed, but the system role could not be updated: ${describeApiError(roleError)}`, 'warning')
        }
      }
      toast(`Password & access updated for ${employee.name}!`, 'success')
      onClose()
    } catch (submitError) {
      setError(describeApiError(submitError))
    } finally {
      setResolving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Change Password & System Access"
      className="sm:max-w-lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={onSubmit} loading={resolving || reset.isPending}>
            Update Password &amp; Access
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4 text-xs">
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
            {error}
          </p>
        )}
        <div>
          <Label className="mb-1 block text-xs font-bold text-charcoal-700" htmlFor="pwd-emp-select">
            Select Employee
          </Label>
          <Select
            id="pwd-emp-select"
            className="h-8 text-xs"
            value={employee ? String(employee.id) : ''}
            onChange={(e) => setEmployeeId(Number(e.target.value))}
          >
            {(staff?.items ?? []).map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} — {candidate.position} ({candidate.gym})
              </option>
            ))}
          </Select>
          {userSearch.isFetching && (
            <p className="mt-1 flex items-center gap-1 text-[10px] text-charcoal-400">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> resolving login account…
            </p>
          )}
        </div>

        {employee && (
          <div className="flex items-center justify-between rounded-xl border border-charcoal-200 bg-charcoal-50 p-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-[11px] font-bold text-white">
                {initialsOf(employee.name)}
              </span>
              <div>
                <p className="text-xs font-bold text-charcoal-900">{employee.name}</p>
                <p className="text-[11px] text-charcoal-500">
                  {employee.email ?? `${employee.name.toLowerCase().replace(/\s+/g, '.')}@revive.com`} · {employee.gym}
                </p>
              </div>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${queueBadgeClass(employee.status === 'Active' ? 'badge-green' : 'badge-gray')}`}>
              {employee.status}
            </span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="block text-xs font-semibold text-charcoal-700" htmlFor="pwd-new-pass">
            Set New Password
          </Label>
          <div className="flex gap-2">
            <Input
              id="pwd-new-pass"
              className="flex-1 font-mono text-xs"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Button type="button" variant="outline" size="sm" className="px-2.5 text-xs" onClick={() => setNewPassword(quickPassword())}>
              Generate
            </Button>
          </div>
          {newPassword.length > 0 && newPassword.length < 8 && (
            <p className="mt-1 text-[10px] text-amber-600">At least 8 characters.</p>
          )}
        </div>

        <div className="space-y-1.5 pt-1">
          <Label className="block text-xs font-semibold text-charcoal-700" htmlFor="pwd-role">
            System Role
          </Label>
          <Select id="pwd-role" className="h-8 text-xs" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="keep">Keep current role</option>
            {ROLE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <p className="text-[10px] text-charcoal-500">
            Salary: {formatMoney(employee?.salary ?? null)} EGP · Portal actions follow the role’s permissions.
          </p>
        </div>
      </form>
    </Dialog>
  )
}
