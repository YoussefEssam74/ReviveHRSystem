import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Plus, RotateCcw, Search } from 'lucide-react'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { describeApiError } from '../../../lib/api-client'
import { formatDate, formatMoney, formatNumber } from '../../../lib/format'
import { useMe } from '../../../contexts/MeContext'
import { AttentionStrip } from '../components/AttentionStrip'
import { CreateGymModal } from '../components/CreateGymModal'
import {
  PTbody,
  PTd,
  PTh,
  PTable,
  PThead,
  PTr,
  Pager,
  Panel,
  PanelEmpty,
  PanelError,
  PanelHead,
  PanelLabel,
  PanelLoading,
  PlatformPage,
  PlatformPageHeader,
  TableWrap,
  GymMark,
} from '../components/platform-ui'
import { useCompanies, usePlans } from '../hooks/usePlatform'

const STATUS_OPTIONS = ['', 'Trial', 'Active', 'PaymentOverdue', 'Suspended', 'Closed']

/** Plan pill tone, mirroring the mock's plan vocabulary. */
function planTone(name: string) {
  const value = name.toLowerCase()
  if (value.includes('enterprise')) return 'purple' as const
  if (value.includes('growth')) return 'green' as const
  return 'gray' as const
}

/**
 * The account table: every gym company with its plan, seat usage and renewal.
 * Filters sit at the start edge of the card head; search is pinned to the end.
 */
export default function PlatformCompaniesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { me } = useMe()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [planId, setPlanId] = useState('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)

  const plans = usePlans(me?.userType === 'TopManagement')
  const companies = useCompanies({
    search: search.trim() || undefined,
    status: status || undefined,
    planId: planId ? Number(planId) : undefined,
    pageNumber: page,
    pageSize: 25,
  })

  const resetTo = (update: () => void) => {
    update()
    setPage(1)
  }

  const filtered = Boolean(search || status || planId)
  const clearFilters = () => {
    setSearch('')
    setStatus('')
    setPlanId('')
    setPage(1)
  }

  const total = companies.data?.totalCount ?? 0

  return (
    <PlatformPage>
      <PlatformPageHeader
        title={t('Gym accounts')}
        subtitle={t('{{count}} subscribed gyms · plan, seat usage and renewal', { count: total })}
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Create gym account')}
          </button>
        }
      />

      <AttentionStrip />

      <CreateGymModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(companyId) => navigate(`/platform/companies/${companyId}`)}
      />

      <Panel grow>
        <PanelHead className="border-b-0">
          <PanelLabel>{t('Accounts')}</PanelLabel>
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              className="pc-control w-auto"
              value={status}
              onChange={(event) => resetTo(() => setStatus(event.target.value))}
              aria-label={t('Filter by status')}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option || 'all'} value={option}>
                  {option ? t(option) : t('All statuses')}
                </option>
              ))}
            </select>
            {plans.data && (
              <select
                className="pc-control w-auto"
                value={planId}
                onChange={(event) => resetTo(() => setPlanId(event.target.value))}
                aria-label={t('Filter by plan')}
              >
                <option value="">{t('All plans')}</option>
                {plans.data.items.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            )}
            {filtered && (
              <button type="button" className="btn btn-ghost btn-sm text-charcoal-500" onClick={clearFilters}>
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                {t('Clear')}
              </button>
            )}
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-2 top-1/2 h-3 w-3 -translate-y-1/2 text-charcoal-400"
                aria-hidden="true"
              />
              <input
                className="pc-control w-44 ps-6"
                placeholder={t('Search gyms…')}
                value={search}
                onChange={(event) => resetTo(() => setSearch(event.target.value))}
                aria-label={t('Search accounts')}
              />
            </div>
          </div>
        </PanelHead>

        {companies.isPending ? (
          <PanelLoading />
        ) : companies.isError ? (
          <PanelError
            title={t('Could not load the accounts')}
            message={describeApiError(companies.error)}
            onRetry={() => void companies.refetch()}
          />
        ) : companies.data.items.length === 0 ? (
          <PanelEmpty
            icon={Building2}
            title={t('No accounts match')}
            hint={t('Try clearing the search or status filter.')}
          />
        ) : (
          <>
            <TableWrap>
              <PTable className="pc-table-sticky">
                <PThead>
                  <tr>
                    <PTh>{t('Gym account')}</PTh>
                    <PTh>{t('Plan')}</PTh>
                    <PTh className="pc-center">{t('Branches')}</PTh>
                    <PTh className="pc-end">{t('Seats')}</PTh>
                    <PTh className="pc-end">{t('MRR')}</PTh>
                    <PTh>{t('Renews')}</PTh>
                    <PTh>{t('Status')}</PTh>
                  </tr>
                </PThead>
                <PTbody>
                  {companies.data.items.map((company) => {
                    const renewingSoon =
                      company.renewalDaysRemaining !== null && company.renewalDaysRemaining <= 14
                    return (
                      <PTr key={company.id} onClick={() => navigate(`/platform/companies/${company.id}`)}>
                        <PTd>
                          <div className="flex min-w-0 items-center gap-2">
                            <GymMark name={company.name} logoUrl={company.logoUrl} />
                            <div className="min-w-0">
                              <Link
                                to={`/platform/companies/${company.id}`}
                                className="block truncate text-xs font-semibold leading-tight text-charcoal-800 hover:text-brand-700"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {company.name}
                              </Link>
                              <p className="truncate text-[10px] leading-tight text-charcoal-500">
                                {[company.city, company.code].filter(Boolean).join(' · ')}
                              </p>
                            </div>
                          </div>
                        </PTd>
                        <PTd>
                          <Badge color={planTone(company.plan.name)}>{company.plan.name}</Badge>
                        </PTd>
                        <PTd className="pc-center whitespace-nowrap text-xs font-semibold text-charcoal-700">
                          {formatNumber(company.branchCount)}
                        </PTd>
                        <PTd className="pc-end whitespace-nowrap">
                          <span className="text-xs font-semibold text-charcoal-800">{formatNumber(company.userCount)}</span><span className="text-[10px] text-charcoal-400">{`/${company.seatLimit === null ? t('∞') : formatNumber(company.seatLimit)}`}</span>
                          {company.seatLimit !== null && company.seatUsagePercent !== null && company.seatUsagePercent >= 90 && (
                            <p className="text-[9px] font-semibold text-amber-600">{company.seatUsagePercent}%</p>
                          )}
                        </PTd>
                        <PTd className="pc-end whitespace-nowrap">
                          {company.mrr > 0 ? (
                            <span className="text-xs font-semibold text-charcoal-800">{formatMoney(company.mrr)}</span>
                          ) : (
                            <span className="text-[10px] font-medium text-blue-600">{t('Trial')}</span>
                          )}
                        </PTd>
                        <PTd className="whitespace-nowrap">
                          <span className="text-[11px] text-charcoal-600">
                            {company.renewsOn ? formatDate(company.renewsOn) : '—'}
                          </span>
                          {company.renewalDaysRemaining !== null && (
                            <p
                              className={
                                renewingSoon
                                  ? 'text-[9px] font-semibold text-amber-600'
                                  : 'text-[9px] text-charcoal-400'
                              }
                            >
                              {t('in {{days}} days', { days: company.renewalDaysRemaining })}
                            </p>
                          )}
                        </PTd>
                        <PTd>
                          <StatusBadge status={company.status} />
                        </PTd>
                      </PTr>
                    )
                  })}
                </PTbody>
              </PTable>
            </TableWrap>
            <Pager
              page={companies.data.page}
              pageSize={companies.data.pageSize}
              total={companies.data.totalCount}
              totalPages={companies.data.totalPages}
              onPageChange={setPage}
              noun={t('accounts')}
            />
          </>
        )}
      </Panel>
    </PlatformPage>
  )
}
