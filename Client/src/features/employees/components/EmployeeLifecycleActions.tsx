import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowRightLeft, BadgeDollarSign, FileSignature, MoveRight, ShieldCheck, UserMinus } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { Textarea } from '../../../components/ui/textarea'
import { useToast } from '../../../components/ui/toast'
import { useMe } from '../../../contexts/MeContext'
import { getGyms } from '../../console/api/console.api'
import { InitiateOffboardingDialog } from '../../terminations/components/InitiateOffboardingDialog'
import { describeApiError } from '../../../lib/api-client'
import { formatMoney } from '../../../lib/format'
import { EDIT } from '../../../lib/permissions'
import type { EmployeeProfile } from '../api/employees.api'
import {
  useCompensationChange,
  useContractChange,
  usePositionChange,
  useRoleChange,
  useTransfer,
} from '../hooks/useEmployees'

/** Level vocabulary shared with the hire and contract-renewal dialogs. */
const LEVELS = ['Junior', 'Mid', 'Senior', 'Manager']
const ROLE_OPTIONS = ['None (Employee)', 'Team Leader', 'Branch Manager']

function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function withCurrent(option: string | null, options: string[]): string[] {
  return option && !options.includes(option) ? [option, ...options] : options
}

type LifecycleAction = 'transfer' | 'position' | 'role' | 'compensation' | 'contract' | 'offboard'

/** The error banner every lifecycle dialog prints above its fields. */
function DialogError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  )
}

/**
 * The employee file's lifecycle action bar (mock HR profile header): transfer the
 * gym, change position / system role, record compensation or a contract change,
 * and start the offboarding. Each action posts to its own lifecycle endpoint.
 */
export function EmployeeLifecycleActions({ employee }: { employee: EmployeeProfile }) {
  const { t } = useTranslation()
  const { can } = useMe()
  const [action, setAction] = useState<LifecycleAction | null>(null)

  const canManage = can('employees', EDIT)
  const canOffboard = can('offboarding')
  const close = () => setAction(null)

  if (!canManage && !canOffboard) {
    return <p className="text-[11px] text-charcoal-400">{t('No lifecycle actions granted for your role.')}</p>
  }

  return (
    <>
      {canManage && (
        <>
          <Button size="sm" variant="secondary" onClick={() => setAction('transfer')}>
            <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Transfer Gym')}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setAction('position')}>
            <MoveRight className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Change Position')}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setAction('role')}>
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Change System Role')}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setAction('compensation')}>
            <BadgeDollarSign className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Manage Compensation')}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setAction('contract')}>
            <FileSignature className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Manage Contract')}
          </Button>
        </>
      )}
      {canOffboard && (
        <Button size="sm" variant="dangerOutline" onClick={() => setAction('offboard')}>
          <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
          {t('Offboard')}
        </Button>
      )}

      {action === 'transfer' && <TransferGymDialog employee={employee} onClose={close} />}
      {action === 'position' && <ChangePositionDialog employee={employee} onClose={close} />}
      {action === 'role' && <ChangeSystemRoleDialog employee={employee} onClose={close} />}
      {action === 'compensation' && <ManageCompensationDialog employee={employee} onClose={close} />}
      {action === 'contract' && <ManageContractDialog employee={employee} onClose={close} />}
      {action === 'offboard' && <OffboardDialog employee={employee} onClose={close} />}
    </>
  )
}

/* ==================== Transfer Gym ==================== */

function TransferGymDialog({ employee, onClose }: { employee: EmployeeProfile; onClose: () => void }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const transfer = useTransfer(employee.id)
  const { data: gyms = [], isLoading } = useQuery({ queryKey: ['gyms'], queryFn: ({ signal }) => getGyms(signal) })
  const targets = gyms.filter((gym) => gym.id !== employee.gymId)

  const [toGym, setToGym] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(todayIso)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!toGym) {
      setError(t('Select the destination gym.'))
      return
    }
    if (!reason.trim()) {
      setError(t('A reason is required for the transfer.'))
      return
    }
    try {
      await transfer.mutateAsync({ toGym: Number(toGym), effectiveDate, reason: reason.trim() })
      const destination = targets.find((gym) => gym.id === Number(toGym))?.name ?? ''
      toast(t('{{name}} transferred to {{gym}}.', { name: employee.name, gym: destination }))
      onClose()
    } catch (err) {
      setError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('Transfer Gym')}
      description={t('{{name}} moves to another branch and leaves the current gym’s scope.', { name: employee.name })}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={submit} loading={transfer.isPending} disabled={isLoading || targets.length === 0}>
            {t('Transfer employee')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <DialogError message={error} />

        <p className="rounded-lg border border-charcoal-200 bg-charcoal-50 px-3 py-2 text-xs text-charcoal-600">
          {t('Current gym: {{gym}}', { gym: employee.gym })}
        </p>

        {!isLoading && targets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-charcoal-200 px-3 py-2 text-xs text-charcoal-500">
            {t('No other gym is available to you — transfers need access to the destination gym.')}
          </p>
        ) : (
          <>
            <div>
              <Label htmlFor="transfer-gym">{t('Destination gym')}</Label>
              <Select id="transfer-gym" value={toGym} onChange={(event) => setToGym(event.target.value)}>
                <option value="">{t('Select a gym…')}</option>
                {targets.map((gym) => (
                  <option key={gym.id} value={gym.id}>
                    {gym.name}
                    {gym.branch ? ` — ${gym.branch}` : ''}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="transfer-date">{t('Effective date')}</Label>
              <Input
                id="transfer-date"
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="transfer-reason">{t('Reason')}</Label>
              <Textarea
                id="transfer-reason"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t('Why is the employee moving?')}
              />
            </div>
          </>
        )}
      </div>
    </Dialog>
  )
}

/* ==================== Change Position ==================== */

function ChangePositionDialog({ employee, onClose }: { employee: EmployeeProfile; onClose: () => void }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const change = usePositionChange(employee.id)
  const levelOptions = withCurrent(employee.level, LEVELS)

  const [position, setPosition] = useState(employee.position)
  const [level, setLevel] = useState(employee.level ?? levelOptions[0])
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!level.trim()) {
      setError(t('Level is required.'))
      return
    }
    try {
      await change.mutateAsync({ position: position.trim() || undefined, level: level.trim() })
      toast(t('Position updated for {{name}}.', { name: employee.name }))
      onClose()
    } catch (err) {
      setError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('Change Position')}
      description={t('Moves {{name}} to another position or level in the same gym.', { name: employee.name })}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={submit} loading={change.isPending}>
            {t('Save position')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <DialogError message={error} />

        <div>
          <Label htmlFor="position-title">{t('Position')}</Label>
          <Input
            id="position-title"
            value={position}
            onChange={(event) => setPosition(event.target.value)}
            placeholder={t('e.g. Trainer')}
          />
          <p className="mt-1 text-[10px] text-charcoal-400">
            {t('A title that is not in the gym catalogue is created automatically.')}
          </p>
        </div>

        <div>
          <Label htmlFor="position-level">{t('Level')}</Label>
          <Select id="position-level" value={level} onChange={(event) => setLevel(event.target.value)}>
            {levelOptions.map((option) => (
              <option key={option} value={option}>
                {t(option)}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </Dialog>
  )
}

/* ==================== Change System Role ==================== */

function ChangeSystemRoleDialog({ employee, onClose }: { employee: EmployeeProfile; onClose: () => void }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const change = useRoleChange(employee.id)
  const roleOptions = withCurrent(employee.systemRole, ROLE_OPTIONS)

  const [role, setRole] = useState(employee.systemRole ?? ROLE_OPTIONS[0])
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    try {
      await change.mutateAsync({ systemRole: role })
      toast(t('System role updated for {{name}}.', { name: employee.name }))
      onClose()
    } catch (err) {
      setError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('Change System Role')}
      description={t('Grants or revokes the employee’s console role. This is a high-trust governance action.')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={submit} loading={change.isPending}>
            {t('Save role')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <DialogError message={error} />

        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {t('Roles decide what the employee can open in the console. Branch Manager is reserved for trusted staff.')}
        </p>

        <div>
          <Label htmlFor="employee-role">{t('System role')}</Label>
          <Select id="employee-role" value={role} onChange={(event) => setRole(event.target.value)}>
            {roleOptions.map((option) => (
              <option key={option} value={option}>
                {t(option)}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-[10px] text-charcoal-400">
            {t('Choosing “None (Employee)” removes the console role and leaves the portal access.')}
          </p>
        </div>
      </div>
    </Dialog>
  )
}

/* ==================== Manage Compensation ==================== */

function ManageCompensationDialog({ employee, onClose }: { employee: EmployeeProfile; onClose: () => void }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const change = useCompensationChange(employee.id)

  const [salary, setSalary] = useState(employee.salary ? String(employee.salary) : '')
  const [effectiveDate, setEffectiveDate] = useState(todayIso)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    const amount = Number(salary)
    if (!salary.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError(t('Enter a salary greater than zero.'))
      return
    }
    try {
      await change.mutateAsync({ salary: amount, effectiveDate })
      toast(t('Compensation updated for {{name}}.', { name: employee.name }))
      onClose()
    } catch (err) {
      setError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('Manage Compensation')}
      description={t('Records a new salary effective from the chosen date.')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={submit} loading={change.isPending}>
            {t('Save compensation')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <DialogError message={error} />

        <p className="rounded-lg border border-charcoal-200 bg-charcoal-50 px-3 py-2 text-xs text-charcoal-600">
          {t('Current salary: {{salary}}', { salary: formatMoney(employee.salary) })}
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="compensation-salary">{t('New salary (EGP)')}</Label>
            <Input
              id="compensation-salary"
              type="number"
              min={0}
              step={100}
              value={salary}
              onChange={(event) => setSalary(event.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="compensation-date">{t('Effective date')}</Label>
            <Input
              id="compensation-date"
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
            />
          </div>
        </div>
      </div>
    </Dialog>
  )
}

/* ==================== Manage Contract ==================== */

function ManageContractDialog({ employee, onClose }: { employee: EmployeeProfile; onClose: () => void }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const change = useContractChange(employee.id)
  const levelOptions = withCurrent(employee.level, LEVELS)

  const [level, setLevel] = useState('')
  const [salary, setSalary] = useState('')
  const [startDate, setStartDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    const amount = salary.trim() ? Number(salary) : undefined
    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
      setError(t('Enter a salary greater than zero.'))
      return
    }
    if (!level && amount === undefined && !startDate) {
      setError(t('Choose a new level, a new salary, or a new start date.'))
      return
    }
    try {
      await change.mutateAsync({
        level: level || undefined,
        salary: amount,
        effectiveDate: startDate || undefined,
      })
      toast(t('Contract updated for {{name}}.', { name: employee.name }))
      onClose()
    } catch (err) {
      setError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open={true}
      onClose={onClose}
      title={t('Manage Contract')}
      description={t('Re-anchors {{name}}’s contract: level, salary and start date.', { name: employee.name })}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={submit} loading={change.isPending}>
            {t('Save contract')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <DialogError message={error} />

        <p className="rounded-lg border border-charcoal-200 bg-charcoal-50 px-3 py-2 text-xs text-charcoal-600">
          {t('Current contract: {{level}} · {{salary}}', {
            level: employee.level ?? '—',
            salary: formatMoney(employee.salary),
          })}
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="contract-level">{t('Level')}</Label>
            <Select id="contract-level" value={level} onChange={(event) => setLevel(event.target.value)}>
              <option value="">{t('Keep current')}</option>
              {levelOptions.map((option) => (
                <option key={option} value={option}>
                  {t(option)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="contract-salary">{t('New salary (EGP)')}</Label>
            <Input
              id="contract-salary"
              type="number"
              min={0}
              step={100}
              value={salary}
              onChange={(event) => setSalary(event.target.value)}
              placeholder={t('Keep current')}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="contract-date">{t('New contract start date')}</Label>
          <Input
            id="contract-date"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
          <p className="mt-1 text-[10px] text-charcoal-400">
            {t('Optional — leave empty to keep the current contract start date.')}
          </p>
        </div>
      </div>
    </Dialog>
  )
}

/* ==================== Offboard ==================== */

function OffboardDialog({ employee, onClose }: { employee: EmployeeProfile; onClose: () => void }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  return (
    <InitiateOffboardingDialog
      employee={{ id: employee.id, name: employee.name, position: employee.position, gym: employee.gym }}
      onClose={onClose}
      onCreated={() => toast(t('Offboarding started — the exit checklist is open in Terminations.'))}
    />
  )
}
