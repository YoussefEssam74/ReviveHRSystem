import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { Tabs, type TabItem } from '../../../components/ui/tabs'
import { ConfirmDialog } from '../../../components/ui/modal'
import { useAllSeparations, useDecideTermination, useMoveStage } from '../hooks/useTerminations'
import { useMe } from '../../../contexts/MeContext'
import { EDIT } from '../../../lib/permissions'
import { describeApiError } from '../../../lib/api-client'
import { InitiateSeparationDialog } from '../components/InitiateSeparationDialog'
import { InitiateOffboardingDialog } from '../components/InitiateOffboardingDialog'
import { TerminationRequestsTab } from '../components/TerminationRequestsTab'
import { ExitInterviewsTab } from '../components/ExitInterviewsTab'
import { ExitInterviewFormTab } from '../components/ExitInterviewFormTab'
import { FormerEmployeesTab } from '../components/FormerEmployeesTab'
import { ExitsTab } from '../components/ExitsTab'
import { SeparationDetailDialog } from '../components/SeparationDetailDialog'
import { SEPARATION_STATUSES, type Separation } from '../api/terminations.api'

type TerminationsTab = 'exits' | 'requests' | 'interviews' | 'formerEmployees'

export default function TerminationsPage() {
  const { t } = useTranslation()
  const { can, me } = useMe()
  const [tab, setTab] = useState<TerminationsTab>('requests')
  const [requesting, setRequesting] = useState(false)
  const [offboardingOpen, setOffboardingOpen] = useState(false)
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null)
  const [interviewFormId, setInterviewFormId] = useState<number | null>(null)
  const [movingId, setMovingId] = useState<number | null>(null)
  const [completing, setCompleting] = useState<Separation | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const canManage = can('offboarding', EDIT)
  // Every console page follows the gym chosen at login (header switcher re-issues
  // the token), so there is no "all gyms" view to filter.
  const activeGymId = me?.activeGym?.gymId
  const activeGymName = me?.activeGym?.gymName

  const { data: cases, isLoading, error, refetch } = useAllSeparations({ gym: activeGymId })

  const moveStage = useMoveStage()
  const decide = useDecideTermination()

  const allCases = useMemo(() => cases ?? [], [cases])
  const boardCases = useMemo(() => allCases.filter((item) => item.status !== 'Cancelled'), [allCases])

  const requests = useMemo(
    () => allCases.filter((item) => item.separationType === 'Termination'),
    [allCases],
  )

  const approvedExits = useMemo(
    () =>
      allCases.filter(
        (item) =>
          item.approvalStatus === 'Approved' &&
          item.status !== 'Completed' &&
          item.status !== 'Cancelled',
      ),
    [allCases],
  )

  const formerEmployees = useMemo(
    // Completed = the employee was archived (by clearance or the legacy finalize).
    () => allCases.filter((item) => item.status === 'Completed'),
    [allCases],
  )

  const countText =
    boardCases.length === 1
      ? t('1 exit · {{gym}}', { gym: activeGymName ?? t('Active gym') })
      : t('{{count}} exits · {{gym}}', { count: boardCases.length, gym: activeGymName ?? t('Active gym') })

  const changeTab = (nextTab: TerminationsTab) => {
    setTab(nextTab)
    if (nextTab !== 'interviews') setInterviewFormId(null)
  }

  const openCreatedCase = (id: number) => {
    setTab('exits')
    setSelectedCaseId(id)
  }

  const moveTo = async (separation: Separation, target: string) => {
    setActionError(null)
    setMovingId(separation.id)
    try {
      await moveStage.mutateAsync({ id: separation.id, status: target })
    } catch (err) {
      setActionError(describeApiError(err))
    } finally {
      setMovingId(null)
    }
  }

  const onMove = (separation: Separation, direction: -1 | 1) => {
    const index = SEPARATION_STATUSES.indexOf(
      separation.status as (typeof SEPARATION_STATUSES)[number],
    )
    if (index < 0) return
    const target = SEPARATION_STATUSES[index + direction] as string | undefined
    if (!target) return

    if (target === 'Completed') {
      setCompleting(separation)
      return
    }

    // A BM request leaves Requested only once HR approves it. Approving from the
    // board is the same decision as the Requests tab, without a second screen.
    if (
      direction === 1 &&
      separation.status === 'Requested' &&
      separation.separationType === 'Termination' &&
      separation.approvalStatus === 'Pending'
    ) {
      setActionError(null)
      setMovingId(separation.id)
      decide
        .mutateAsync({ id: separation.id, body: { decision: 'Approved' } })
        .catch((err) => setActionError(describeApiError(err)))
        .finally(() => setMovingId(null))
      return
    }

    void moveTo(separation, target)
  }

  const confirmComplete = async () => {
    if (!completing) return
    setActionError(null)
    setMovingId(completing.id)
    try {
      await moveStage.mutateAsync({ id: completing.id, status: 'Completed' })
      setCompleting(null)
    } catch (err) {
      setActionError(describeApiError(err))
    } finally {
      setMovingId(null)
    }
  }

  const tabItems: TabItem<TerminationsTab>[] = [
    {
      value: 'requests',
      label: t('Termination Requests'),
      count: requests.length,
    },
    {
      value: 'interviews',
      label: t('Exit Interviews'),
      count: approvedExits.length,
    },
    {
      value: 'exits',
      label: t('Exits'),
      count: boardCases.length,
    },
    {
      value: 'formerEmployees',
      label: t('Former Employees'),
      count: formerEmployees.length,
    },
  ]

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-charcoal-900">{t('Terminations')}</h1>
          <p className="mt-0.5 text-xs text-charcoal-500">{countText}</p>
        </div>
        {canManage && (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <Button size="sm" variant="dangerOutline" onClick={() => setRequesting(true)}>
              + {t('Request Termination (BM)')}
            </Button>
            <Button size="sm" onClick={() => setOffboardingOpen(true)}>
              + {t('Initiate Offboarding')}
            </Button>
          </div>
        )}
      </div>

      <Tabs items={tabItems} value={tab} onChange={changeTab} variant="compact" />

      {actionError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {actionError}
        </p>
      )}

      {isLoading ? (
        <LoadingState label={t('Loading termination workflow…')} />
      ) : error ? (
        <ErrorState message={describeApiError(error)} onRetry={() => void refetch()} />
      ) : (
        <>
          {tab === 'exits' && (
            <ExitsTab
              cases={allCases}
              canManage={canManage}
              movingId={movingId}
              onOpen={setSelectedCaseId}
              onMove={onMove}
            />
          )}
          {tab === 'requests' && (
            <TerminationRequestsTab
              cases={requests}
              canManage={canManage}
              onOpenInterviews={() => changeTab('interviews')}
            />
          )}
          {tab === 'interviews' &&
            (interviewFormId == null ? (
              <ExitInterviewsTab
                cases={approvedExits}
                canManage={canManage}
                onOpenForm={setInterviewFormId}
              />
            ) : (
              <div className="space-y-2.5">
                <Button variant="secondary" size="sm" onClick={() => setInterviewFormId(null)}>
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                  {t('Back to exit interviews')}
                </Button>
                <ExitInterviewFormTab
                  separationId={interviewFormId}
                  cases={approvedExits}
                  canManage={canManage}
                  onClear={() => setInterviewFormId(null)}
                />
              </div>
            ))}
          {tab === 'formerEmployees' && <FormerEmployeesTab cases={formerEmployees} />}
        </>
      )}

      {selectedCaseId != null && (
        <SeparationDetailDialog
          separationId={selectedCaseId}
          canManage={canManage}
          onClose={() => setSelectedCaseId(null)}
        />
      )}

      {requesting && (
        <InitiateSeparationDialog
          onClose={() => setRequesting(false)}
          onCreated={(id) => {
            setRequesting(false)
            openCreatedCase(id)
          }}
        />
      )}

      {offboardingOpen && (
        <InitiateOffboardingDialog
          onClose={() => setOffboardingOpen(false)}
          onCreated={(id) => {
            setOffboardingOpen(false)
            openCreatedCase(id)
          }}
        />
      )}

      <ConfirmDialog
        open={completing != null}
        title={t('Complete separation')}
        message={
          completing
            ? t(
                'Moving {{name}} to Completed archives the employee, deactivates their login and completes every exit step. This cannot be undone.',
                { name: completing.employee },
              )
            : ''
        }
        confirmLabel={t('Complete separation')}
        danger
        loading={moveStage.isPending}
        onConfirm={() => void confirmComplete()}
        onCancel={() => setCompleting(null)}
      />
    </div>
  )
}
