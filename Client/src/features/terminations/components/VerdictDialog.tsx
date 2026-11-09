import { useState } from 'react'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { Textarea } from '../../../components/ui/textarea'
import { useSaveVerdict } from '../hooks/useTerminations'
import { describeApiError } from '../../../lib/api-client'
import type { RehireStatus, SettlementDirection } from '../api/terminations.api'

const DIRECTIONS: { value: SettlementDirection; label: string }[] = [
  { value: 'none', label: 'No settlement' },
  { value: 'owedToEmployee', label: 'Owed to employee' },
  { value: 'employeeOwes', label: 'Employee owes' },
]

const REHIRE_OPTIONS: { value: RehireStatus; label: string }[] = [
  { value: 'Eligible', label: 'Eligible for rehire' },
  { value: 'Banned', label: 'Banned from rehire' },
]

export interface VerdictDialogProps {
  separationId: number
  employeeName: string
  onClose: () => void
}

/** T5 — record the exit verdict (final reason, settlement, rehire status). */
export function VerdictDialog({ separationId, employeeName, onClose }: VerdictDialogProps) {
  const saveVerdict = useSaveVerdict(separationId)
  const [finalReason, setFinalReason] = useState('')
  const [direction, setDirection] = useState<SettlementDirection>('none')
  const [amount, setAmount] = useState('')
  const [settlementNote, setSettlementNote] = useState('')
  const [rehireStatus, setRehireStatus] = useState<RehireStatus>('Eligible')
  const [rehireNote, setRehireNote] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const needsAmount = direction !== 'none'
  const canSubmit = finalReason.trim().length > 0 && (!needsAmount || amount.trim().length > 0)

  const onSubmit = async () => {
    setActionError(null)
    try {
      await saveVerdict.mutateAsync({
        finalReason: finalReason.trim(),
        settlement: {
          direction,
          amount: Number(amount) || 0,
          ...(settlementNote.trim() ? { note: settlementNote.trim() } : {}),
        },
        rehire: {
          status: rehireStatus,
          ...(rehireNote.trim() ? { note: rehireNote.trim() } : {}),
        },
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
      title="Exit verdict"
      description={employeeName}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={saveVerdict.isPending} disabled={!canSubmit}>
            Save verdict
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
          <Label htmlFor="final-reason">Final reason (required)</Label>
          <Textarea
            id="final-reason"
            rows={3}
            value={finalReason}
            onChange={(e) => setFinalReason(e.target.value)}
            placeholder="Summary of why the employment is ending…"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="settlement-direction">Settlement</Label>
            <Select
              id="settlement-direction"
              value={direction}
              onChange={(e) => setDirection(e.target.value as SettlementDirection)}
            >
              {DIRECTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="settlement-amount">Amount (EGP){needsAmount ? ' (required)' : ''}</Label>
            <Input
              id="settlement-amount"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!needsAmount}
              placeholder="0"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="settlement-note">Settlement note (optional)</Label>
          <Input
            id="settlement-note"
            value={settlementNote}
            onChange={(e) => setSettlementNote(e.target.value)}
            placeholder="Context for the settlement…"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="rehire-status">Rehire</Label>
            <Select id="rehire-status" value={rehireStatus} onChange={(e) => setRehireStatus(e.target.value as RehireStatus)}>
              {REHIRE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="rehire-note">Rehire note (optional)</Label>
            <Input id="rehire-note" value={rehireNote} onChange={(e) => setRehireNote(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-slate-500">Saving the verdict moves the case to “Under Review”.</p>
      </div>
    </Dialog>
  )
}
