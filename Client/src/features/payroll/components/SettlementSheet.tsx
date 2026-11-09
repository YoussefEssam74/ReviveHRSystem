import { useState } from 'react'
import { ChevronLeft, Download, Plus, Send, X } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { Avatar } from '../../../components/ui/avatar'
import { Dialog } from '../../../components/ui/dialog'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { useMe } from '../../../contexts/MeContext'
import { describeApiError } from '../../../lib/api-client'
import { formatDate, formatMoney } from '../../../lib/format'
import {
  useAddDeduction,
  useApprovePeriod,
  useCloseEntry,
  useExportPeriodCsv,
  usePayrollPeriod,
  useReopenEntry,
  useRemoveDeduction,
  useUpdateBonus,
} from '../hooks/usePayroll'
import type { DeductionLine, DeductionSource, PayrollEntry } from '../api/payroll.api'
import PayslipDialog from './PayslipDialog'

export interface SettlementSheetProps {
  periodId: number
  /** payroll-level Edit: renders the write controls (UX gate only). */
  canEdit: boolean
  onBack: () => void
}

/** One period's settlement sheets: bonus edits, Add-Line, close/reopen, publish, CSV. */
export default function SettlementSheet({ periodId, canEdit, onBack }: SettlementSheetProps) {
  const { me } = useMe()
  const { data: period, isLoading, error } = usePayrollPeriod(periodId)

  const updateBonus = useUpdateBonus(periodId)
  const addDeduction = useAddDeduction(periodId)
  const removeDeduction = useRemoveDeduction(periodId)
  const closeEntry = useCloseEntry(periodId)
  const reopenEntry = useReopenEntry(periodId)
  const approve = useApprovePeriod()
  const exportCsv = useExportPeriodCsv()

  const [bonusDrafts, setBonusDrafts] = useState<Record<number, string>>({})
  const [addingFor, setAddingFor] = useState<number | null>(null)
  const [lineSource, setLineSource] = useState<DeductionSource>('manager')
  const [lineReason, setLineReason] = useState('')
  const [lineAmount, setLineAmount] = useState('')
  const [payslip, setPayslip] = useState<{ employeeId: number; name: string } | null>(null)
  const [confirmingPublish, setConfirmingPublish] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  if (isLoading) return <LoadingState label="Loading settlement sheet…" />
  if (error) return <ErrorState message={describeApiError(error)} />
  if (!period) return null

  // The period row carries no gym; the sheets do. Publishing needs the branch
  // name (or id) the period belongs to — fall back to the session's active gym.
  const sheetGym = period.items[0]?.gym ?? me?.activeGym?.gymName ?? ''
  const exportGymId =
    me?.gyms.find((gym) => gym.gymName === sheetGym)?.gymId ?? me?.activeGym?.gymId ?? undefined
  const pendingLines = period.items.reduce(
    (count, entry) => count + entry.deductionLines.filter((line) => line.status === 'Pending').length,
    0,
  )

  const runGuarded = async (action: () => Promise<unknown>) => {
    setActionError(null)
    try {
      await action()
      return true
    } catch (err) {
      setActionError(describeApiError(err))
      return false
    }
  }

  const onSaveBonus = async (entry: PayrollEntry) => {
    const draft = bonusDrafts[entry.employeeId]
    if (draft == null) return
    const value = Number(draft)
    if (!Number.isFinite(value) || value < 0) {
      setActionError('Bonus must be zero or more.')
      return
    }
    const ok = await runGuarded(() => updateBonus.mutateAsync({ employeeId: entry.employeeId, bonus: value }))
    if (ok) {
      setBonusDrafts((previous) => {
        const next = { ...previous }
        delete next[entry.employeeId]
        return next
      })
    }
  }

  const onAddLine = async (entry: PayrollEntry) => {
    const amount = Number(lineAmount)
    if (!lineReason.trim()) {
      setActionError('A reason is required for every deduction line.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionError('The deduction amount must be greater than zero.')
      return
    }
    const ok = await runGuarded(() =>
      addDeduction.mutateAsync({
        employeeId: entry.employeeId,
        body: { source: lineSource, reason: lineReason.trim(), amount },
      }),
    )
    if (ok) {
      setAddingFor(null)
      setLineReason('')
      setLineAmount('')
      setLineSource('manager')
    }
  }

  const onPublish = async () => {
    if (!sheetGym) return
    const ok = await runGuarded(() => approve.mutateAsync({ periodId: period.id, gym: sheetGym }))
    if (ok) setConfirmingPublish(false)
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to periods
      </button>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{period.period}</h2>
              <StatusBadge status={period.status} />
              {period.locked && <Badge>Locked</Badge>}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {period.totalEmployees} employees · Gross {formatMoney(period.totalGross)} · Deductions{' '}
              {formatMoney(period.totalDeductions)} · Net {formatMoney(period.totalNet)}
              {pendingLines > 0 ? ` · ${pendingLines} pending line${pendingLines === 1 ? '' : 's'}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActionError(null)
                  exportCsv.mutate(
                    { periodId: period.id, gymId: exportGymId },
                    { onError: (err) => setActionError(describeApiError(err)) },
                  )
                }}
                loading={exportCsv.isPending}
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Export CSV
              </Button>
            )}
            {canEdit && !period.locked && (
              <Button size="sm" onClick={() => setConfirmingPublish(true)}>
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                Publish &amp; lock
              </Button>
            )}
          </div>
        </div>

        {actionError && (
          <p role="alert" className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </p>
        )}

        {period.items.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No employees on this sheet"
            message="This period has no entry sheets for the gyms in your scope."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {period.items.map((entry) => {
              const locked = period.locked
              const draft = bonusDrafts[entry.employeeId]
              const bonusDirty = draft != null && Number(draft) !== entry.bonus
              const adding = addingFor === entry.employeeId
              const pendingCount = entry.deductionLines.filter((line) => line.status === 'Pending').length

              return (
                <li key={entry.employeeId} className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={entry.initials} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{entry.name}</p>
                        <p className="truncate text-sm text-slate-500">
                          {entry.position} · {entry.days} days{entry.overtime > 0 ? ` · ${entry.overtime} h OT` : ''}
                          {entry.relatedRequestIds.length > 0 ? ` · ${entry.relatedRequestIds.length} linked request(s)` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={entry.status} />
                      {pendingCount > 0 && <Badge status="Pending">{pendingCount} pending</Badge>}
                      <Button variant="ghost" size="sm" onClick={() => setPayslip({ employeeId: entry.employeeId, name: entry.name })}>
                        Payslip
                      </Button>
                      {canEdit && !locked && (
                        <>
                          {entry.status === 'Draft' ? (
                            <Button
                              size="sm"
                              onClick={() => runGuarded(() => closeEntry.mutateAsync(entry.employeeId))}
                              loading={closeEntry.isPending && closeEntry.variables === entry.employeeId}
                            >
                              Close sheet
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => runGuarded(() => reopenEntry.mutateAsync(entry.employeeId))}
                              loading={reopenEntry.isPending && reopenEntry.variables === entry.employeeId}
                            >
                              Reopen
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => setAddingFor(adding ? null : entry.employeeId)}>
                            {adding ? (
                              <>
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                                Cancel
                              </>
                            ) : (
                              <>
                                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                                Add deduction
                              </>
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                    <Fact label="Days worked" value={String(entry.days)} />
                    <Fact label="Cover days" value={String(entry.coverDays)} />
                    <Fact label="Extra shifts" value={String(entry.extraShiftDays)} />
                    <Fact label="Base salary" value={formatMoney(entry.baseSalary)} />
                    <Fact label="Overtime" value={`${entry.overtime} h`} />
                    <Fact label="Cover pay" value={formatMoney(entry.coverPay)} />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Bonus</p>
                      {canEdit && !locked ? (
                        <div className="mt-1 flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={draft ?? String(entry.bonus)}
                            onChange={(e) =>
                              setBonusDrafts((previous) => ({ ...previous, [entry.employeeId]: e.target.value }))
                            }
                            className="h-8 w-28 text-sm"
                            aria-label={`Bonus for ${entry.name}`}
                          />
                          <Button
                            size="sm"
                            disabled={!bonusDirty}
                            onClick={() => onSaveBonus(entry)}
                            loading={updateBonus.isPending && updateBonus.variables?.employeeId === entry.employeeId}
                          >
                            Save
                          </Button>
                        </div>
                      ) : (
                        <p className="mt-1 text-sm font-medium text-slate-900">{formatMoney(entry.bonus)}</p>
                      )}
                    </div>
                    <Fact label="Gross" value={formatMoney(entry.gross)} />
                    <Fact label="Deductions" value={formatMoney(entry.deductions)} />
                    <Fact label="Net" value={formatMoney(entry.net)} strong />
                  </div>

                  {adding && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-sm font-semibold text-slate-900">Add deduction line</p>
                      <div className="mt-2 grid gap-3 sm:grid-cols-[10rem_1fr_10rem_auto]">
                        <div>
                          <Label htmlFor={`line-source-${entry.employeeId}`}>Source</Label>
                          <Select
                            id={`line-source-${entry.employeeId}`}
                            value={lineSource}
                            onChange={(e) => setLineSource(e.target.value === 'biometric' ? 'biometric' : 'manager')}
                          >
                            <option value="manager">Manager</option>
                            <option value="biometric">Biometric</option>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor={`line-reason-${entry.employeeId}`}>Reason</Label>
                          <Input
                            id={`line-reason-${entry.employeeId}`}
                            value={lineReason}
                            onChange={(e) => setLineReason(e.target.value)}
                            placeholder="Unapproved absence on Oct 14."
                          />
                        </div>
                        <div>
                          <Label htmlFor={`line-amount-${entry.employeeId}`}>Amount</Label>
                          <Input
                            id={`line-amount-${entry.employeeId}`}
                            type="number"
                            min={0}
                            step="any"
                            value={lineAmount}
                            onChange={(e) => setLineAmount(e.target.value)}
                            placeholder="250"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button onClick={() => onAddLine(entry)} loading={addDeduction.isPending}>
                            Add line
                          </Button>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        New lines start as Pending and do not reduce net pay until they are approved in the review queue.
                      </p>
                    </div>
                  )}

                  {entry.deductionLines.length > 0 && (
                    <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
                      {entry.deductionLines.map((line) => (
                        <DeductionLineRow
                          key={line.id}
                          line={line}
                          canRemove={canEdit && !locked}
                          removing={removeDeduction.isPending && removeDeduction.variables?.lineId === line.id}
                          onRemove={() =>
                            runGuarded(() =>
                              removeDeduction.mutateAsync({ employeeId: entry.employeeId, lineId: line.id }),
                            )
                          }
                        />
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <PayslipDialog
        periodId={periodId}
        employeeId={payslip?.employeeId ?? null}
        employeeName={payslip?.name ?? ''}
        onClose={() => setPayslip(null)}
      />

      <Dialog
        open={confirmingPublish}
        onClose={() => setConfirmingPublish(false)}
        title="Publish & lock period"
        description={sheetGym ? `${period.period} · ${sheetGym}` : period.period}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmingPublish(false)}>
              Cancel
            </Button>
            <Button onClick={onPublish} loading={approve.isPending} disabled={!sheetGym}>
              Publish payroll
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Every sheet must be settled (all lines decided, sheet closed). Publishing locks the period and its
            entries — no further bonus, deduction or review changes will be accepted.
          </p>
          {actionError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionError}
            </p>
          )}
        </div>
      </Dialog>
    </div>
  )
}

function Fact({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={strong ? 'mt-1 text-sm font-bold text-slate-900' : 'mt-1 text-sm font-medium text-slate-900'}>
        {value}
      </p>
    </div>
  )
}

function DeductionLineRow({
  line,
  canRemove,
  removing,
  onRemove,
}: {
  line: DeductionLine
  canRemove: boolean
  removing: boolean
  onRemove: () => void
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-800">{line.label || line.reason || 'Deduction'}</p>
        <p className="truncate text-xs text-slate-500">
          {formatDate(line.date)}
          {line.reason && line.label ? ` · ${line.reason}` : ''}
          {` · ${line.source}`}
          {line.attendanceRef ? ` · ${line.attendanceRef}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge status={line.status} />
        <span className="font-medium text-slate-900">{formatMoney(line.amount)}</span>
        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            loading={removing}
            aria-label={`Remove deduction ${line.id}`}
          >
            <X className="h-4 w-4 text-red-500" aria-hidden="true" />
          </Button>
        )}
      </div>
    </li>
  )
}
