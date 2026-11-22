import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Download, TrendingDown, TrendingUp } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { describeApiError } from '../../../lib/api-client'
import { useToast } from '../../../components/ui/toast'
import { formatDate, formatMoney } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import { downloadRevenueCsv } from '../api/platform.api'
import { useRevenuePerCompany, useRevenuePeriods, useRevenueSummary, useRevenueTrend } from '../hooks/usePlatform'
import {
  MetricCard,
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
  PanelLoading,
  PlatformPage,
  PlatformPageHeader,
  TableWrap,
  GymMark,
} from '../components/platform-ui'
import { AttentionStrip } from '../components/AttentionStrip'
import { MonthChart } from '../components/MonthChart'
import { saveBlob } from '../lib/download'

/** Revenue Analytics landing page: four headline figures, the trend and the per-gym ledger. */
export default function PlatformRevenuePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [period, setPeriod] = useState('')

  const periods = useRevenuePeriods()
  const summary = useRevenueSummary(period || undefined)
  const trend = useRevenueTrend(12)
  const perCompany = useRevenuePerCompany(period || undefined)

  const exportMetric = async (metric: string) => {
    try {
      const { blob, fileName } = await downloadRevenueCsv(metric, period || undefined)
      saveBlob(blob, fileName ?? `platform-${metric}.csv`)
    } catch {
      toast(t('Could not export the figures.'), 'error')
    }
  }

  return (
    <PlatformPage>
      <PlatformPageHeader
        title={t('Revenue Analytics')}
        subtitle={
          summary.data
            ? t('{{mrr}} recurring · {{billed}} billed in {{period}}', {
                mrr: formatMoney(summary.data.mrr.value),
                billed: formatMoney(summary.data.gross.value),
                period: summary.data.period,
              })
            : t('Recurring revenue, collections and arrears')
        }
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
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void exportMetric('summary')}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {t('Export')}
            </button>
          </>
        }
      />

      <AttentionStrip types={['InvoiceOverdue']} />

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
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <MetricCard
              to="/platform/revenue/mrr"
              label={t('MRR')}
              value={formatMoney(summary.data.mrr.value)}
              sub={t('{{paying}} of {{total}} gyms paying · {{share}} each', {
                paying: summary.data.mrr.payingCompanies,
                total: summary.data.mrr.totalCompanies,
                share: formatMoney(summary.data.mrr.averagePerCompany),
              })}
            />
            <MetricCard
              to="/platform/revenue/gross"
              label={t('Revenue growth')}
              value={formatMoney(summary.data.gross.value)}
              sub={t('{{change}}% vs last month · {{count}} invoice(s)', {
                change: summary.data.gross.changePercent.toFixed(1),
                count: summary.data.gross.invoiceCount,
              })}
              tone={summary.data.gross.changePercent < 0 ? 'red' : undefined}
            />
            <MetricCard
              to="/platform/revenue/collected"
              label={t('Collected')}
              value={formatMoney(summary.data.collected.value)}
              sub={t('{{rate}}% of billed · {{paid}} paid', {
                rate: summary.data.collected.collectionRatePercent.toFixed(1),
                paid: summary.data.collected.invoicesPaid,
              })}
              tone={summary.data.collected.value < summary.data.gross.value ? 'amber' : undefined}
            />
            <MetricCard
              to="/platform/revenue/outstanding"
              label={t('Outstanding')}
              value={formatMoney(summary.data.outstanding.value)}
              sub={
                summary.data.outstanding.value > 0
                  ? t('oldest {{days}} day(s) late', { days: summary.data.outstanding.oldestDaysLate })
                  : t('fully settled')
              }
              tone={summary.data.outstanding.value > 0 ? 'red' : undefined}
            />
          </div>

          <Panel>
            <PanelHead>
              <div className="min-w-0 flex-1">
                <p className="pc-card-label">{t('Recurring revenue · last 12 months')}</p>
                <p className="mt-0.5 text-[10px] text-charcoal-500">
                  {t('Monthly recurring revenue at the end of each month')}
                </p>
              </div>
              <Delta value={trend.data?.changePercent ?? 0} />
            </PanelHead>
            <div className="px-3 py-2.5">
              {trend.isPending ? (
                <PanelLoading />
              ) : !trend.data ||
                trend.data.series.length === 0 ||
                trend.data.series.every((point) => point.mrr === 0) ? (
                <PanelEmpty
                  title={t('No trend data yet')}
                  hint={t('Monthly recurring revenue appears once billing starts.')}
                />
              ) : (
                <MonthChart
                  rows={trend.data.series.map((point) => ({ label: point.label, value: point.mrr }))}
                  currentLabel={trend.data.series[trend.data.series.length - 1]?.label}
                  ariaLabel={t('MRR by month')}
                />
              )}
            </div>
          </Panel>

          <Panel grow>
            <PanelHead>
              <div className="min-w-0 flex-1">
                <p className="pc-card-label">{t('Revenue per gym')}</p>
                <p className="mt-0.5 text-[10px] text-charcoal-500">
                  {t('{{period}} · sorted by recurring revenue', {
                    period: perCompany.data?.period ?? summary.data.period,
                  })}
                </p>
              </div>
              <Badge color="gray">{t('{{count}} accounts', { count: perCompany.data?.items.length ?? 0 })}</Badge>
            </PanelHead>

            {perCompany.isPending ? (
              <PanelLoading />
            ) : perCompany.isError ? (
              <PanelError
                title={t('Could not load the revenue split')}
                message={describeApiError(perCompany.error)}
                onRetry={() => void perCompany.refetch()}
              />
            ) : !perCompany.data || perCompany.data.items.length === 0 ? (
              <PanelEmpty title={t('No gym accounts bill yet')} />
            ) : (
              <TableWrap>
                <PTable className="pc-table-sticky">
                  <PThead>
                    <tr>
                      <PTh>{t('Gym account')}</PTh>
                      <PTh>{t('Plan')}</PTh>
                      <PTh className="pc-end">{t('MRR')}</PTh>
                      <PTh className="w-32">{t('Share of MRR')}</PTh>
                      <PTh className="pc-end">{t('Collected')}</PTh>
                      <PTh className="pc-end">{t('Outstanding')}</PTh>
                      <PTh>{t('Renews')}</PTh>
                      <PTh>{t('Status')}</PTh>
                    </tr>
                  </PThead>
                  <PTbody>
                    {[...perCompany.data.items]
                      .sort((a, b) => b.mrr - a.mrr)
                      .map((row) => {
                        const status = settlementBadge(row.settlementStatus, row.mrr)
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
                                    {[row.city, row.code].filter(Boolean).join(' · ')}
                                  </p>
                                </div>
                              </div>
                            </PTd>
                            <PTd className="whitespace-nowrap">
                              <p className="text-[11px] leading-tight text-charcoal-700">{row.planName}</p>
                              <p className="text-[9px] leading-tight text-charcoal-400">{row.cycleLabel}</p>
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
                            <PTd
                              className={cn(
                                'pc-end whitespace-nowrap text-[11px] font-semibold',
                                row.collected > 0 ? 'text-brand-700' : 'text-charcoal-400',
                              )}
                            >
                              {row.collected > 0 ? formatMoney(row.collected) : '—'}
                            </PTd>
                            <PTd
                              className={cn(
                                'pc-end whitespace-nowrap text-[11px] font-semibold',
                                row.outstanding > 0 ? 'text-red-600' : 'text-charcoal-400',
                              )}
                            >
                              {row.outstanding > 0 ? formatMoney(row.outstanding) : '—'}
                            </PTd>
                            <PTd className="whitespace-nowrap">
                              <p className="text-[10px] leading-tight text-charcoal-600">
                                {row.renewsOn ? formatDate(row.renewsOn) : '—'}
                              </p>
                              <p className="text-[9px] leading-tight text-charcoal-400">{row.billingCycle ?? ''}</p>
                            </PTd>
                            <PTd>
                              <Badge color={status.color}>{status.label}</Badge>
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
      )}
    </PlatformPage>
  )
}

/** Settlement badge: trial, overdue, part-paid or settled. */
function settlementBadge(
  settlementStatus: string,
  mrr: number,
): { label: string; color: 'blue' | 'red' | 'yellow' | 'green' | 'gray' } {
  const value = settlementStatus.toLowerCase()
  if (value.includes('overdue')) return { label: 'Overdue', color: 'red' }
  if (value.includes('part') || value.includes('partial')) return { label: 'Part paid', color: 'yellow' }
  if (value.includes('settled') || value.includes('paid')) return { label: 'Settled', color: 'green' }
  if (mrr === 0) return { label: 'Trial', color: 'blue' }
  return { label: settlementStatus, color: 'gray' }
}

function Delta({ value }: { value: number }) {
  // A flat month is a real reading, not missing data.
  if (!Number.isFinite(value)) return <span className="badge badge-gray">—</span>
  if (value === 0) return <span className="badge badge-gray">0.0%</span>
  const up = value > 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] ${up ? 'text-brand-700' : 'text-red-600'}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {up ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  )
}

