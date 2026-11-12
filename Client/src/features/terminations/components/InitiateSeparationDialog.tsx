import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, UserX } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import { Dialog } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { Textarea } from '../../../components/ui/textarea'
import { useEmployeeOptions, useInitiateSeparation } from '../hooks/useTerminations'
import { describeApiError } from '../../../lib/api-client'
import { TERMINATION_REASONS, type EmployeeOption } from '../api/terminations.api'

export interface InitiateSeparationDialogProps {
  onClose: () => void
}

/** T2 — open a Termination case for an employee (closed reason vocabulary). */
export function InitiateSeparationDialog({ onClose }: InitiateSeparationDialogProps) {
  const { t } = useTranslation()
  const initiate = useInitiateSeparation()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<EmployeeOption | null>(null)
  const [lastDay, setLastDay] = useState('')
  const [reason, setReason] = useState<string>(TERMINATION_REASONS[0])
  const [notes, setNotes] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const options = useEmployeeOptions(search)
  const canSubmit = selected != null && lastDay.trim().length > 0

  const onSubmit = async () => {
    if (!selected || !lastDay) return
    setActionError(null)
    try {
      await initiate.mutateAsync({
        employeeId: selected.id,
        lastDay,
        reason,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      })
      onClose()
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('New separation')}
      description={t('Open a termination case with the five-task exit checklist.')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={onSubmit} loading={initiate.isPending} disabled={!canSubmit}>
            {t('Open case')}
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
          <Label htmlFor="employee-search">{t('Employee')}</Label>
          {selected ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{selected.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {selected.position} · {selected.gym}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                {t('Change')}
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <Input
                  id="employee-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('Search by name, email or employee number…')}
                  className="ps-9"
                />
              </div>
              {search.trim().length >= 2 && (
                <ul className="mt-2 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                  {(options.data?.items?.length ?? 0) === 0 ? (
                    <li className="px-3 py-2 text-sm text-slate-500">{t('No matching employees.')}</li>
                  ) : (
                    options.data!.items.map((employee) => (
                      <li key={employee.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(employee)
                            setSearch('')
                          }}
                          className="flex w-full items-center gap-3 px-3 py-2 text-start transition-colors hover:bg-slate-50"
                        >
                          <UserX className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-slate-900">{employee.name}</span>
                            <span className="block truncate text-xs text-slate-500">
                              {employee.position} · {employee.gym}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </>
          )}
        </div>

        <div>
          <Label htmlFor="last-day">{t('Last working day (required)')}</Label>
          <Input id="last-day" type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} />
        </div>

        <div>
          <Label htmlFor="reason">{t('Reason')}</Label>
          <Select id="reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            {TERMINATION_REASONS.map((option) => (
              <option key={option} value={option}>
                {t(option)}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="notes">{t('Notes (optional)')}</Label>
          <Textarea
            id="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('Anything the exit checklist owner should know…')}
          />
        </div>

        {selected && (
          <div className="flex items-center gap-2">
            <Badge>{selected.name}</Badge>
            <span className="text-xs text-slate-500">
              {t("The employee's standing does not change until the case is completed.")}
            </span>
          </div>
        )}
      </div>
    </Dialog>
  )
}
