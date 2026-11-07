import { useNavigate } from 'react-router-dom'
import { Building2, Users, FileText, Sparkles, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Badge } from '../../../components/ui/badge'
import { Avatar } from '../../../components/ui/avatar'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { useHrDashboard } from '../hooks/useDashboard'
import { useMe } from '../../../contexts/MeContext'
import { formatDate } from '../../../lib/format'
import { describeApiError } from '../../../lib/api-client'

function KpiCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-bold tracking-tight text-slate-900">{value.toLocaleString()}</p>
          <p className="truncate text-sm text-slate-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

/** HR portal dashboard — KPI strip, actions-needed feed, branch oversight. */
export default function HrDashboardPage() {
  const navigate = useNavigate()
  const { me } = useMe()
  const { data, isLoading, error } = useHrDashboard()

  if (isLoading) return <LoadingState label="Loading dashboard…" />
  if (error) return <ErrorState message={describeApiError(error)} />

  const dashboard = data!

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {dashboard.greeting ?? `Welcome back, ${dashboard.userName ?? me?.userName ?? ''}`}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Here's what needs your attention today.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Building2} label="Branches" value={dashboard.kpis.totalGyms} />
        <KpiCard icon={Users} label="Total staff" value={dashboard.kpis.totalStaff} />
        <KpiCard icon={FileText} label="Pending requests" value={dashboard.kpis.totalPendingRequests} />
        <KpiCard icon={Sparkles} label="Actions needed" value={dashboard.kpis.actionsNeeded} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Actions needed */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Actions needed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {dashboard.actions.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">Nothing needs your attention right now.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {dashboard.actions.map((action) => (
                  <li key={action.id} className="flex items-start gap-3 py-3">
                    <Avatar name={action.title.slice(0, 1).toUpperCase()} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{action.title}</p>
                        <Badge>{action.badge}</Badge>
                      </div>
                      {action.subtitle && <p className="mt-0.5 text-sm text-slate-600">{action.subtitle}</p>}
                      {action.detail && <p className="mt-0.5 text-sm text-slate-500">{action.detail}</p>}
                      <p className="mt-1 text-xs text-slate-400">{formatDate(action.date)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Branches oversight */}
        <Card>
          <CardHeader>
            <CardTitle>Branches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {dashboard.branches.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No branches to show.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {dashboard.branches.map((branch) => (
                  <li key={branch.gymId} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-900">{branch.name}</p>
                      <button
                        type="button"
                        onClick={() => navigate('/console/employees')}
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        View
                        <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                      <span>{branch.headcount} staff</span>
                      {branch.pendingActions > 0 && <span className="text-amber-600">{branch.pendingActions} pending</span>}
                    </div>
                    {branch.summary && <p className="mt-0.5 text-xs text-slate-400">{branch.summary}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
