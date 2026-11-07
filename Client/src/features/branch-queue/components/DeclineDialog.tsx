import { useState } from 'react'
import { Button } from '../../../components/ui/button'
import { Label } from '../../../components/ui/label'
import { Textarea } from '../../../components/ui/textarea'
import { Dialog } from '../../../components/ui/dialog'
import { describeApiError } from '../../../lib/api-client'

interface DeclineDialogProps {
  /** "warning" | "bonus" — heading + copy. */
  kind: string
  /** Employee + item detail shown in the summary block. */
  subject: string
  /** Extra detail line (amount/reason) under the subject. */
  detail?: string
  onClose: () => void
  /** Rejects the item; the dialog surfaces any API error inline. */
  onConfirm: (note: string) => Promise<void>
}

/**
 * Decline a branch-submitted item with a required reason (server-side rule:
 * rejecting a warning/bonus always needs a note). Nothing is applied to payroll
 * or the employee record — the item returns to the submitter.
 */
export function DeclineDialog({ kind, subject, detail, onClose, onConfirm }: DeclineDialogProps) {
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const valid = note.trim().length > 0

  const submit = async () => {
    if (!valid) return
    setError(null)
    setPending(true)
    try {
      await onConfirm(note.trim())
      onClose()
    } catch (err) {
      setError(describeApiError(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Decline ${kind}`}
      className="sm:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={pending} disabled={!valid}>
            Decline item
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-900">{subject}</p>
          {detail && <p className="mt-0.5 text-xs text-slate-600">{detail}</p>}
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs leading-relaxed text-red-700">
          Declining returns the item to the Branch Manager with your reason. Nothing is applied to payroll or the
          employee record.
        </div>

        <div>
          <Label htmlFor="decline-reason">
            Reason for declining <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="decline-reason"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Amount exceeds branch budget — resubmit with area manager approval"
            className="mt-1"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  )
}
