import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, Phone } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { Dialog } from '../../../components/ui/dialog'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { useBlockCandidate, useCandidate, useMoveCandidateStage } from '../hooks/useRecruitment'
import { describeApiError } from '../../../lib/api-client'
import { formatDate } from '../../../lib/format'
import { CANDIDATE_STAGES, type CandidateInterview } from '../api/recruitment.api'

function InterviewRound({ label, interview }: { label: string; interview: CandidateInterview | null }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {interview?.verdict && <StatusBadge status={interview.verdict} />}
      </div>
      {interview ? (
        <p className="mt-0.5 text-xs text-slate-500">
          {formatDate(interview.date)}
          {interview.by ? ` · ${interview.by}` : ''}
          {interview.type ? ` · ${interview.type}` : ''}
          {interview.room ? ` · ${interview.room}` : ''}
        </p>
      ) : (
        <p className="mt-0.5 text-xs text-slate-500">{t('Not scheduled.')}</p>
      )}
    </div>
  )
}

export interface CandidateDetailDialogProps {
  candidateId: number
  /** recruitment Edit — stage moves and block/unblock. */
  canManage: boolean
  onClose: () => void
}

/** The §5.2 applicant pane: card data, stage move and block/unblock. */
export function CandidateDetailDialog({ candidateId, canManage, onClose }: CandidateDetailDialogProps) {
  const { t } = useTranslation()
  const { data: candidate, isLoading, error } = useCandidate(candidateId)
  const moveStage = useMoveCandidateStage()
  const block = useBlockCandidate()
  const [targetStage, setTargetStage] = useState('')
  const [blockReason, setBlockReason] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const onMoveStage = async () => {
    if (!candidate?.applicationId || !targetStage || targetStage === candidate.stage || targetStage === 'Hired') return
    setActionError(null)
    try {
      await moveStage.mutateAsync({ applicationId: candidate.applicationId, stage: targetStage })
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  const onSetBlocked = async (blocked: boolean) => {
    if (!candidate) return
    setActionError(null)
    try {
      await block.mutateAsync({
        id: candidate.id,
        blocked,
        ...(blocked && blockReason.trim() ? { blockReason: blockReason.trim() } : {}),
      })
      setBlockReason('')
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={candidate ? candidate.name : t('Candidate')}
      description={candidate ? candidate.position : undefined}
      className="sm:max-w-2xl"
      footer={
        <Button variant="outline" onClick={onClose}>
          {t('Close')}
        </Button>
      }
    >
      {isLoading ? (
        <LoadingState label={t('Loading candidate…')} />
      ) : error ? (
        <ErrorState message={describeApiError(error)} />
      ) : candidate ? (
        <div className="space-y-5">
          {actionError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={candidate.stage} />
            {candidate.blocked && <Badge>{t('Banned')}</Badge>}
            {candidate.rating != null && <Badge>{t('Rating {{rating}}', { rating: candidate.rating })}</Badge>}
            <Badge>{t('Applied {{date}}', { date: formatDate(candidate.appliedDate) })}</Badge>
          </div>

          {candidate.blocked && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {candidate.blockReason
                ? t('This candidate is blocked: {{reason}}', { reason: candidate.blockReason })
                : t('This candidate is blocked.')}
            </p>
          )}

          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <p className="flex items-center gap-2 text-sm text-slate-700">
              <Phone className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              {candidate.phone ?? '—'}
            </p>
            <p className="flex items-center gap-2 text-sm text-slate-700">
              <Mail className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              {candidate.form?.email ?? '—'}
            </p>
            <p className="text-sm text-slate-700">{t('Experience: {{years}} years', { years: candidate.form?.expYears ?? 0 })}</p>
            <p className="text-sm text-slate-700">{t('Education: {{value}}', { value: candidate.form?.education || '—' })}</p>
            <p className="text-sm text-slate-700">{t('Preferred shift: {{value}}', { value: candidate.form?.shift ?? '—' })}</p>
            <p className="text-sm text-slate-700">{t('Salary expectation: {{value}}', { value: candidate.form?.salaryExp ?? '—' })}</p>
            <p className="text-sm text-slate-700">{t('Availability: {{value}}', { value: candidate.form?.availability ?? '—' })}</p>
            <p className="text-sm text-slate-700">{t('Source: {{value}}', { value: candidate.form?.source ?? '—' })}</p>
          </div>

          {((candidate.form?.skills?.length ?? 0) > 0 || (candidate.form?.languages?.length ?? 0) > 0) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {(candidate.form?.skills ?? []).map((skill) => (
                <Badge key={`skill-${skill}`}>{skill}</Badge>
              ))}
              {(candidate.form?.languages ?? []).map((language) => (
                <Badge key={`language-${language}`}>{language}</Badge>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InterviewRound label={t('Screening')} interview={candidate.screen} />
            <InterviewRound label={t('First interview')} interview={candidate.iv1} />
            <InterviewRound label={t('Second interview')} interview={candidate.iv2} />
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">{t('Decision')}</p>
                {candidate.decision?.verdict && <StatusBadge status={candidate.decision.verdict} />}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {candidate.decision
                  ? `${formatDate(candidate.decision.date)}${candidate.decision.by ? ` · ${candidate.decision.by}` : ''}`
                  : t('No decision yet.')}
              </p>
            </div>
          </div>

          {canManage && (
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('Pipeline actions')}</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="target-stage">{t('Move to stage')}</Label>
                  <div className="flex gap-2">
                    <Select
                      id="target-stage"
                      value={targetStage || candidate.stage}
                      onChange={(e) => setTargetStage(e.target.value)}
                      disabled={candidate.stage === 'Hired' || !candidate.applicationId}
                    >
                      {CANDIDATE_STAGES.map((stage) => (
                        <option key={stage} value={stage} disabled={stage === 'Hired'}>
                          {stage === 'Hired' ? t('Hired (hire wizard only)') : t(stage)}
                        </option>
                      ))}
                    </Select>
                    <Button
                      variant="outline"
                      onClick={onMoveStage}
                      loading={moveStage.isPending}
                      disabled={
                        candidate.stage === 'Hired' ||
                        !candidate.applicationId ||
                        !targetStage ||
                        targetStage === candidate.stage ||
                        targetStage === 'Hired'
                      }
                    >
                      {t('Move')}
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {!candidate.applicationId
                      ? t('This card has no linked application, so its stage cannot move.')
                      : candidate.stage === 'Hired'
                        ? t('This candidate is already hired.')
                        : t('Hired is only reachable through the hire wizard.')}
                  </p>
                </div>
                <div>
                  <Label htmlFor="block-reason">{candidate.blocked ? t('Unblock') : t('Block candidate')}</Label>
                  {candidate.blocked ? (
                    <Button variant="outline" onClick={() => onSetBlocked(false)} loading={block.isPending}>
                      {t('Unblock candidate')}
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        id="block-reason"
                        value={blockReason}
                        onChange={(e) => setBlockReason(e.target.value)}
                        placeholder={t('Reason (optional)')}
                      />
                      <Button variant="danger" onClick={() => onSetBlocked(true)} loading={block.isPending}>
                        {t('Block')}
                      </Button>
                    </div>
                  )}
                  <p className="mt-1 text-xs text-slate-500">{t('Blocked candidates leave the active pipeline.')}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </Dialog>
  )
}
