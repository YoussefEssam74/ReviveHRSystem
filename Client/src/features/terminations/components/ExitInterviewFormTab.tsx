import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardCheck, ShieldAlert } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'
import { Input, Select, Textarea } from '../../../components/ui/field'
import { Label } from '../../../components/ui/label'
import { describeApiError } from '../../../lib/api-client'
import { useSaveClearance, useSaveExitInterview, useSeparation } from '../hooks/useTerminations'
import type { Separation } from '../api/terminations.api'
import { EmployeeSummary, FormSection } from './termination-ui'

export interface ExitInterviewFormTabProps {
  separationId: number | null
  cases: Separation[]
  canManage: boolean
  onClear: () => void
}

export function ExitInterviewFormTab({
  separationId,
  cases,
  canManage,
  onClear,
}: ExitInterviewFormTabProps) {
  const { t } = useTranslation()
  const fromList = cases.find((item) => item.id === separationId) ?? null
  const detail = useSeparation(separationId ?? 0)
  const separation = detail.data ?? fromList
  const saveInterview = useSaveExitInterview()
  const saveClearance = useSaveClearance()
  const [actionError, setActionError] = useState<string | null>(null)

  const interview = separation?.exitInterview
  const clearance = separation?.clearance
  const [interviewer, setInterviewer] = useState('')
  const [interviewDate, setInterviewDate] = useState('')
  const [reason, setReason] = useState('')
  const [liked, setLiked] = useState('')
  const [improve, setImprove] = useState('')
  const [jobSatisfaction, setJobSatisfaction] = useState('3')
  const [managementRating, setManagementRating] = useState('3')
  const [environmentRating, setEnvironmentRating] = useState('3')
  const [compensationRating, setCompensationRating] = useState('3')
  const [wouldRecommend, setWouldRecommend] = useState('true')
  const [rehireEligible, setRehireEligible] = useState('true')
  const [rehireNote, setRehireNote] = useState('')
  const [notes, setNotes] = useState('')
  const [blacklisted, setBlacklisted] = useState(false)
  const [blacklistReason, setBlacklistReason] = useState('')

  const [uniformReturned, setUniformReturned] = useState(false)
  const [assetsReturned, setAssetsReturned] = useState(false)
  const [accessRevoked, setAccessRevoked] = useState(false)
  const [finalSettlement, setFinalSettlement] = useState(false)
  const [settlementDirection, setSettlementDirection] = useState<'none' | 'owedToEmployee' | 'employeeOwes'>('none')
  const [settlementAmount, setSettlementAmount] = useState('0')
  const [clearanceNotes, setClearanceNotes] = useState('')

  useEffect(() => {
    if (!separation) return
    setInterviewer(interview?.interviewer ?? '')
    setInterviewDate(interview?.interviewDate ?? '')
    setReason(interview?.reasonForLeaving ?? separation.reason ?? '')
    setLiked(interview?.whatLikedMost ?? '')
    setImprove(interview?.whatToImprove ?? '')
    setJobSatisfaction(String(interview?.jobSatisfaction ?? 3))
    setManagementRating(String(interview?.managementRating ?? 3))
    setEnvironmentRating(String(interview?.workEnvironmentRating ?? 3))
    setCompensationRating(String(interview?.compensationRating ?? 3))
    setWouldRecommend(interview?.wouldRecommend == null ? 'true' : String(interview.wouldRecommend))
    setRehireEligible(interview?.rehireEligible == null ? 'true' : String(interview.rehireEligible))
    setRehireNote(interview?.rehireNote ?? '')
    setNotes(interview?.notes ?? '')
    setBlacklisted(separation.blacklisted)
    setBlacklistReason(separation.blacklistReason ?? '')
    setUniformReturned(clearance?.uniformReturned ?? false)
    setAssetsReturned(clearance?.assetsReturned ?? false)
    setAccessRevoked(clearance?.accessRevoked ?? false)
    setFinalSettlement(clearance?.finalSettlementCompleted ?? false)
    setSettlementDirection((clearance?.settlementDirection as typeof settlementDirection) ?? 'none')
    setSettlementAmount(String(clearance?.settlementAmount ?? 0))
    setClearanceNotes(clearance?.notes ?? '')
  }, [separation?.id])

  if (!separation) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title={t('No exit interview selected')}
        message={t('Choose an approved case from Exit Interviews to conduct and complete the interview.')}
        action={
          <Button variant="secondary" onClick={onClear}>
            {t('Back to exit interviews')}
          </Button>
        }
      />
    )
  }

  const isClosed = separation.status === 'Completed' || separation.clearance?.completed === true
  const editable = canManage && !isClosed

  const saveInterviewForm = async (complete: boolean) => {
    setActionError(null)
    try {
      await saveInterview.mutateAsync({
        id: separation.id,
        body: {
          interviewer: interviewer.trim() || undefined,
          interviewDate: interviewDate || undefined,
          reasonForLeaving: reason.trim() || undefined,
          whatLikedMost: liked.trim() || undefined,
          whatToImprove: improve.trim() || undefined,
          jobSatisfaction: Number(jobSatisfaction),
          managementRating: Number(managementRating),
          workEnvironmentRating: Number(environmentRating),
          compensationRating: Number(compensationRating),
          wouldRecommend: wouldRecommend === 'true',
          notes: notes.trim() || undefined,
          rehireEligible: rehireEligible === 'true',
          rehireNote: rehireNote.trim() || undefined,
          blacklisted,
          blacklistReason: blacklisted ? blacklistReason.trim() || undefined : undefined,
          complete,
        },
      })
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  const completeClearance = async () => {
    setActionError(null)
    try {
      await saveClearance.mutateAsync({
        id: separation.id,
        body: {
          uniformReturned,
          assetsReturned,
          accessRevoked,
          finalSettlementCompleted: finalSettlement,
          settlementDirection,
          settlementAmount: Number(settlementAmount || 0),
          notes: clearanceNotes.trim() || undefined,
          complete: true,
        },
      })
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  const ratingOptions = (
    <>
      {[1, 2, 3, 4, 5].map((value) => (
        <option key={value} value={value}>
          {value}
        </option>
      ))}
    </>
  )

  return (
    <div className="space-y-2.5">
      {actionError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {actionError}
        </p>
      )}

      <EmployeeSummary separation={separation} />

      <FormSection
        title={t('Employee information')}
        description={t('Basic employee details for the exit interview record.')}
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div>
            <Label>{t('Employee number')}</Label>
            <Input value={separation.employeeNumber ?? '—'} disabled />
          </div>
          <div>
            <Label>{t('Position')}</Label>
            <Input value={separation.position} disabled />
          </div>
          <div>
            <Label>{t('Branch')}</Label>
            <Input value={separation.gym} disabled />
          </div>
        </div>
      </FormSection>

      <FormSection
        title={t('Interview details')}
        description={t('Document who conducted the interview, when it happened and why the employee is leaving.')}
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div>
            <Label htmlFor="exit-interviewer">{t('Interviewer')}</Label>
            <Input
              id="exit-interviewer"
              value={interviewer}
              onChange={(event) => setInterviewer(event.target.value)}
              disabled={!editable}
              placeholder={t('HR interviewer name')}
            />
          </div>
          <div>
            <Label htmlFor="exit-interview-date">{t('Interview date')}</Label>
            <Input
              id="exit-interview-date"
              type="date"
              value={interviewDate}
              onChange={(event) => setInterviewDate(event.target.value)}
              disabled={!editable}
            />
          </div>
          <div>
            <Label htmlFor="reason-for-leaving">{t('Reason for leaving')}</Label>
            <Input
              id="reason-for-leaving"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={!editable}
            />
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <Label htmlFor="liked-most">{t('What did the employee value most?')}</Label>
            <Textarea
              id="liked-most"
              rows={3}
              value={liked}
              onChange={(event) => setLiked(event.target.value)}
              disabled={!editable}
              placeholder={t('Positive experience, culture, colleagues, management…')}
            />
          </div>
          <div>
            <Label htmlFor="improve">{t('What should the organization improve?')}</Label>
            <Textarea
              id="improve"
              rows={3}
              value={improve}
              onChange={(event) => setImprove(event.target.value)}
              disabled={!editable}
              placeholder={t('Policy, workload, pay, training, leadership…')}
            />
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            [t('Job satisfaction'), jobSatisfaction, setJobSatisfaction],
            [t('Management'), managementRating, setManagementRating],
            [t('Work environment'), environmentRating, setEnvironmentRating],
            [t('Compensation'), compensationRating, setCompensationRating],
          ].map(([label, value, setter]) => (
            <div key={String(label)}>
              <Label>{String(label)}</Label>
              <Select
                value={String(value)}
                onChange={(event) => (setter as (value: string) => void)(event.target.value)}
                disabled={!editable}
              >
                {ratingOptions}
              </Select>
            </div>
          ))}
        </div>

        <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <Label htmlFor="would-recommend">{t('Would recommend the company?')}</Label>
            <Select
              id="would-recommend"
              value={wouldRecommend}
              onChange={(event) => setWouldRecommend(event.target.value)}
              disabled={!editable}
            >
              <option value="true">{t('Yes')}</option>
              <option value="false">{t('No')}</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="interview-notes">{t('Additional interview notes')}</Label>
            <Textarea
              id="interview-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={!editable}
            />
          </div>
        </div>
      </FormSection>

      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <FormSection
          title={t('Rehire eligibility')}
          description={t('HR records whether this employee may be considered in the future.')}
        >
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <Label htmlFor="rehire-status">{t('Eligible for rehire')}</Label>
              <Select
                id="rehire-status"
                value={rehireEligible}
                onChange={(event) => setRehireEligible(event.target.value)}
                disabled={!editable}
              >
                <option value="true">{t('Eligible')}</option>
                <option value="false">{t('Not eligible')}</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="rehire-note">{t('Rehire note')}</Label>
              <Input
                id="rehire-note"
                value={rehireNote}
                onChange={(event) => setRehireNote(event.target.value)}
                disabled={!editable}
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          title={t('Blacklist status')}
          description={t('Use only for a documented HR/security hold.')}
        >
          <label className="flex items-start gap-2 text-xs text-charcoal-700">
            <input
              type="checkbox"
              checked={blacklisted}
              onChange={(event) => setBlacklisted(event.target.checked)}
              disabled={!editable}
              className="mt-0.5 h-4 w-4 accent-red-600"
            />
            <span>
              <span className="font-semibold">{t('Blacklist employee')}</span>
              <span className="mt-0.5 block text-[11px] text-charcoal-500">
                {t('Blocks rehire consideration and is visible in the employee exit record.')}
              </span>
            </span>
          </label>
          {blacklisted && (
            <div className="mt-2">
              <Label htmlFor="blacklist-reason">{t('Blacklist reason')}</Label>
              <Textarea
                id="blacklist-reason"
                rows={2}
                value={blacklistReason}
                onChange={(event) => setBlacklistReason(event.target.value)}
                disabled={!editable}
              />
            </div>
          )}
        </FormSection>
      </div>

      {editable && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => void saveInterviewForm(false)}
            loading={saveInterview.isPending}
          >
            {t('Save interview')}
          </Button>
          <Button
            onClick={() => void saveInterviewForm(true)}
            loading={saveInterview.isPending}
          >
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            {t('Complete exit interview')}
          </Button>
        </div>
      )}

      <FormSection
        title={t('Clearance & final settlement')}
        description={t('Complete both the exit interview and all clearance items before the employee moves to Former Employees.')}
        action={
          separation.exitInterviewStatus === 'Completed'
            ? <span className="badge badge-green">{t('Interview complete')}</span>
            : <span className="badge badge-yellow">{t('Interview pending')}</span>
        }
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [t('Uniform returned'), uniformReturned, setUniformReturned],
            [t('Assets returned'), assetsReturned, setAssetsReturned],
            [t('System access revoked'), accessRevoked, setAccessRevoked],
            [t('Final settlement completed'), finalSettlement, setFinalSettlement],
          ].map(([label, checked, setter]) => (
            <label key={String(label)} className="flex items-center gap-2 rounded-lg bg-charcoal-50 px-3 py-2 text-xs text-charcoal-700">
              <input
                type="checkbox"
                checked={Boolean(checked)}
                onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)}
                disabled={!editable}
                className="h-4 w-4 accent-brand-600"
              />
              {String(label)}
            </label>
          ))}
        </div>

        <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div>
            <Label htmlFor="settlement-direction">{t('Settlement')}</Label>
            <Select
              id="settlement-direction"
              value={settlementDirection}
              onChange={(event) => setSettlementDirection(event.target.value as typeof settlementDirection)}
              disabled={!editable}
            >
              <option value="none">{t('No settlement')}</option>
              <option value="owedToEmployee">{t('Owed to employee')}</option>
              <option value="employeeOwes">{t('Employee owes')}</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="settlement-amount">{t('Amount (EGP)')}</Label>
            <Input
              id="settlement-amount"
              type="number"
              min="0"
              step="0.01"
              value={settlementAmount}
              onChange={(event) => setSettlementAmount(event.target.value)}
              disabled={!editable}
            />
          </div>
          <div>
            <Label htmlFor="clearance-notes">{t('Clearance notes')}</Label>
            <Textarea
              id="clearance-notes"
              rows={2}
              value={clearanceNotes}
              onChange={(event) => setClearanceNotes(event.target.value)}
              disabled={!editable}
            />
          </div>
        </div>

        {editable && (
          <div className="mt-2.5 flex justify-end">
            <Button
              variant="danger"
              onClick={() => void completeClearance()}
              loading={saveClearance.isPending}
              disabled={
                !uniformReturned ||
                !assetsReturned ||
                !accessRevoked ||
                !finalSettlement ||
                separation.exitInterviewStatus !== 'Completed'
              }
            >
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              {t('Complete clearance & move to Former Employees')}
            </Button>
          </div>
        )}
      </FormSection>
    </div>
  )
}
