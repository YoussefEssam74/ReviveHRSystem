import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/button'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { Tabs, type TabItem } from '../../../components/ui/tabs'
import { useAllSeparations } from '../hooks/useTerminations'
import { useMe } from '../../../contexts/MeContext'
import { EDIT } from '../../../lib/permissions'
import { describeApiError } from '../../../lib/api-client'
import { InitiateSeparationDialog } from '../components/InitiateSeparationDialog'
import { TerminationRequestsTab } from '../components/TerminationRequestsTab'
import { ExitInterviewsTab } from '../components/ExitInterviewsTab'
import { ExitInterviewFormTab } from '../components/ExitInterviewFormTab'
import { FormerEmployeesTab } from '../components/FormerEmployeesTab'
import { FilterPill } from '../components/termination-ui'

type TerminationsTab =
  | 'requests'
  | 'interviews'
  | 'interviewForm'
  | 'formerEmployees'

export default function TerminationsPage() {
  const { t } = useTranslation()
  const { can, me } = useMe()
  const [gym, setGym] = useState('all')
  const [tab, setTab] = useState<TerminationsTab>('requests')
  const [requesting, setRequesting] = useState(false)
  const [selectedInterviewId, setSelectedInterviewId] = useState<number | null>(null)

  const canManage = can('offboarding', EDIT)
  const gymOptions = me?.gyms ?? []
  const activeGymName =
    gym === 'all'
      ? null
      : gymOptions.find((option) => String(option.gymId) === gym)?.gymName

  const { data: cases, isLoading, error, refetch } = useAllSeparations({
    gym: gym === 'all' ? undefined : Number(gym),
  })

  const requests = useMemo(
    () => (cases ?? []).filter((item) => item.separationType === 'Termination'),
    [cases],
  )

  const approvedExits = useMemo(
    () =>
      (cases ?? []).filter(
        (item) =>
          item.approvalStatus === 'Approved' &&
          item.status !== 'Completed' &&
          item.status !== 'Cancelled',
      ),
    [cases],
  )

  const formerEmployees = useMemo(
    // Completed = the employee was archived (by clearance or the legacy finalize).
    () => (cases ?? []).filter((item) => item.status === 'Completed'),
    [cases],
  )

  const openInterviewForm = (id: number) => {
    setSelectedInterviewId(id)
    setTab('interviewForm')
  }

  const openExitInterviews = (id: number) => {
    setSelectedInterviewId(id)
    setTab('interviews')
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
      value: 'interviewForm',
      label: t('Exit Interview'),
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
          <p className="mt-0.5 text-xs text-charcoal-500">
            {activeGymName
              ? t('Termination workflow · {{gym}}', { gym: activeGymName })
              : t('Termination workflow across all gyms')}
          </p>
        </div>
        {canManage && (
          <Button
            size="sm"
            variant="dangerOutline"
            onClick={() => setRequesting(true)}
          >
            + {t('Request Termination')}
          </Button>
        )}
      </div>

      <Tabs
        items={tabItems}
        value={tab}
        onChange={(nextTab) => {
          setTab(nextTab)
          if (nextTab !== 'interviewForm') setSelectedInterviewId(null)
        }}
        className="w-full"
      />

      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-charcoal-200 bg-white px-2 py-1.5">
        <span className="me-1 text-[10px] font-semibold uppercase tracking-wide text-charcoal-400">
          {t('Gym')}
        </span>
        <FilterPill active={gym === 'all'} onClick={() => setGym('all')}>
          {t('All Gyms')}
        </FilterPill>
        {gymOptions.map((option) => (
          <FilterPill
            key={option.gymId}
            active={gym === String(option.gymId)}
            onClick={() => setGym(String(option.gymId))}
          >
            {option.gymName}
          </FilterPill>
        ))}
      </div>

      {isLoading ? (
        <LoadingState label={t('Loading termination workflow…')} />
      ) : error ? (
        <ErrorState message={describeApiError(error)} onRetry={() => void refetch()} />
      ) : (
        <>
          {tab === 'requests' && (
            <TerminationRequestsTab
              cases={requests}
              canManage={canManage}
              onOpenInterviews={openExitInterviews}
            />
          )}
          {tab === 'interviews' && (
            <ExitInterviewsTab
              cases={approvedExits}
              canManage={canManage}
              onOpenForm={openInterviewForm}
            />
          )}
          {tab === 'interviewForm' && (
            <ExitInterviewFormTab
              separationId={selectedInterviewId}
              cases={approvedExits}
              canManage={canManage}
              onClear={() => setTab('interviews')}
            />
          )}
          {tab === 'formerEmployees' && (
            <FormerEmployeesTab cases={formerEmployees} />
          )}
        </>
      )}

      {requesting && (
        <InitiateSeparationDialog
          onClose={() => setRequesting(false)}
          onCreated={(id) => {
            setSelectedInterviewId(id)
            setTab('requests')
          }}
        />
      )}
    </div>
  )
}
