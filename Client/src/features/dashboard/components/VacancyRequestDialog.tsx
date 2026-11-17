import { useState } from 'react'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Label } from '../../../components/ui/label'
import { Textarea } from '../../../components/ui/textarea'
import { describeApiError } from '../../../lib/api-client'
import type { HrDashboardAction } from '../api/dashboard.api'
import { useDashboardVacancyDecision } from '../hooks/useDashboard'
import type { ToastTone } from '../hooks/useMockToast'

export interface VacancyRequestDialogProps {
  action: HrDashboardAction
  onClose: () => void
  toast: (message: string, tone?: ToastTone) => void
}

/** Approve / decline a Branch Manager vacancy request, with the decline reason. */
export default function VacancyRequestDialog({ action, onClose, toast }: VacancyRequestDialogProps) {
  const [declining, setDeclining] = useState(false)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const decide = useDashboardVacancyDecision()

  const submit = async (decision: 'Approved' | 'Rejected') => {
    setError(null)
    if (decision === 'Rejected' && !comment.trim()) {
      setError('A decline reason is required.')
      return
    }
    try {
      await decide.mutateAsync({ id: action.refId, body: { decision, comment: comment.trim() || undefined } })
      toast(decision === 'Approved' ? 'Vacancy approved — the position is now open.' : 'Vacancy request declined.', decision === 'Approved' ? 'success' : 'info')
      onClose()
    } catch (err) {
      setError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Vacancy Request"
      description={`${action.title} · ${action.gym ?? 'Branch'}`}
      className="sm:max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {declining ? (
            <Button variant="dangerOutline" onClick={() => submit('Rejected')} loading={decide.isPending}>
              Decline request
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setDeclining(true)}>
                Decline
              </Button>
              <Button onClick={() => submit('Approved')} loading={decide.isPending}>
                Approve vacancy
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="space-y-3 text-xs">
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="space-y-1.5 rounded-lg border border-charcoal-200 bg-charcoal-50 p-3">
          <div className="flex justify-between">
            <span className="text-charcoal-500">Position</span>
            <b className="text-charcoal-900">{action.title}</b>
          </div>
          <div className="flex justify-between">
            <span className="text-charcoal-500">Branch</span>
            <b className="text-charcoal-900">{action.gym ?? '—'}</b>
          </div>
          <div className="flex justify-between">
            <span className="text-charcoal-500">Headcount</span>
            <b className="text-charcoal-900">{action.subtitle}</b>
          </div>
          <div className="flex justify-between">
            <span className="text-charcoal-500">Submitted</span>
            <b className="text-charcoal-900">{new Date(action.date).toLocaleDateString()}</b>
          </div>
          <div className="border-t border-charcoal-200 pt-1.5">
            <span className="text-charcoal-500">Reason</span>
            <p className="mt-0.5 text-charcoal-800">{action.detail || '—'}</p>
          </div>
        </div>

        {declining && (
          <div>
            <Label htmlFor="vacancy-comment">Decline reason (required)</Label>
            <Textarea
              id="vacancy-comment"
              rows={2}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Why is this request being declined?"
            />
          </div>
        )}
      </div>
    </Dialog>
  )
}
