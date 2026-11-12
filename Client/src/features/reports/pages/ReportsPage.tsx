import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, Download, Lock, UserCheck, Users, Wallet } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Select } from '../../../components/ui/select'
import { Tabs } from '../../../components/ui/tabs'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { StatCard } from '../components/StatCard'
import { BarList } from '../components/BarList'
import { MetricGrid, ReportCard } from '../components/ReportCard'
import { REPORT_PERIODS, type ReportPeriod } from '../api/reports.api'
import { useExportReport, useReportsOverview } from '../hooks/useReports'
import { useMe } from '../../../contexts/MeContext'
import { formatMoney, statusBadgeClass } from '../../../lib/format'
import { describeApiError } from '../../../lib/api-client'

/** Reports & analytics (S5.9) — overview metric cards, gated on reports.view. */
export default function ReportsPage() {
  const { t } = useTranslation()
  const { can, me } = useMe()
  const canView = can('reports', 1)

  const [period, setPeriod] = useState<ReportPeriod>('30d')
  const [gym, setGym] = useState('')
  const [exportError, setExportError] = useState<string | null>(null)

  // The gate is UX-only: the API still enforces reports.view server-side.
  const { data, isLoading, error } = useReportsOverview({ period, gym: gym || undefined }, canView)
  const exportReport = useExportReport()

  const onExport = async () => {
    setExportError(null)
    try {
      await exportReport.mutateAsync({ period, gym: gym || undefined })
    } catch (err) {
      setExportError(describeApiError(err))
    }
  }

  const overview = data

  return (
    <div>
      <PageHeader
        title={t('Reports')}
        description={t('Workforce, attendance, requests, hiring, payroll and separations at a glance')}
        actions={
          canView ? (
            <Button variant="outline" onClick={onExport} loading={exportReport.isPending}>
              <Download className="h-4 w-4" aria-hidden="true" />
              {t('Export CSV')}
            </Button>
          ) : undefined
        }
      />

      {!canView ? (
        <Card>
          <EmptyState
            icon={Lock}
            title={t("You don't have access to reports")}
            message={t('Ask your administrator to grant the reports feature for this gym.')}
          />
        </Card>
      ) : (
        <>
          {exportError && (
            <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {exportError}
            </p>
          )}

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs items={REPORT_PERIODS.map((item) => ({ ...item, label: t(item.label) }))} value={period} onChange={setPeriod} className="w-fit" />
            <Select
              value={gym}
              onChange={(e) => setGym(e.target.value)}
              className="sm:w-56"
              aria-label={t('Filter by gym')}
            >
              <option value="">{t('All gyms (my scope)')}</option>
              {(me?.gyms ?? []).map((option) => (
                <option key={option.gymId} value={String(option.gymId)}>
                  {option.gymName}
                </option>
              ))}
            </Select>
          </div>

          {isLoading ? (
            <LoadingState label={t('Loading reports…')} />
          ) : error ? (
            <ErrorState message={describeApiError(error)} />
          ) : overview ? (
            <div className="space-y-6">
              {/* KPI strip */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  icon={Users}
                  label={t('Total employees')}
                  value={overview.workforce.totalEmployees.toLocaleString()}
                  hint={overview.period}
                />
                <StatCard
                  icon={UserCheck}
                  label={t('Active staff')}
                  value={overview.workforce.active.toLocaleString()}
                  hint={t('{{count}} new hires in period', { count: overview.workforce.newHiresInPeriod })}
                />
                <StatCard
                  icon={BarChart3}
                  label={t('On-time attendance')}
                  value={`${overview.attendance.onTimeRate}%`}
                  hint={t('{{count}} records in period', { count: overview.attendance.recordsInPeriod })}
                />
                <StatCard
                  icon={Wallet}
                  label={t('Net payroll')}
                  value={formatMoney(overview.payroll.totalNetPay)}
                  hint={t('{{count}} entries', { count: overview.payroll.entries })}
                />
              </div>

              {/* Section cards */}
              <div className="grid gap-6 lg:grid-cols-2">
                <ReportCard title={t('Workforce')} description={t('Headcount, status mix and tenure')}>
                  <MetricGrid
                    metrics={[
                      { label: t('On leave'), value: overview.workforce.onLeave.toLocaleString() },
                      { label: t('Notice period'), value: overview.workforce.noticePeriod.toLocaleString() },
                      { label: t('Suspended'), value: overview.workforce.suspended.toLocaleString() },
                      { label: t('Terminated'), value: overview.workforce.terminated.toLocaleString() },
                      { label: t('New hires (period)'), value: overview.workforce.newHiresInPeriod.toLocaleString() },
                      { label: t('Avg tenure'), value: t('{{count}} mo', { count: overview.workforce.avgTenureMonths }) },
                    ]}
                  />
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('By status')}</p>
                    <BarList
                      items={overview.workforce.byStatus.map((bucket) => ({
                        label: bucket.label,
                        value: bucket.value,
                        chipClass: statusBadgeClass(bucket.label),
                      }))}
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('By tenure')}</p>
                    <BarList items={overview.workforce.byTenure.map((bucket) => ({ label: bucket.label, value: bucket.value }))} />
                  </div>
                </ReportCard>

                <ReportCard
                  title={t('Attendance')}
                  description={t('Punch records and on-time rate · {{period}}', { period: overview.period })}
                >
                  <MetricGrid
                    metrics={[
                      { label: t('On time'), value: overview.attendance.onTime.toLocaleString() },
                      { label: t('Late'), value: overview.attendance.late.toLocaleString() },
                      { label: t('Absent'), value: overview.attendance.absent.toLocaleString() },
                      { label: t('Missing checkout'), value: overview.attendance.missingCheckout.toLocaleString() },
                      { label: t('Records in period'), value: overview.attendance.recordsInPeriod.toLocaleString() },
                      { label: t('On-time rate'), value: `${overview.attendance.onTimeRate}%` },
                    ]}
                  />
                </ReportCard>

                <ReportCard
                  title={t('Requests')}
                  description={t('Approvals and volume · {{period}}', { period: overview.period })}
                >
                  <MetricGrid
                    metrics={[
                      { label: t('Requests in period'), value: overview.requests.requestsInPeriod.toLocaleString() },
                      { label: t('Approved'), value: overview.requests.approved.toLocaleString() },
                      { label: t('Rejected'), value: overview.requests.rejected.toLocaleString() },
                      { label: t('Pending'), value: overview.requests.pending.toLocaleString() },
                      { label: t('Approval rate'), value: `${overview.requests.approvalRate}%` },
                    ]}
                  />
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('By type')}</p>
                    <BarList
                      items={overview.requests.byType.map((bucket) => ({ label: bucket.label, value: bucket.value }))}
                    />
                  </div>
                </ReportCard>

                <ReportCard
                  title={t('Recruiting')}
                  description={t('Pipeline and vacancies · {{period}}', { period: overview.period })}
                >
                  <MetricGrid
                    metrics={[
                      { label: t('Applications in pipeline'), value: overview.recruiting.applicationsInPipeline.toLocaleString() },
                      { label: t('Hired in period'), value: overview.recruiting.hiredInPeriod.toLocaleString() },
                      { label: t('Open vacancies'), value: overview.recruiting.openVacancies.toLocaleString() },
                      { label: t('Open slots'), value: overview.recruiting.openSlots.toLocaleString() },
                    ]}
                  />
                </ReportCard>

                <ReportCard title={t('Payroll')} description={t('Totals across the scoped entries')}>
                  <MetricGrid
                    metrics={[
                      { label: t('Entries'), value: overview.payroll.entries.toLocaleString() },
                      { label: t('Total net pay'), value: formatMoney(overview.payroll.totalNetPay) },
                    ]}
                  />
                </ReportCard>

                <ReportCard title={t('Offboarding')} description={t('Separations · {{period}}', { period: overview.period })}>
                  <MetricGrid
                    metrics={[
                      { label: t('Separations in period'), value: overview.offboarding.separationsInPeriod.toLocaleString() },
                      { label: t('Open checklists'), value: overview.offboarding.openChecklists.toLocaleString() },
                    ]}
                  />
                </ReportCard>
              </div>
            </div>
          ) : (
            <EmptyState title={t('No report data')} message={t('Nothing to show for this period.')} />
          )}
        </>
      )}
    </div>
  )
}
