import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Building2, CreditCard, Users, UserPlus, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CreateGymModal } from '../components/CreateGymModal'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { describeApiError } from '../../../lib/api-client'
import { useMe } from '../../../contexts/MeContext'
import { formatDate, formatMoney, formatNumber } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import {
  KpiTile,
  PTbody,
  PTd,
  PTh,
  PTable,
  PThead,
  PTr,
  Panel,
  PanelEmpty,
  PanelError,
  PanelHead,
  PanelLabel,
  PanelLoading,
  PlatformPage,
  PlatformPageHeader,
  Toolbar,
  TableWrap,
  GymMark,
  alertHref,
} from '../components/platform-ui'
import { useCompanies, usePlatformAlerts, usePlatformDashboard } from '../hooks/usePlatform'

/** Plan pill tone, mirroring the mock's plan vocabulary. */
function planTone(name: string) {
  const value = name.toLowerCase()
  if (value.includes('enterprise')) return 'purple' as const
  if (value.includes('growth')) return 'green' as const
  return 'gray' as const
}

/**
 * Console landing page: four numbers that matter, the gym table, and the
 * decisions waiting on the operator. Nothing else — every other view is one
 * click away in the sidebar.
 *
 * The attention queue is derived server-side from live state, so an item
 * disappears as soon as its cause is fixed — there is nothing to "dismiss".
 */
export default function PlatformDashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { me } = useMe()
  const isSuperAdmin = me?.userType === 'TopManagement'
  const [createGymOpen, setCreateGymOpen] = useState(false)

  const dashboard = usePlatformDashboard()
  const alerts = usePlatformAlerts(undefined, dashboard.isSuccess)
  const companies = useCompanies({ pageNumber: 1, pageSize: 8 }, dashboard.isSuccess)
  // Revenue is commercial data an HR Manager cannot read; skip the tile entirely.
  const showRevenue = isSuperAdmin

  const data = dashboard.data

  const subtitle = data
    ? t('{{gyms}} gym accounts · {{users}} users · {{mrr}} monthly recurring', {
        gyms: formatNumber(data.companies.total),
        users: formatNumber(data.users.total),
        mrr: formatMoney(data.revenue.mrr),
      })
    : t('Every gym account on the platform')

  return (
    <PlatformPage>
      <PlatformPageHeader
        title={t('Platform overview')}
        subtitle={subtitle}
        actions={
          <Toolbar>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreateGymOpen(true)}>
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t('Create gym account')}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/platform/hr-managers?new=1')}
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
              {t('Create HR manager')}
            </button>
          </Toolbar>
        }
      />

      {!data ? (
        <Panel>
          {dashboard.isError ? (
            <PanelError
              title={t('Could not load the overview')}
              message={describeApiError(dashboard.error)}
              onRetry={() => void dashboard.refetch()}
            />
          ) : (
            <PanelLoading />
          )}
        </Panel>
      ) : (
        <>
          <div className={cn('grid grid-cols-2 gap-2.5', showRevenue ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
            <KpiTile
              label={t('Gym accounts')}
              value={formatNumber(data.companies.total)}
              sub={t('{{active}} active · {{trial}} trial', {
                active: data.companies.active,
                trial: data.companies.trial,
              })}
              icon={Building2}
            />
            <KpiTile
              label={t('Total users')}
              value={formatNumber(data.users.total)}
              sub={t('+{{count}} this month · {{managers}} HR managers', {
                count: data.users.addedThisMonth,
                managers: data.users.hrManagers,
              })}
              icon={Users}
            />
            {showRevenue && (
              <KpiTile
                label={t('Monthly revenue')}
                value={formatMoney(data.revenue.mrr)}
                sub={
                  data.revenue.overdue > 0
                    ? t('{{amount}} overdue', { amount: formatMoney(data.revenue.overdue) })
                    : t('All invoices settled')
                }
                tone={data.revenue.overdue > 0 ? 'amber' : undefined}
                icon={Wallet}
              />
            )}
            <KpiTile
              label={t('Seat utilisation')}
              value={data.seats.capacity > 0 ? `${data.seats.utilisationPercent}%` : formatNumber(data.seats.used)}
              sub={
                data.seats.capacity > 0
                  ? t('{{used}} of {{capacity}} capped seats', {
                      used: formatNumber(data.seats.used),
                      capacity: formatNumber(data.seats.capacity),
                    })
                  : t('No capped plans')
              }
              icon={CreditCard}
            />
          </div>

          <div className="pc-grow grid grid-cols-1 gap-2.5 xl:grid-cols-3">
            <Panel grow className="min-w-0 xl:col-span-2">
              <PanelHead>
                <PanelLabel>{t('Gym accounts')}</PanelLabel>
                <Link to="/platform/companies" className="pc-link">
                  {t('Manage accounts →')}
                </Link>
              </PanelHead>

              {companies.isPending ? (
                <PanelLoading />
              ) : companies.isError ? (
                <PanelError
                  title={t('Could not load the accounts')}
                  message={describeApiError(companies.error)}
                  onRetry={() => void companies.refetch()}
                  compact
                />
              ) : companies.data.items.length === 0 ? (
                <PanelEmpty
                  icon={Building2}
                  title={t('No gym accounts yet')}
                  hint={t('Create the first account to get started.')}
                />
              ) : (
                <TableWrap>
                  <PTable className="pc-table-sticky">
                    <PThead>
                      <tr>
                        <PTh>{t('Gym account')}</PTh>
                        <PTh className="pc-end">{t('Users')}</PTh>
                        <PTh className="pc-end">{t('MRR')}</PTh>
                        <PTh>{t('Renews')}</PTh>
                        <PTh>{t('Status')}</PTh>
                      </tr>
                    </PThead>
                    <PTbody>
                      {companies.data.items.map((company) => (
                        <PTr
                          key={company.id}
                          onClick={() => navigate(`/platform/companies/${company.id}`)}
                        >
                          <PTd>
                            <div className="flex min-w-0 items-center gap-2">
                              <GymMark name={company.name} logoUrl={company.logoUrl} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="truncate text-xs font-semibold leading-tight text-charcoal-800">
                                    {company.name}
                                  </p>
                                  <Badge color={planTone(company.plan.name)} className="flex-shrink-0">
                                    {company.plan.name}
                                  </Badge>
                                </div>
                                <p className="truncate text-[10px] leading-tight text-charcoal-500">
                                  {[company.city, company.code].filter(Boolean).join(' · ')}
                                </p>
                              </div>
                            </div>
                          </PTd>
                          <PTd className="pc-end whitespace-nowrap">
                            <span className="text-xs font-semibold text-charcoal-800">{formatNumber(company.userCount)}</span>
                            {company.seatLimit !== null && (
                              <span className="text-[10px] text-charcoal-400">{`/${formatNumber(company.seatLimit)}`}</span>
                            )}
                          </PTd>
                          <PTd className="pc-end whitespace-nowrap">
                            {company.mrr > 0 ? (
                              <span className="text-xs font-semibold text-charcoal-800">
                                {formatMoney(company.mrr)}
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-blue-600">{t('Trial')}</span>
                            )}
                          </PTd>
                          <PTd className="whitespace-nowrap">
                            <span className="text-[11px] text-charcoal-600">
                              {company.renewsOn ? formatDate(company.renewsOn) : '—'}
                            </span>
                            {company.renewalDaysRemaining !== null && (
                              <p className="text-[9px] text-charcoal-400">
                                {t('in {{days}} days', { days: company.renewalDaysRemaining })}
                              </p>
                            )}
                          </PTd>
                          <PTd>
                            <StatusBadge status={company.status} />
                          </PTd>
                        </PTr>
                      ))}
                    </PTbody>
                  </PTable>
                </TableWrap>
              )}
            </Panel>

            <Panel grow className="min-w-0">
              <PanelHead>
                <PanelLabel>{t('Needs your attention')}</PanelLabel>
                {alerts.data && (
                  <span className={alerts.data.items.length > 0 ? 'badge badge-red' : 'badge badge-gray'}>
                    {alerts.data.items.length}
                  </span>
                )}
              </PanelHead>

              {alerts.isPending ? (
                <PanelLoading />
              ) : alerts.isError ? (
                <PanelError
                  title={t('Could not load the attention queue')}
                  message={describeApiError(alerts.error)}
                  onRetry={() => void alerts.refetch()}
                  compact
                />
              ) : alerts.data.items.length === 0 ? (
                <PanelEmpty
                  icon={AlertTriangle}
                  title={t('Nothing needs attention')}
                  hint={t('Overdue invoices, expiring trials and seat pressure appear here.')}
                />
              ) : (
                <div className="pc-scroll-region">
                  {alerts.data.items.map((alert) => (
                    <Link
                      key={alert.id}
                      to={alertHref(alert)}
                      className="flex items-start gap-2 border-b border-charcoal-100 px-3 py-2.5 last:border-0 hover:bg-charcoal-50"
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md',
                          alert.severity === 'critical'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-amber-50 text-amber-600',
                        )}
                      >
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-semibold leading-tight text-charcoal-800">
                          {alert.title}
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-snug text-charcoal-500">
                          {alert.detail}
                        </span>
                        <span className="mt-1 inline-block text-[10px] font-semibold text-brand-700">
                          {alert.actionLabel} →
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}

      <CreateGymModal
        open={createGymOpen}
        onClose={() => setCreateGymOpen(false)}
        onCreated={(companyId) => {
          setCreateGymOpen(false)
          navigate(`/platform/companies/${companyId}`)
        }}
      />
    </PlatformPage>
  )
}
