import { useQuery } from '@tanstack/react-query'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { describeApiError } from '../../../lib/api-client'
import { getVacancies } from '../../recruitment/api/recruitment.api'
import type { HrDashboardBranch } from '../api/dashboard.api'

export interface GymsOverviewDialogProps {
  branches: HrDashboardBranch[]
  onClose: () => void
}

/** Branches oversight detail (mock openGymsOverviewModal): headcount, actions, open vacancies. */
export default function GymsOverviewDialog({ branches, onClose }: GymsOverviewDialogProps) {
  const vacancies = useQuery({
    queryKey: ['vacancies', { status: 'Open', pageSize: 100 }],
    queryFn: ({ signal }) => getVacancies({ status: 'Open', page: 1, pageSize: 100 }, signal),
  })

  const openByBranch = new Map<string, number>()
  for (const vacancy of vacancies.data?.items ?? []) {
    const key = vacancy.gym
    openByBranch.set(key, (openByBranch.get(key) ?? 0) + 1)
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Branches Overview"
      className="sm:max-w-2xl"
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      {vacancies.isLoading ? (
        <LoadingState label="Loading branches…" />
      ) : vacancies.error ? (
        <ErrorState message={describeApiError(vacancies.error)} />
      ) : (
        <div className="divide-y divide-charcoal-100">
          {branches.map((branch) => (
            <div key={branch.gymId} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-bold text-charcoal-900">{branch.name}</p>
                <p className="text-[10px] text-charcoal-400">
                  {branch.location ? `${branch.location} · ` : ''}
                  {branch.headcount} staff
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2 text-[10px]">
                {branch.pendingActions > 0 ? (
                  <span className="rounded border border-amber-200 bg-amber-100 px-1.5 py-0.5 font-bold text-amber-800">
                    {branch.pendingActions} action{branch.pendingActions === 1 ? '' : 's'}
                  </span>
                ) : (
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">Clear</span>
                )}
                <span className="rounded bg-charcoal-100 px-1.5 py-0.5 font-semibold text-charcoal-600">
                  {openByBranch.get(branch.name) ?? 0} open vacancies
                </span>
              </div>
            </div>
          ))}
          {branches.length === 0 && <p className="py-6 text-center text-sm text-charcoal-500">No branches in scope.</p>}
        </div>
      )}
    </Dialog>
  )
}
