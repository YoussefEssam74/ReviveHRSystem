import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Mail, Phone, Building2, CalendarDays, ShieldCheck } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { Avatar } from '../../../components/ui/avatar'
import { Dialog } from '../../../components/ui/dialog'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { Textarea } from '../../../components/ui/textarea'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { useEmployee, useStatusChange } from '../hooks/useEmployees'
import { useMe } from '../../../contexts/MeContext'
import { formatDate, formatMoney } from '../../../lib/format'
import { describeApiError } from '../../../lib/api-client'

const STATUSES = ['Active', 'On Leave', 'Suspended', 'Terminated'] as const

function Detail({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-sm text-slate-900">{value}</p>
      </div>
    </div>
  )
}

/** Employee profile (S2) — summary card + status management. */
export default function EmployeeProfilePage() {
  const { id } = useParams()
  const employeeId = Number(id)
  const navigate = useNavigate()
  const { can } = useMe()
  const { data: employee, isLoading, error } = useEmployee(employeeId)
  const statusChange = useStatusChange(employeeId)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [nextStatus, setNextStatus] = useState<string>('Active')
  const [note, setNote] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  if (isLoading) return <LoadingState label="Loading profile…" />
  if (error) return <ErrorState message={describeApiError(error)} onRetry={() => navigate(0)} />
  if (!employee) return <ErrorState message="Employee not found." />

  const canEdit = can('employees', 2)

  const openDialog = () => {
    setNextStatus(employee.status)
    setNote('')
    setActionError(null)
    setDialogOpen(true)
  }

  const onSubmitStatus = async () => {
    setActionError(null)
    try {
      await statusChange.mutateAsync({ status: nextStatus as never, note: note || undefined })
      setDialogOpen(false)
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  return (
    <div>
      <Link
        to="/console/employees"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to employees
      </Link>

      <PageHeader
        title={employee.name}
        description={employee.employeeNumber}
        actions={
          canEdit ? (
            <Button variant="outline" onClick={openDialog}>
              Change status
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center text-center">
            <Avatar name={employee.initials} size="lg" />
            <h2 className="mt-3 text-lg font-bold text-slate-900">{employee.name}</h2>
            <p className="text-sm text-slate-500">{employee.position}</p>
            <div className="mt-3">
              <StatusBadge status={employee.status} />
            </div>
            {employee.level && (
              <Badge className="mt-2">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                {employee.level}
              </Badge>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Detail icon={Mail} label="Email" value={employee.email ?? '—'} />
              <Detail icon={Phone} label="Phone" value={employee.phone ?? '—'} />
              <Detail icon={Building2} label="Gym" value={employee.gym} />
              <Detail icon={CalendarDays} label="Hire date" value={formatDate(employee.hireDate)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compensation &amp; access</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Salary</p>
                <p className="text-lg font-bold text-slate-900">{formatMoney(employee.salary)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">System role</p>
                <p className="text-sm text-slate-900">{employee.systemRole ?? '—'}</p>
              </div>
              {employee.branches.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Gym access</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {employee.branches.map((branch) => (
                      <Badge key={branch.id}>{branch.name}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Change status"
        description={`Update ${employee.name}'s working status. This is recorded in their history.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onSubmitStatus} loading={statusChange.isPending}>
              Save status
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {actionError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionError}
            </p>
          )}
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
              {STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason for the change…"
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
