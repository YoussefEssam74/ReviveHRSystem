import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { Textarea } from '../../../components/ui/textarea'
import { describeApiError } from '../../../lib/api-client'
import { useLeaveEncashment, useSaveVerdict } from '../hooks/useTerminations'
import type {
  RehireStatus,
  Separation,
  SeparationVerdict,
  SettlementDirection,
} from '../api/terminations.api'

const DIRECTIONS: { value: SettlementDirection; label: string }[] = [
  { value: 'none', label: 'No settlement' },
  { value: 'owedToEmployee', label: 'Owed to employee' },
  { value: 'employeeOwes', label: 'Employee owes' },
]

const REHIRE_OPTIONS: { value: RehireStatus; label: string }[] = [
  { value: 'Eligible', label: 'Eligible for rehire' },
  { value: 'Banned', label: 'Banned from rehire' },
]

/** Daily rates and prorated money keep their cents — a rounded rate would break the equation. */
const egp2 = (value: number) =>
  `EGP ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export interface ExitVerdictFormProps {
  separation: Separation
  /** offboarding Edit — the fields are editable and the save button renders. */
  canManage: boolean
}

/**
 * "Exit verdict — HR record" questions (mock _sepVerdictHTML): why the
 * employee left, the final settlement and rehire eligibility, answered inline
 * on the Exit Workflow tab.
 */
export function ExitVerdictForm({ separation, canManage }: ExitVerdictFormProps) {
  const { t } = useTranslation()
  const verdict = separation.verdict
  const firstName = separation.employee.split(' ')[0]

  return (
    <section className="rounded-lg border border-charcoal-200 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-900">
          {t('Exit verdict — HR record')}
        </p>
        {verdict && !canManage && <Badge color="green">{t('Recorded')}</Badge>}
      </div>
      <p className="mt-0.5 text-[11px] text-charcoal-500">
        {t('Why the employee left, the final settlement and rehire eligibility.')}
      </p>

      {canManage ? (
        // Keyed on the stored verdict so a save/refetch re-seeds the fields.
        <VerdictFields
          key={`${separation.id}:${JSON.stringify(verdict ?? null)}`}
          separationId={separation.id}
          firstName={firstName}
          verdict={verdict}
          defaultReason={verdict?.finalReason ?? separation.reason ?? ''}
        />
      ) : (
        <p className="mt-1.5 text-[11px] text-charcoal-400">
          {verdict ? t('Exit verdict recorded by HR.') : t('No verdict has been recorded yet.')}
        </p>
      )}
    </section>
  )
}

function VerdictFields({
  separationId,
  firstName,
  verdict,
  defaultReason,
}: {
  separationId: number
  firstName: string
  verdict: SeparationVerdict | null
  defaultReason: string
}) {
  const { t } = useTranslation()
  const saveVerdict = useSaveVerdict(separationId)
  const [finalReason, setFinalReason] = useState(defaultReason)
  const [direction, setDirection] = useState<SettlementDirection>(verdict?.settlement?.direction ?? 'none')
  const [amount, setAmount] = useState(
    verdict?.settlement?.amount != null ? String(verdict.settlement.amount) : '',
  )
  const [settlementNote, setSettlementNote] = useState(verdict?.settlement?.note ?? '')
  const [rehireStatus, setRehireStatus] = useState<RehireStatus>(verdict?.rehire?.status ?? 'Eligible')
  const [rehireNote, setRehireNote] = useState(verdict?.rehire?.note ?? '')
  const [actionError, setActionError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Priced on the server so the payout is visible before the verdict is saved; the
  // two override inputs stay empty unless HR deliberately replaces a figure.
  const encashment = useLeaveEncashment(separationId)
  const preview = encashment.data
  const [encashmentOverride, setEncashmentOverride] = useState('')
  const [unpaidOverride, setUnpaidOverride] = useState('')

  const needsAmount = direction !== 'none'
  const canSubmit = finalReason.trim().length > 0 && (!needsAmount || amount.trim().length > 0)

  const onSubmit = async () => {
    setActionError(null)
    setSaved(false)
    try {
      await saveVerdict.mutateAsync({
        finalReason: finalReason.trim(),
        settlement: {
          direction,
          amount: Number(amount) || 0,
          ...(settlementNote.trim() ? { note: settlementNote.trim() } : {}),
          ...(encashmentOverride.trim() ? { leaveEncashmentAmount: Number(encashmentOverride) } : {}),
          ...(unpaidOverride.trim() ? { unpaidLeaveAmount: Number(unpaidOverride) } : {}),
        },
        rehire: {
          status: rehireStatus,
          ...(rehireNote.trim() ? { note: rehireNote.trim() } : {}),
        },
      })
      setSaved(true)
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  return (
    <>
      {actionError && (
        <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {actionError}
        </p>
      )}

      <div className="mt-2 space-y-2">
        <div>
          <Label htmlFor="exit-verdict-reason">{t('Why {{name}} left', { name: firstName })}</Label>
          <Textarea
            id="exit-verdict-reason"
            rows={2}
            value={finalReason}
            onChange={(event) => {
              setFinalReason(event.target.value)
              setSaved(false)
            }}
            placeholder={t('Summary of why the employment is ending…')}
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <Label htmlFor="exit-verdict-settlement">{t('Settlement')}</Label>
            <Select
              id="exit-verdict-settlement"
              value={direction}
              onChange={(event) => {
                setDirection(event.target.value as SettlementDirection)
                setSaved(false)
              }}
            >
              {DIRECTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="exit-verdict-amount">{t('Amount (EGP)')}</Label>
            <Input
              id="exit-verdict-amount"
              type="number"
              min={0}
              value={amount}
              disabled={!needsAmount}
              onChange={(event) => {
                setAmount(event.target.value)
                setSaved(false)
              }}
              placeholder="0"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="exit-verdict-settlement-note">{t('Settlement note (optional)')}</Label>
          <Input
            id="exit-verdict-settlement-note"
            value={settlementNote}
            onChange={(event) => {
              setSettlementNote(event.target.value)
              setSaved(false)
            }}
            placeholder={t('Context for the settlement…')}
          />
        </div>

        <div className="rounded-lg border border-charcoal-200 bg-charcoal-50 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-charcoal-700">
              {t('Annual leave at exit')}
            </p>
            {encashment.isPending && (
              <span className="text-[10px] text-charcoal-400">{t('Calculating…')}</span>
            )}
          </div>

          {preview && (
            <>
              <p className="mt-1 text-[11px] text-charcoal-600">
                {preview.belowQualifyingPeriod
                  ? t('No annual days earned yet — the six-month qualifying period is not complete.')
                  : t('Earned {{earned}} day(s) this year · {{used}} used · {{unused}} encashed', {
                      earned: preview.earnedDaysThisYear,
                      used: preview.usedDays,
                      unused: preview.unusedDays,
                    })}
              </p>

              <div className="mt-1.5 space-y-1 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-charcoal-600">{t('Unused leave — owed to employee')}</span>
                  <span className="whitespace-nowrap font-medium text-charcoal-900">
                    {preview.unusedDays} × {egp2(preview.dailyRate)} = {egp2(preview.encashmentAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-charcoal-600">{t('Unpaid leave — employee owes')}</span>
                  <span className="whitespace-nowrap font-medium text-charcoal-900">
                    {preview.deficitDays} × {egp2(preview.dailyRate)} = {egp2(preview.debtAmount)}
                  </span>
                </div>
              </div>

              <p className="mt-1 text-[10px] text-charcoal-400">
                {t('Daily rate = base salary ÷ calendar days in the exit month. Saved on the final payroll sheet.')}
              </p>
            </>
          )}

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor="exit-verdict-encashment">{t('Encashment override (EGP)')}</Label>
              <Input
                id="exit-verdict-encashment"
                type="number"
                min={0}
                value={encashmentOverride}
                onChange={(event) => {
                  setEncashmentOverride(event.target.value)
                  setSaved(false)
                }}
                placeholder={preview ? String(preview.encashmentAmount) : '0'}
              />
            </div>
            <div>
              <Label htmlFor="exit-verdict-unpaid-leave">{t('Unpaid leave override (EGP)')}</Label>
              <Input
                id="exit-verdict-unpaid-leave"
                type="number"
                min={0}
                value={unpaidOverride}
                onChange={(event) => {
                  setUnpaidOverride(event.target.value)
                  setSaved(false)
                }}
                placeholder={preview ? String(preview.debtAmount) : '0'}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <Label htmlFor="exit-verdict-rehire">{t('Rehire')}</Label>
            <Select
              id="exit-verdict-rehire"
              value={rehireStatus}
              onChange={(event) => {
                setRehireStatus(event.target.value as RehireStatus)
                setSaved(false)
              }}
            >
              {REHIRE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="exit-verdict-rehire-note">{t('Rehire note (optional)')}</Label>
            <Input
              id="exit-verdict-rehire-note"
              value={rehireNote}
              onChange={(event) => {
                setRehireNote(event.target.value)
                setSaved(false)
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        {saved && <span className="text-[11px] text-green-600">{t('Exit verdict saved.')}</span>}
        <Button size="sm" onClick={() => void onSubmit()} loading={saveVerdict.isPending} disabled={!canSubmit}>
          {verdict ? t('Update exit verdict') : t('Record exit verdict')}
        </Button>
      </div>
    </>
  )
}
