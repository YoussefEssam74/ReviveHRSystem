import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronsLeft } from 'lucide-react'
import { Avatar } from '../../../components/ui/primitives'
import { StatusBadge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Modal } from '../../../components/ui/modal'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { useMe } from '../../../contexts/MeContext'
import { useEmployee, useStatusChange } from '../hooks/useEmployees'
import { EmployeeFile } from '../components/EmployeeFileTabs'
import { describeApiError } from '../../../lib/api-client'
import { formatDateWithYear, humanize } from '../../../lib/format'
import { EDIT, VIEW } from '../../../lib/permissions'

const STATUSES = ['Active', 'On Leave', 'Suspended', 'Terminated'] as const

/**
 * HR employee file — the branch portal's management profile: a header card with
 * the lifecycle actions, the eight-section tab strip, and the status dialog.
 */
export default function EmployeeProfilePage() {
  const { id } = useParams()
  const employeeId = Number(id)
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { can } = useMe()
  const { data: employee, isLoading, error } = useEmployee(employeeId)
  const statusChange = useStatusChange(employeeId)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [nextStatus, setNextStatus] = useState<string>('Active')
  const [note, setNote] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  if (isLoading) return <LoadingState label={t('Loading profile…')} />
  if (error) return <ErrorState message={describeApiError(error)} onRetry={() => navigate(0)} />
  if (!employee) return <ErrorState message={t('Employee not found.')} />

  const canView = can('employees', VIEW)
  const canEdit = can('employees', EDIT)
  const canOffboard = can('offboarding')

  const openDialog = () => {
    setNextStatus(humanize(employee.status))
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
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem-1px)] lg:overflow-hidden">
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => navigate('/console/employees')}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-charcoal-500 hover:bg-charcoal-50 hover:text-charcoal-800"
        >
          <ChevronsLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
          {t('Employees')}
        </button>

        <div className="rounded-xl border border-charcoal-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Avatar initials={employee.initials} size="lg" className="h-14 w-14 text-base" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-charcoal-900">{employee.name}</h1>
                <StatusBadge status={humanize(employee.status)} />
              </div>
              <p className="mt-0.5 text-xs text-charcoal-500">
                {[
                  employee.position,
                  employee.employeeNumber,
                  employee.level,
                  employee.gym,
                  employee.hireDate ? t('Hired {{date}}', { date: formatDateWithYear(employee.hireDate) }) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
              {canEdit && (
                <Button size="sm" variant="secondary" onClick={openDialog}>
                  {t('Change status')}
                </Button>
              )}
              {canOffboard && (
                <Button size="sm" variant="danger" onClick={() => navigate('/console/terminations')}>
                  {t('Offboard')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {canView ? (
        <EmployeeFile employee={employee} />
      ) : (
        <div className="rounded-xl border border-dashed border-charcoal-200 bg-white p-8 text-center">
          <p className="text-sm font-medium text-charcoal-700">{t('The employee file is read-only for your role')}</p>
          <p className="mt-1 text-xs text-charcoal-500">
            {t('You need the employees feature at view level to open the sections of this file.')}
          </p>
        </div>
      )}

      <Modal
        open={dialogOpen}
        title={t('Change status')}
        subtitle={t('Update {{name}}’s working status. This is recorded in their history.', { name: employee.name })}
        onClose={() => setDialogOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={onSubmitStatus} loading={statusChange.isPending}>
              {t('Save status')}
            </Button>
          </>
        }
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            void onSubmitStatus()
          }}
        >
          {actionError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {actionError}
            </p>
          )}
          <div>
            <label className="form-label" htmlFor="employee-status">
              {t('Status')}
            </label>
            <select
              id="employee-status"
              value={nextStatus}
              onChange={(event) => setNextStatus(event.target.value)}
              className="form-input"
            >
              {STATUSES.map((option) => (
                <option key={option} value={option}>
                  {t(option)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="employee-status-note">
              {t('Note (optional)')}
            </label>
            <textarea
              id="employee-status-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="form-input"
              placeholder={t('Reason for the change…')}
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
