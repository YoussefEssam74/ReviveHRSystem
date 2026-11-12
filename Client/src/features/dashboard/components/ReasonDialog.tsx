import { useState } from 'react'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Label } from '../../../components/ui/label'
import { Textarea } from '../../../components/ui/textarea'

export interface ReasonDialogProps {
  title: string
  description?: string
  label: string
  placeholder?: string
  confirmLabel: string
  /** Rejection-style flows require the note; informational ones allow it to be blank. */
  required?: boolean
  loading?: boolean
  onClose: () => void
  onConfirm: (note: string) => void
}

/** Small "why?" dialog used by the dashboard's Decline / flag actions. */
export default function ReasonDialog({
  title,
  description,
  label,
  placeholder,
  confirmLabel,
  required = true,
  loading,
  onClose,
  onConfirm,
}: ReasonDialogProps) {
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (required && !note.trim()) {
      setError('A reason is required.')
      return
    }
    setError(null)
    onConfirm(note.trim())
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="dangerOutline" onClick={submit} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div>
        {error && (
          <p role="alert" className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <Label htmlFor="reason-note">{label}</Label>
        <Textarea
          id="reason-note"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={placeholder}
        />
      </div>
    </Dialog>
  )
}
