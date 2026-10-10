import { useState } from 'react'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'

/**
 * Manual fallback for the kiosk (Face ID unavailable). Records through the audited
 * manual endpoint, so every fallback punch carries a reason that lands in the audit
 * log together with the issuing station session.
 */
export function ManualPanel({
  pending,
  errorMessage,
  onRecord,
  onBackToFace,
}: {
  pending: boolean
  errorMessage: string | null
  onRecord: (employeeNumber: string, type: 'IN' | 'OUT', reason: string) => void
  onBackToFace: () => void
}) {
  const [employeeNumber, setEmployeeNumber] = useState('')
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN')
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  const employeeError = touched && employeeNumber.trim() === '' ? 'Enter the employee number' : null
  const reasonError = touched && reason.trim().length < 3 ? 'Give a reason (at least 3 characters)' : null

  return (
    <form
      className="flex flex-col gap-2.5 p-3"
      onSubmit={(event) => {
        event.preventDefault()
        setTouched(true)
        if (employeeNumber.trim() === '' || reason.trim().length < 3) return
        onRecord(employeeNumber.trim(), direction, reason.trim())
      }}
      noValidate
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-charcoal-500">Employee ID *</span>
        <span className="text-[10px] text-charcoal-400">time auto - server clock</span>
      </div>
      <div>
        <Label htmlFor="manual-employee" className="sr-only">
          Employee ID
        </Label>
        <Input
          id="manual-employee"
          value={employeeNumber}
          onChange={(event) => setEmployeeNumber(event.target.value.toUpperCase())}
          maxLength={50}
          autoComplete="off"
          placeholder="e.g. EMP-1042"
          aria-invalid={Boolean(employeeError)}
          className="h-9 font-mono text-xs font-semibold uppercase"
        />
        {employeeError && (
          <p role="alert" className="mt-1 text-[10px] text-red-600">
            {employeeError}
          </p>
        )}
      </div>

      <div className="flex gap-1.5">
        {(['IN', 'OUT'] as const).map((option) => (
          <label key={option} className="flex-1 cursor-pointer">
            <input
              type="radio"
              name="manual-direction"
              value={option}
              checked={direction === option}
              onChange={() => setDirection(option)}
              className="peer sr-only"
            />
            <span className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-charcoal-200 text-xs font-bold text-charcoal-600 transition-all peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:text-brand-700">
              {option === 'IN' ? 'Check-in' : 'Check-out'}
            </span>
          </label>
        ))}
      </div>

      <div>
        <Label htmlFor="manual-reason" className="sr-only">
          Reason
        </Label>
        <Input
          id="manual-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          autoComplete="off"
          placeholder="Reason for manual entry (audited), e.g. Face ID camera offline"
          aria-invalid={Boolean(reasonError)}
          className="h-9 text-xs"
        />
        {reasonError && (
          <p role="alert" className="mt-1 text-[10px] text-red-600">
            {reasonError}
          </p>
        )}
      </div>

      {errorMessage && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMessage}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1" loading={pending}>
          Record
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onBackToFace}>
          Camera
        </Button>
      </div>
    </form>
  )
}