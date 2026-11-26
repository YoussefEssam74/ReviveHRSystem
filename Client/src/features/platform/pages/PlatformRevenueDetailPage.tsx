import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Download, TrendingDown, TrendingUp } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { describeApiError } from '../../../lib/api-client'
import { useToast } from '../../../components/ui/toast'
import { formatDate, formatMoney, formatNumber } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import { downloadRevenueCsv, type InvoiceListItem } from '../api/platform.api'
import {
  useCompanies,
  useInvoices,
  usePlans,
  useRevenueOutstanding,
  useRevenuePerCompany,
  useRevenuePeriods,
  useRevenueSummary,
} from '../hooks/usePlatform'
import {
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
  TableWrap,
  GymMark,
} from '../components/platform-ui'
import { TrendChart } from '../components/TrendChart'
import { saveBlob } from '../lib/download'

type Metric = 'mrr' | 'gross' | 'collected' | 'outstanding'

const METRICS: Metric[] = ['mrr', 'gross', 'collected', 'outstanding']

function isMetric(value: string | undefined): value is Metric {
  return !!value && (METRICS as string[]).includes(value)
}

/** One labelled figure at the top of a breakdown page. */
function DetailStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: 'brand' | 'red' | 'amber'
}) {
  return (
    <div className="pc-card px-3 py-2.5">
      <p className="pc-stat-label">{label}</p>
      <p
        className={cn(
          'pc-stat-value mt-0.5',
          tone === 'brand' && 'text-brand-700',
          tone === 'red' && 'text-red-600',
          tone === 'amber' && 'text-amber-600',
        )}
      >
        {value}
      </p>
      {sub !== undefined && <p className="pc-stat-sub mt-0.5">{sub}</p>}
    </div>
  )
}

/** Labelled meter row used by the "split by plan" card. */
function BarRow({ label, value, max, muted }: { label: string; value: number; max: number; muted?: boolean }) {
  const percent = max ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-32 flex-shrink-0 truncate text-[11px] text-charcoal-700">{label}</span>
      <div className="pc-meter h-1.5 flex-1">
        <div className={cn('pc-meter-fill', muted && 'opacity-50')} style={{ width: `${percent}%` }} />
      </div>
      <span className="w-20 flex-shrink-0 text-end text-[11px] font-semibold text-charcoal-800">
        {formatMoney(value)}
      </span>
    </div>
  )
}

function Delta({ value }: { value: number }) {
  if (!Number.isFinite(value) || value === 0) return <span className="badge badge-gray">0.0%</span>
  const up = value > 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={cn('badge', up ? 'badge-green' : 'badge-red')}>
      <Icon className="h-2.5 w-2.5" aria-hidden="true" />
      {up ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  )
}

/** Days between an invoice's issue date and the day it was paid. */
function daysToPay(invoice: InvoiceListItem): number | null {
  if (!invoice.paidOn) return null
  return Math.max(0, Math.round((new Date(invoice.paidOn).getTime() - new Date(invoice.issuedOn).getTime()) / 86_400_000))
}

/** One revenue figure, opened: the evidence behind a headline number. */
export default function PlatformRevenueDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const params = useParams()
  const metric: Metric = isMetric(params.metric) ? params.metric : 'mrr'

  const [period, setPeriod] = useState('')
  const periods = useRevenuePeriods()
  const summary = useRevenueSummary(period || undefined)
  const perCompany = useRevenuePerCompany(period || undefined)
  const outstanding = useRevenueOutstanding(period || undefined, metric === 'outstanding')
  const plans = usePlans()
  const companies = useCompanies({ pageSize: 200 })
  // One page of the ledger drives the billed-per-month, per-plan and payment tables.
  const invoices = useInvoices({ pageSize: 100 })

  const seatsByCompany = new Map(
    (companies.data?.items ?? []).map((company) => [company.id, { used: company.userCount, limit: company.seatLimit }]),
  )

  const copy: Record<Metric, { title: string; subtitle: string }> = {
    mrr: {
      title: t('Monthly recurring revenue'),
      subtitle: t('What the recurring revenue is made of, plan by plan and gym by gym'),
    },
    gross: { title: t('Revenue growth'), subtitle: t('Everything invoiced in the period, and which plan produced it') },
    collected: { title: t('Collected revenue'), subtitle: t('The cash that actually arrived, and how fast') },
    outstanding: { title: t('Outstanding revenue'), subtitle: t('The money still owed, how late it is, and who owes it') },
  }

  const exportMetric = async () => {
    try {
      const { blob, fileName } = await downloadRevenueCsv(metric, period || undefined)
      saveBlob(blob, fileName ?? `platform-${metric}.csv`)
    } catch {
      toast(t('Could not export the figures.'), 'error')
    }
  }

  const periodLabel = perCompany.data?.period ?? summary.data?.period ?? ''
  const ledger = invoices.data?.items ?? []
  const inPeriod = ledger.filter((invoice) => invoice.periodLabel === periodLabel)
  const periodOrder = periods.data?.periods ?? []
  const periodIndex = periodOrder.indexOf(periodLabel)
  const previousLabel = periodIndex >= 0 ? (periodOrder[periodIndex + 1] ?? null) : null
  const previousInvoices = previousLabel ? ledger.filter((invoice) => invoice.periodLabel === previousLabel) : []

  // Billed per month across the whole ledger, oldest → newest.
  const billedByPeriod = new Map<string, number>()
  for (const invoice of ledger) {
    billedByPeriod.set(invoice.periodLabel, (billedByPeriod.get(invoice.periodLabel) ?? 0) + invoice.amount)
  }
  const monthRows = [...periodOrder]
    .reverse()
    .filter((label) => billedByPeriod.has(label))
    .map((label) => ({ label, value: billedByPeriod.get(label) ?? 0 }))

  const rows = perCompany.data?.items ?? []
  const paidInvoices = inPeriod.filter((invoice) => invoice.status === 'Paid')
  const grossPrevious = previousInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)

  return (
    <PlatformPage>
      <nav className="flex items-center gap-1.5 text-[10px]">
        <Link to="/platform/revenue" className="font-medium text-charcoal-400 hover:text-brand-700">
          {t('Revenue Analytics')}
        </Link>
        <ChevronRight className="h-2.5 w-2.5 text-charcoal-300" aria-hidden="true" />
        <span className="truncate font-semibold text-charcoal-600">{copy[metric].title}</span>
      </nav>

      <PlatformPageHeader
        title={copy[metric].title}
        subtitle={copy[metric].subtitle}
        actions={
          <>
            <select
              className="pc-control w-auto"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              aria-label={t('Reporting period')}
            >
              <option value="">{t('Current period')}</option>
              {periods.data?.periods.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void exportMetric()}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {t('Export')}
            </button>
          </>
        }
      />

      {summary.isPending ? (
        <Panel>
          <PanelLoading />
        </Panel>
      ) : summary.isError ? (
        <Panel>
          <PanelError
            title={t('Could not load the revenue summary')}
            message={describeApiError(summary.error)}
            onRetry={() => void summary.refetch()}
          />
        </Panel>
      ) : metric === 'mrr' ? (
        <>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <DetailStat label={t('MRR')} value={formatMoney(summary.data.mrr.value)} />
            <DetailStat label={t('Annual run rate')} value={formatMoney(summary.data.mrr.arr)} />
            <DetailStat
              label={t('Paying gyms')}
              value={t('{{paying}} of {{total}}', {
                paying: summary.data.mrr.payingCompanies,
                total: summary.data.mrr.totalCompanies,
              })}
            />
            <DetailStat label={t('Average per gym')} value={formatMoney(summary.data.mrr.averagePerCompany)} />
          </div>

          <Panel>
            <PanelHead>
              <PanelLabel>{t('Split by subscription plan')}</PanelLabel>
              <Link to="/platform/billing" className="pc-link">
                {t('Manage plans →')}
              </Link>
            </PanelHead>
            <div className="space-y-2 px-3 py-2.5">
              {plans.isPending ? (
                <PanelLoading />
              ) : (plans.data?.items ?? []).length === 0 ? (
                <PanelEmpty title={t('No plans configured')} />
              ) : (
                [...(plans.data?.items ?? [])]
                  .filter((plan) => plan.companiesOnPlan > 0)
                  .sort((a, b) => b.mrr - a.mrr)
                  .map((plan) => ({
                    label: t('{{name}} · {{count}} gym(s)', { name: plan.name, count: plan.companiesOnPlan }),
                    value: plan.mrr,
                  }))
                  .map((row, _index, all) => (
                    <BarRow
                      key={row.label}
                      label={row.label}
                      value={row.value}
                      max={Math.max(...all.map((item) => item.value), 1)}
                    />
                  ))
              )}
            </div>
          </Panel>

          <Panel grow>
            <PanelHead>
              <div className="min-w-0 flex-1">
                <p className="pc-card-label">{t('Gym by gym')}</p>
                <p className="mt-0.5 text-[10px] text-charcoal-500">
                  {t('Commitment and revenue per licensed seat')}
                </p>
              </div>
            </PanelHead>
            {perCompany.isPending ? (
              <PanelLoading />
            ) : rows.length === 0 ? (
              <PanelEmpty title={t('No gym accounts bill yet')} />
            ) : (
              <TableWrap>
                <PTable className="pc-table-sticky">
                  <PThead>
                    <tr>
                      <PTh>{t('Gym account')}</PTh>
                      <PTh>{t('Plan')}</PTh>
                      <PTh>{t('Billing')}</PTh>
                      <PTh className="pc-end">{t('Seats used')}</PTh>
                      <PTh className="pc-end">{t('Revenue / seat')}</PTh>
                      <PTh className="pc-end">{t('MRR')}</PTh>
                      <PTh className="w-24">{t('Share')}</PTh>
                    </tr>
                  </PThead>
                  <PTbody>
                    {rows
                      .filter((row) => row.mrr > 0)
                      .sort((a, b) => b.mrr - a.mrr)
                      .map((row) => {
                        const seats = seatsByCompany.get(row.companyId)
                        const perSeat = seats?.limit ? Math.round(row.mrr / seats.limit) : null
                        return (
                          <PTr key={row.companyId} onClick={() => navigate(`/platform/companies/${row.companyId}`)}>
                            <PTd>
                              <div className="flex min-w-0 items-center gap-2">
                                <GymMark name={row.companyName} />
                                <div className="min-w-0">
                                  <p className="truncate text-[11px] font-semibold leading-tight text-charcoal-800">
                                    {row.companyName}
                                  </p>
                                  <p className="truncate text-[9px] leading-tight text-charcoal-400">
                                    {row.city ?? ''}
                                  </p>
                                </div>
                              </div>
                            </PTd>
                            <PTd className="whitespace-nowrap text-[11px] text-charcoal-600">{row.planName}</PTd>
                            <PTd className="whitespace-nowrap text-[10px] text-charcoal-500">{row.cycleLabel}</PTd>
                            <PTd className="pc-end whitespace-nowrap text-[11px] text-charcoal-600">
                              {seats ? `${formatNumber(seats.used)} / ${seats.limit ?? t('∞')}` : '—'}
                            </PTd>
                            <PTd className="pc-end whitespace-nowrap text-[11px] text-charcoal-500">
                              {perSeat === null ? '—' : formatMoney(perSeat)}
                            </PTd>
                            <PTd className="pc-end whitespace-nowrap text-xs font-semibold text-charcoal-800">
                              {formatMoney(row.mrr)}
                            </PTd>
                            <PTd>
                              <div className="flex w-24 items-center gap-1.5">
                                <div className="pc-meter flex-1">
                                  <div
                                    className="pc-meter-fill"
                                    style={{ width: `${Math.min(100, Math.max(0, row.mrrSharePercent))}%` }}
                                  />
                                </div>
                                <span className="w-7 text-end text-[9px] text-charcoal-500">
                                  {Math.round(row.mrrSharePercent)}%
                                </span>
                              </div>
                            </PTd>
                          </PTr>
                        )
                      })}
                  </PTbody>
                </PTable>
              </TableWrap>
            )}
          </Panel>
        </>
      ) : metric === 'gross' ? (
        <>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <DetailStat label={t('Gross revenue')} value={formatMoney(summary.data.gross.value)} />
            <DetailStat
              label={t('Previous month')}
              value={previousLabel ? formatMoney(grossPrevious) : '—'}
              sub={previousLabel ?? undefined}
            />
            <DetailStat
              label={t('Change')}
              value={
                <span className="flex items-center gap-1.5">
                  <span>
                    {summary.data.gross.value - grossPrevious >= 0 ? '+' : '−'}
                    {formatMoney(Math.abs(summary.data.gross.value - grossPrevious))}
                  </span>
                  <Delta value={summary.data.gross.changePercent} />
                </span>
              }
              tone={summary.data.gross.value - grossPrevious >= 0 ? 'brand' : 'red'}
            />
            <DetailStat label={t('Average invoice')} value={formatMoney(summary.data.gross.averageInvoice)} />
          </div>

          <Panel>
            <PanelHead>
              <div className="min-w-0 flex-1">
                <p className="pc-card-label">{t('Billed per month')}</p>
                <p className="mt-0.5 text-[10px] text-charcoal-500">
                  {t('{{count}} billing months · {{total}} billed', {
                    count: monthRows.length,
                    total: formatMoney(monthRows.reduce((sum, row) => sum + row.value, 0)),
                  })}
                </p>
              </div>
            </PanelHead>
            {invoices.isPending ? (
              <PanelLoading />
            ) : monthRows.length === 0 ? (
              <PanelEmpty title={t('No invoices yet')} />
            ) : (
              <div className="px-3 pb-1 pt-1">
                <TrendChart
                  rows={monthRows.map((row) => ({
                    label: row.label.split(' ')[0],
                    title: row.label,
                    value: row.value,
                  }))}
                  currentLabel={periodLabel.split(' ')[0]}
                  ariaLabel={t('Billed per month')}
                />
              </div>
            )}
          </Panel>

          <Panel grow>
            <PanelHead>
              <div className="min-w-0 flex-1">
                <p className="pc-card-label">{t('Gross revenue by plan · {{period}}', { period: periodLabel })}</p>
                <p className="mt-0.5 text-[10px] text-charcoal-500">
                  {t('{{count}} invoices · compared with {{previous}}', {
                    count: inPeriod.length,
                    previous: previousLabel ?? t('the month before'),
                  })}
                </p>
              </div>
            </PanelHead>
            <PlanRevenueTable
              current={inPeriod}
              previous={previousInvoices}
              hasPrevious={Boolean(previousLabel)}
              onOpenCompany={(id) => navigate(`/platform/companies/${id}`)}
            />
          </Panel>
        </>
      ) : metric === 'collected' ? (
        <>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <DetailStat label={t('Collected')} value={formatMoney(summary.data.collected.value)} tone="brand" />
            <DetailStat
              label={t('Collection rate')}
              value={`${summary.data.collected.collectionRatePercent.toFixed(1)}%`}
            />
            <DetailStat
              label={t('Invoices paid')}
              value={t('{{paid}} of {{total}}', {
                paid: summary.data.collected.invoicesPaid,
                total: inPeriod.length,
              })}
            />
            <DetailStat
              label={t('Average time to pay')}
              value={averageDaysLabel(paidInvoices)}
            />
          </div>

          <Panel grow={paidInvoices.length > 0}>
            <PanelHead>
              <div className="min-w-0 flex-1">
                <p className="pc-card-label">{t('Payments received')}</p>
                <p className="mt-0.5 text-[10px] text-charcoal-500">
                  {t('{{amount}} still unpaid in this period', {
                    amount: formatMoney(summary.data.outstanding.value),
                  })}
                </p>
              </div>
              <Link to="/platform/revenue/outstanding" className="btn btn-secondary btn-sm">
                {t('View outstanding →')}
              </Link>
            </PanelHead>
            {invoices.isPending ? (
              <PanelLoading />
            ) : paidInvoices.length === 0 ? (
              <PanelEmpty title={t('Nothing collected in this period')} />
            ) : (
              <TableWrap>
                <PTable className="pc-table-sticky">
                  <PThead>
                    <tr>
                      <PTh>{t('Gym account')}</PTh>
                      <PTh>{t('Invoice')}</PTh>
                      <PTh className="pc-end">{t('Amount')}</PTh>
                      <PTh>{t('Issued')}</PTh>
                      <PTh>{t('Paid')}</PTh>
                      <PTh className="pc-end">{t('Time to pay')}</PTh>
                    </tr>
                  </PThead>
                  <PTbody>
                    {[...paidInvoices]
                      .sort(
                        (a, b) => new Date(b.paidOn ?? 0).getTime() - new Date(a.paidOn ?? 0).getTime(),
                      )
                      .map((invoice) => {
                        const days = daysToPay(invoice)
                        return (
                          <PTr
                            key={invoice.id}
                            onClick={() => navigate(`/platform/companies/${invoice.company.id}`)}
                          >
                            <PTd>
                              <div className="flex min-w-0 items-center gap-2">
                                <GymMark name={invoice.company.name} />
                                <div className="min-w-0">
                                  <p className="truncate text-[11px] font-semibold leading-tight text-charcoal-800">
                                    {invoice.company.name}
                                  </p>
                                  <p className="truncate text-[9px] leading-tight text-charcoal-400">
                                    {invoice.company.city ?? ''}
                                  </p>
                                </div>
                              </div>
                            </PTd>
                            <PTd className="whitespace-nowrap font-mono text-[11px] text-charcoal-600">
                              {invoice.invoiceNumber}
                            </PTd>
                            <PTd className="pc-end whitespace-nowrap text-xs font-semibold text-brand-700">
                              {formatMoney(invoice.amount, invoice.currency)}
                            </PTd>
                            <PTd className="whitespace-nowrap text-[10px] text-charcoal-500">
                              {formatDate(invoice.issuedOn)}
                            </PTd>
                            <PTd className="whitespace-nowrap text-[10px] text-charcoal-500">
                              {invoice.paidOn ? formatDate(invoice.paidOn) : '—'}
                            </PTd>
                            <PTd className="pc-end">
                              {days === null ? (
                                '—'
                              ) : (
                                <Badge color={days <= 5 ? 'green' : days <= 10 ? 'yellow' : 'gray'}>{`${days}d`}</Badge>
                              )}
                            </PTd>
                          </PTr>
                        )
                      })}
                  </PTbody>
                </PTable>
              </TableWrap>
            )}
          </Panel>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <DetailStat label={t('Outstanding')} value={formatMoney(summary.data.outstanding.value)} tone="red" />
            <DetailStat
              label={t('Share of billed')}
              value={`${summary.data.outstanding.shareOfBilledPercent.toFixed(1)}%`}
            />
            <DetailStat
              label={t('Oldest arrears')}
              value={t('{{count}} days', { count: summary.data.outstanding.oldestDaysLate })}
            />
            <DetailStat
              label={t('Collected this period')}
              value={formatMoney(summary.data.collected.value)}
              tone="brand"
            />
          </div>

          <Panel grow>
            <PanelHead>
              <div className="min-w-0 flex-1">
                <p className="pc-card-label">{t('Unpaid invoices')}</p>
                <p className="mt-0.5 text-[10px] text-charcoal-500">
                  {t('{{amount}} across {{count}} invoice(s)', {
                    amount: formatMoney(outstanding.data?.outstanding ?? 0),
                    count: outstanding.data?.items.length ?? 0,
                  })}
                </p>
              </div>
            </PanelHead>
            {outstanding.isPending ? (
              <PanelLoading />
            ) : outstanding.isError ? (
              <PanelError
                title={t('Could not load the arrears')}
                message={describeApiError(outstanding.error)}
                onRetry={() => void outstanding.refetch()}
              />
            ) : !outstanding.data || outstanding.data.items.length === 0 ? (
              <PanelEmpty title={t('Nothing is overdue')} hint={t('Every invoice is settled.')} />
            ) : (
              <>
                <div className="flex flex-wrap gap-1 border-b border-charcoal-100 px-3 py-1.5">
                  {outstanding.data.buckets.map((bucket) => (
                    <Badge key={bucket.key} color={bucket.count === 0 ? 'gray' : 'orange'}>
                      {bucket.label}: {formatNumber(bucket.count)}
                    </Badge>
                  ))}
                </div>
                <TableWrap>
                  <PTable className="pc-table-sticky">
                    <PThead>
                      <tr>
                        <PTh>{t('Invoice')}</PTh>
                        <PTh>{t('Gym account')}</PTh>
                        <PTh>{t('Plan')}</PTh>
                        <PTh className="pc-end">{t('Amount')}</PTh>
                        <PTh>{t('Due')}</PTh>
                        <PTh className="pc-end">{t('Late')}</PTh>
                      </tr>
                    </PThead>
                    <PTbody>
                      {outstanding.data.items.map((row) => (
                        <PTr key={row.invoiceId} onClick={() => navigate(`/platform/companies/${row.companyId}`)}>
                          <PTd className="whitespace-nowrap font-mono text-[11px] font-semibold text-charcoal-800">
                            {row.invoiceNumber}
                          </PTd>
                          <PTd className="text-[11px] text-charcoal-600">{row.companyName}</PTd>
                          <PTd className="text-[11px] text-charcoal-500">{row.planName}</PTd>
                          <PTd className="pc-end whitespace-nowrap text-xs font-semibold text-charcoal-800">
                            {formatMoney(row.amount)}
                          </PTd>
                          <PTd className="whitespace-nowrap text-[11px] text-charcoal-500">{formatDate(row.dueOn)}</PTd>
                          <PTd className="pc-end whitespace-nowrap text-[11px] font-semibold text-red-600">
                            {t('{{count}} days', { count: row.daysLate })}
                          </PTd>
                        </PTr>
                      ))}
                    </PTbody>
                  </PTable>
                </TableWrap>
              </>
            )}
          </Panel>
        </>
      )}
    </PlatformPage>
  )
}

function averageDaysLabel(invoices: InvoiceListItem[]): string {
  const days = invoices.map(daysToPay).filter((value): value is number => value !== null)
  if (days.length === 0) return '—'
  return `${Math.round(days.reduce((sum, value) => sum + value, 0) / days.length)}d`
}

/** Plan | Gyms billed | Invoiced | Growth vs last month | Collected | Revenue / gym. */
function PlanRevenueTable({
  current,
  previous,
  hasPrevious,
  onOpenCompany,
}: {
  current: InvoiceListItem[]
  previous: InvoiceListItem[]
  hasPrevious: boolean
  onOpenCompany: (companyId: number) => void
}) {
  const { t } = useTranslation()

  const group = (invoices: InvoiceListItem[]) => {
    const map = new Map<string, { plan: string; cycle: string; billed: number; collected: number; gyms: Set<number>; invoices: number }>()
    for (const invoice of invoices) {
      const name = invoice.plan?.name ?? t('No plan')
      const entry = map.get(name) ?? {
        plan: name,
        cycle: invoice.plan?.cycleLabel ?? '',
        billed: 0,
        collected: 0,
        gyms: new Set<number>(),
        invoices: 0,
      }
      entry.billed += invoice.amount
      if (invoice.status === 'Paid') entry.collected += invoice.amount
      entry.gyms.add(invoice.company.id)
      entry.invoices += 1
      map.set(name, entry)
    }
    return map
  }

  const before = group(previous)
  const rows = [...group(current).values()].sort((a, b) => b.billed - a.billed)
  const total = rows.reduce((sum, row) => sum + row.billed, 0)

  if (rows.length === 0) return <PanelEmpty title={t('No invoices in this period')} />

  return (
    <TableWrap>
      <PTable className="pc-table-sticky">
        <PThead>
          <tr>
            <PTh>{t('Plan')}</PTh>
            <PTh>{t('Gyms billed')}</PTh>
            <PTh className="pc-end">{t('Invoiced')}</PTh>
            <PTh>{t('Growth vs last month')}</PTh>
            <PTh className="pc-end">{t('Collected')}</PTh>
            <PTh className="pc-end">{t('Revenue / gym')}</PTh>
          </tr>
        </PThead>
        <PTbody>
          {rows.map((row) => {
            const prev = before.get(row.plan)
            const change = hasPrevious && prev ? ((row.billed - prev.billed) / (prev.billed || 1)) * 100 : null
            const rate = row.billed ? Math.round((row.collected / row.billed) * 100) : 100
            const perGym = row.gyms.size ? Math.round(row.billed / row.gyms.size) : 0
            const firstCompany = current.find((invoice) => (invoice.plan?.name ?? t('No plan')) === row.plan)?.company.id
            return (
              <PTr key={row.plan} onClick={() => firstCompany && onOpenCompany(firstCompany)}>
                <PTd>
                  <p className="text-[11px] font-semibold leading-tight text-charcoal-800">{row.plan}</p>
                  <p className="text-[9px] leading-tight text-charcoal-400">{row.cycle}</p>
                </PTd>
                <PTd className="whitespace-nowrap">
                  <p className="text-[11px] leading-tight text-charcoal-700">
                    {t('{{count}} gym(s)', { count: row.gyms.size })}
                  </p>
                  <p className="text-[9px] leading-tight text-charcoal-400">
                    {t('{{count}} invoice(s)', { count: row.invoices })}
                  </p>
                </PTd>
                <PTd className="pc-end whitespace-nowrap">
                  <p className="text-xs font-semibold leading-tight text-charcoal-800">{formatMoney(row.billed)}</p>
                  <p className="text-[9px] leading-tight text-charcoal-400">
                    {total ? Math.round((row.billed / total) * 100) : 0}% {t('of gross')}
                  </p>
                </PTd>
                <PTd className="whitespace-nowrap">
                  {change === null ? (
                    <span className="text-[10px] text-charcoal-400">—</span>
                  ) : (
                    <Delta value={change} />
                  )}
                </PTd>
                <PTd className="pc-end whitespace-nowrap">
                  <p
                    className={cn(
                      'text-[11px] font-semibold leading-tight',
                      row.collected ? 'text-brand-700' : 'text-charcoal-400',
                    )}
                  >
                    {row.collected ? formatMoney(row.collected) : '—'}
                  </p>
                  <p
                    className={cn(
                      'text-[9px] leading-tight',
                      rate < 100 ? 'font-semibold text-red-600' : 'text-charcoal-400',
                    )}
                  >
                    {rate}% {t('of invoiced')}
                  </p>
                </PTd>
                <PTd className="pc-end whitespace-nowrap">
                  <p className="text-[11px] font-semibold leading-tight text-charcoal-700">
                    {perGym ? formatMoney(perGym) : '—'}
                  </p>
                </PTd>
              </PTr>
            )
          })}
        </PTbody>
      </PTable>
    </TableWrap>
  )
}
