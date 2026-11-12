import { useState } from 'react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Textarea } from '../../../components/ui/textarea'
import { describeApiError } from '../../../lib/api-client'
import { formatDate, formatEGP } from '../../../lib/format'
import { useReviewBonus, useReviewDeduction, useReviewWarning } from '../../branch-queue/hooks/useBranchQueue'

export type BranchKind = 'Deduction' | 'Warning' | 'Bonus'

/** A Branch Manager submission merged into the inbox (mock's Deductions/Warnings/Bonuses pills). */
export interface BranchSubmission {
  id: number
  kind: BranchKind
  employee: string
  title: string
  amount: number | null
  issuedBy: string | null
  gym: string | null
  date: string
  status: string
}

const KIND_BADGE: Record<BranchKind, { label: string; color: 'yellow' | 'red' | 'green' }> = {
  Deduction: { label: 'Deduction', color: 'yellow' },
  Warning: { label: 'Warning', color: 'red' },
  Bonus: { label: 'Bonus', color: 'green' },
}

export interface BranchSubmissionCardProps {
  submission: BranchSubmission
  canDecide: boolean
  /** Deduction decisions ride payroll.edit; warning/bonus decisions ride requests.approve. */
  canDecideDeduction: boolean
  onError?: (message: string) => void
}

/** Approve / Decline one branch submission without leaving the inbox. */
export function BranchSubmissionCard({ submission, canDecide, canDecideDeduction, onError }: BranchSubmissionCardProps) {
  const [declining, setDeclining] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const reviewWarning = useReviewWarning()
  const reviewBonus = useReviewBonus()
  const reviewDeduction = useReviewDeduction()

  const pending = submission.status === 'Pending'
  const allowed = submission.kind === 'Deduction' ? canDecideDeduction : canDecide
  const busy = reviewWarning.isPending || reviewBonus.isPending || reviewDeduction.isPending
  const badge = KIND_BADGE[submission.kind]

  const decide = async (approved: boolean) => {
    if (!approved && !note.trim()) {
      setError('A decline reason is required.')
      return
    }
    setError(null)
    try {
      if (submission.kind === 'Deduction') {
        await reviewDeduction.mutateAsync({
          id: submission.id,
          decision: approved ? 'Accepted' : 'Rejected',
        })
      } else if (submission.kind === 'Warning') {
        await reviewWarning.mutateAsync({
          id: submission.id,
          body: { decision: approved ? 'Approved' : 'Rejected', note: note.trim() || undefined },
        })
      } else {
        await reviewBonus.mutateAsync({
          id: submission.id,
          body: { decision: approved ? 'Approved' : 'Rejected', note: note.trim() || undefined },
        })
      }
      setDeclining(false)
      setNote('')
    } catch (err) {
      const message = describeApiError(err)
      setError(message)
      onError?.(message)
    }
  }

  return (
    <div className="rounded-xl border border-charcoal-200 bg-white px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color={badge.color} className="text-[9px]">
              {badge.label}
            </Badge>
            <span className="text-[11px] font-bold text-charcoal-900">{submission.employee}</span>
            <span className="text-[10px] text-charcoal-600">
              {submission.title}
              {submission.amount != null ? ` · ${formatEGP(submission.amount)}` : ''}
            </span>
          </div>
          <p className="mt-0.5 text-[9px] text-charcoal-400">
            Sent by {submission.issuedBy ?? 'Branch Manager'}
            {submission.gym ? ` · ${submission.gym}` : ''} · {formatDate(submission.date)}
          </p>
        </div>

        {pending ? (
          allowed ? (
            <div className="flex flex-shrink-0 gap-1.5">
              <Button size="sm" variant="success" className="h-7 px-3 text-[11px]" onClick={() => decide(true)} loading={busy}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-3 text-[11px] text-charcoal-500 hover:text-red-600"
                onClick={() => setDeclining((open) => !open)}
              >
                Decline
              </Button>
            </div>
          ) : (
            <Badge status="Pending" className="text-[9px]">
              Pending
            </Badge>
          )
        ) : (
          <Badge status={submission.status} className="text-[9px]">
            {submission.status}
          </Badge>
        )}
      </div>

      {declining && pending && allowed && (
        <div className="mt-2 space-y-1.5">
          <Textarea
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Why is this being declined?"
            className="text-[11px]"
          />
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setDeclining(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="dangerOutline"
              className="h-7 text-[11px]"
              onClick={() => decide(false)}
              loading={busy}
            >
              Decline
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-1.5 text-[10px] font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
