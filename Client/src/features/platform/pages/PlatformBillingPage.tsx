import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FileText, Plus, Receipt, Search, Send, XCircle } from 'lucide-react'
import { StatusBadge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Modal } from '../../../components/ui/modal'
import { describeApiError } from '../../../lib/api-client'
import { useToast } from '../../../components/ui/toast'
import { formatDate, formatMoney } from '../../../lib/format'
import {
  downloadInvoiceCsv,
  downloadInvoicePdf,
  type InvoiceListItem,
  type InvoiceListParams,
  type SubscriptionPlan,
} from '../api/platform.api'
import {
  useCompanies,
  useCreatePlan,
  useInvoices,
  usePlans,
  useRecordPayment,
  useRevenuePeriods,
  useSavePlan,
  useSendReminder,
  useVoidInvoice,
} from '../hooks/usePlatform'
import {
  Panel,
  PanelEmpty,
  PanelError,
  PanelHead,
  PanelLabel,
  PanelLoading,
  Pager,
  PTbody,
  PTd,
  PTh,
  PTable,
  PThead,
  PTr,
  PlatformPage,
  PlatformPageHeader,
  SummaryItem,
  SummaryStrip,
  TableWrap,
} from '../components/platform-ui'
import { AttentionStrip } from '../components/AttentionStrip'
import { saveBlob } from '../lib/download'

type Action = { kind: 'pay' | 'void'; invoice: InvoiceListItem }

/** Invoice ledger: filter, settle, chase, void and export. */
export default function PlatformBillingPage() {
  const { t } = useTranslation()
  const { toast } = useToast()

  const [status, setStatus] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [period, setPeriod] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [action, setAction] = useState<Action | null>(null)
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState('')
  const [method, setMethod] = useState('BankTransfer')
  const [reference, setReference] = useState('')
  const [voidReason, setVoidReason] = useState('')

  const params = useMemo<InvoiceListParams>(
    () => ({
      status: status || undefined,
      companyId: companyId ? Number(companyId) : undefined,
      period: period || undefined,
      search: search.trim() || undefined,
      pageNumber: page,
      pageSize: 25,
    }),
    [status, companyId, period, search, page],
  )

  const invoices = useInvoices(params)
  const companies = useCompanies({ pageSize: 200 })
  const periods = useRevenuePeriods()
  const recordPayment = useRecordPayment()
  const sendReminder = useSendReminder()
  const voidInvoice = useVoidInvoice()

  const resetTo = (update: () => void) => {
    update()
    setPage(1)
  }

  const openPayment = (invoice: InvoiceListItem) => {
    setAction({ kind: 'pay', invoice })
    setAmount(String(invoice.amount))
    setPaidOn(new Date().toISOString().slice(0, 10))
    setMethod('BankTransfer')
    setReference('')
  }

  const openVoid = (invoice: InvoiceListItem) => {
    setAction({ kind: 'void', invoice })
    setVoidReason('')
  }

  const submit = () => {
    if (!action) return

    if (action.kind === 'pay') {
      const parsed = Number(amount)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        toast(t('Enter an amount greater than zero.'), 'error')
        return
      }
      recordPayment.mutate(
        { id: action.invoice.id, body: { amount: parsed, paidOn: paidOn || null, method, reference: reference || null } },
        {
          onSuccess: (result) => {
            toast(
              t('{{number}} is now {{status}}. {{remaining}} still open.', {
                number: action.invoice.invoiceNumber,
                status: result.status,
                remaining: formatMoney(result.amountRemaining, action.invoice.currency),
              }),
              'success',
            )
            setAction(null)
          },
          onError: () => toast(t('Could not record the payment.'), 'error'),
        },
      )
      return
    }

    if (voidReason.trim().length < 5) {
      toast(t('Give a reason of at least 5 characters.'), 'error')
      return
    }
    voidInvoice.mutate(
      { id: action.invoice.id, reason: voidReason.trim() },
      {
        onSuccess: () => {
          toast(t('{{number}} was voided.', { number: action.invoice.invoiceNumber }), 'success')
          setAction(null)
        },
        onError: () => toast(t('Could not void the invoice.'), 'error'),
      },
    )
  }

  const onRemind = (invoice: InvoiceListItem) => {
    sendReminder.mutate(invoice.id, {
      onSuccess: (result) => {
        if (result.mailConfigured) {
          toast(t('Reminder queued for {{email}}.', { email: result.sentTo ?? invoice.company.name }), 'success')
        } else {
          toast(t('No mail transport is configured — the reminder was logged only.'), 'info')
        }
      },
      onError: () => toast(t('Could not send the reminder.'), 'error'),
    })
  }

  const onPdf = async (invoice: InvoiceListItem) => {
    try {
      const { blob, fileName } = await downloadInvoicePdf(invoice.id, invoice.invoiceNumber)
      saveBlob(blob, fileName ?? `${invoice.invoiceNumber}.pdf`)
    } catch {
      toast(t('Could not download the invoice.'), 'error')
    }
  }

  const onExport = async () => {
    try {
      const { blob, fileName } = await downloadInvoiceCsv(params)
      saveBlob(blob, fileName ?? 'platform-invoices.csv')
    } catch {
      toast(t('Could not export the ledger.'), 'error')
    }
  }

  const summary = invoices.data?.summary

  return (
    <PlatformPage>
      <PlatformPageHeader
        title={t('Billing & quotas')}
        subtitle={t('Subscription invoices across every company')}
        actions={
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void onExport()}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Export CSV')}
          </button>
        }
      />

      <AttentionStrip types={['InvoiceOverdue']} />

      {summary && (
        <SummaryStrip>
          <SummaryItem label={t('Billed')} value={formatMoney(summary.billed)} />
          <SummaryItem label={t('Collected')} value={formatMoney(summary.collected)} tone="green" />
          <SummaryItem
            label={t('Outstanding')}
            value={formatMoney(summary.outstanding)}
            tone={summary.outstanding > 0 ? 'amber' : undefined}
          />
          <SummaryItem label={t('Open invoices')} value={summary.openInvoices} />
          <SummaryItem
            label={t('Overdue')}
            value={summary.overdueInvoices}
            tone={summary.overdueInvoices > 0 ? 'red' : undefined}
          />
        </SummaryStrip>
      )}

      <div className="pc-grow grid min-h-0 gap-2.5 xl:grid-cols-[minmax(0,1fr)_288px]">
        <Panel grow className="min-w-0">
          <PanelHead className="border-b-0">
            <PanelLabel>{t('Invoice ledger')}</PanelLabel>
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              className="pc-control w-auto"
              value={status}
              onChange={(event) => resetTo(() => setStatus(event.target.value))}
              aria-label={t('Filter by status')}
            >
              <option value="">{t('Any status')}</option>
              <option value="Draft">{t('Draft')}</option>
              <option value="Issued">{t('Issued')}</option>
              <option value="PartiallyPaid">{t('Partially paid')}</option>
              <option value="Paid">{t('Paid')}</option>
              <option value="Overdue">{t('Overdue')}</option>
              <option value="Void">{t('Void')}</option>
            </select>
            <select
              className="pc-control w-auto"
              value={companyId}
              onChange={(event) => resetTo(() => setCompanyId(event.target.value))}
              aria-label={t('Filter by company')}
            >
              <option value="">{t('Every company')}</option>
              {companies.data?.items.map((company) => (
                <option key={company.id} value={String(company.id)}>
                  {company.name}
                </option>
              ))}
            </select>
            <select
              className="pc-control w-auto"
              value={period}
              onChange={(event) => resetTo(() => setPeriod(event.target.value))}
              aria-label={t('Filter by period')}
            >
              <option value="">{t('Every period')}</option>
              {periods.data?.periods.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-2 top-1/2 h-3 w-3 -translate-y-1/2 text-charcoal-400"
                aria-hidden="true"
              />
              <input
                className="pc-control w-44 ps-6"
                placeholder={t('Search invoice or company')}
                value={search}
                onChange={(event) => resetTo(() => setSearch(event.target.value))}
                aria-label={t('Search invoices')}
              />
            </div>
          </div>
        </PanelHead>

        {invoices.isPending ? (
          <PanelLoading />
        ) : invoices.isError ? (
          <PanelError
            title={t('Could not load the ledger')}
            message={describeApiError(invoices.error)}
            onRetry={() => void invoices.refetch()}
          />
        ) : invoices.data.items.length === 0 ? (
          <PanelEmpty icon={Receipt} title={t('No invoices match')} hint={t('Try clearing the filters.')} />
        ) : (
          <>
            <TableWrap>
              <PTable className="pc-table-sticky">
                <PThead>
                  <tr>
                    <PTh>{t('Invoice')}</PTh>
                    <PTh>{t('Gym account')}</PTh>
                    <PTh>{t('Period')}</PTh>
                    <PTh>{t('Plan')}</PTh>
                    <PTh className="pc-end">{t('Amount')}</PTh>
                    <PTh>{t('Status')}</PTh>
                    <PTh>{t('Start')}</PTh>
                    <PTh>{t('End')}</PTh>
                    <PTh className="pc-end">{t('Actions')}</PTh>
                  </tr>
                </PThead>
                <PTbody>
                  {invoices.data.items.map((invoice) => {
                    const settled = invoice.status === 'Paid' || invoice.status === 'Void'
                    return (
                      <PTr key={invoice.id}>
                        <PTd>
                          <span className="block font-mono text-[11px] font-semibold leading-tight text-charcoal-800">
                            {invoice.invoiceNumber}
                          </span>
                          <span className="block text-[10px] leading-tight text-charcoal-400">
                            {formatDate(invoice.issuedOn)}
                          </span>
                        </PTd>
                        <PTd>
                          <div className="max-w-[150px]">
                            <p className="truncate text-[11px] font-medium leading-tight text-charcoal-700">
                              {invoice.company.name}
                            </p>
                            <p className="truncate text-[9px] leading-tight text-charcoal-400">
                              {invoice.company.city ?? ''}
                            </p>
                          </div>
                        </PTd>
                        <PTd className="whitespace-nowrap text-[11px] text-charcoal-600">{invoice.periodLabel}</PTd>
                        <PTd className="whitespace-nowrap">
                          <p className="text-[11px] leading-tight text-charcoal-700">{invoice.plan?.name ?? '—'}</p>
                          <p className="text-[9px] leading-tight text-charcoal-400">{invoice.plan?.cycleLabel ?? ''}</p>
                        </PTd>
                        <PTd className="pc-end whitespace-nowrap text-xs font-semibold text-charcoal-800">
                          {formatMoney(invoice.amount, invoice.currency)}
                        </PTd>
                        <PTd className="whitespace-nowrap">
                          <StatusBadge status={invoice.status} />
                          {invoice.daysOverdue > 0 && (
                            <p className="mt-0.5 text-[9px] font-semibold text-red-600">
                              {t('{{count}}d late', { count: invoice.daysOverdue })}
                            </p>
                          )}
                        </PTd>
                        <PTd className="whitespace-nowrap font-mono text-[10px] text-charcoal-500">
                          {invoice.subscriptionStart ? formatDate(invoice.subscriptionStart) : '—'}
                        </PTd>
                        <PTd className="whitespace-nowrap font-mono text-[10px] text-charcoal-500">
                          {invoice.subscriptionEnd ? formatDate(invoice.subscriptionEnd) : '—'}
                        </PTd>
                        <PTd>
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              className="rounded p-1 text-charcoal-400 hover:bg-charcoal-100 hover:text-charcoal-700"
                              title={t('Download PDF')}
                              aria-label={t('Download PDF')}
                              onClick={() => void onPdf(invoice)}
                            >
                              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            {!settled && (
                              <>
                                <button
                                  type="button"
                                  className="rounded p-1 text-charcoal-400 hover:bg-charcoal-100 hover:text-charcoal-700"
                                  title={t('Send reminder')}
                                  aria-label={t('Send reminder')}
                                  onClick={() => onRemind(invoice)}
                                >
                                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  className="rounded p-1 text-charcoal-400 hover:bg-charcoal-100 hover:text-brand-600"
                                  title={t('Record payment')}
                                  aria-label={t('Record payment')}
                                  onClick={() => openPayment(invoice)}
                                >
                                  <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  className="rounded p-1 text-charcoal-400 hover:bg-red-50 hover:text-red-600"
                                  title={t('Void')}
                                  aria-label={t('Void')}
                                  onClick={() => openVoid(invoice)}
                                >
                                  <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </>
                            )}
                          </div>
                        </PTd>
                      </PTr>
                    )
                  })}
                </PTbody>
              </PTable>
            </TableWrap>
            <Pager
              page={invoices.data.page}
              pageSize={invoices.data.pageSize}
              total={invoices.data.totalCount}
              totalPages={invoices.data.totalPages}
              onPageChange={setPage}
              noun={t('invoices')}
            />
          </>
        )}
        </Panel>

        <PlanRail />
      </div>

      <Modal
        open={action?.kind === 'pay'}
        title={t('Record payment')}
        subtitle={action?.invoice.invoiceNumber}
        onClose={() => setAction(null)}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setAction(null)}>
              {t('Cancel')}
            </Button>
            <Button size="sm" onClick={submit} loading={recordPayment.isPending}>
              {t('Record')}
            </Button>
          </>
        }
      >
        <div className="space-y-2.5">
          <label className="block">
            <span className="pc-label">{t('Amount')}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              className="pc-control w-full"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="pc-label">{t('Paid on')}</span>
            <input
              type="date"
              className="pc-control w-full"
              value={paidOn}
              onChange={(event) => setPaidOn(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="pc-label">{t('Method')}</span>
            <select className="pc-control w-full" value={method} onChange={(event) => setMethod(event.target.value)}>
              <option value="BankTransfer">{t('Bank transfer')}</option>
              <option value="Card">{t('Card')}</option>
              <option value="Cash">{t('Cash')}</option>
              <option value="Cheque">{t('Cheque')}</option>
            </select>
          </label>
          <label className="block">
            <span className="pc-label">{t('Reference')}</span>
            <input className="pc-control w-full" value={reference} onChange={(event) => setReference(event.target.value)} />
          </label>
        </div>
      </Modal>

      <Modal
        open={action?.kind === 'void'}
        title={t('Void invoice')}
        subtitle={action?.invoice.invoiceNumber}
        onClose={() => setAction(null)}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setAction(null)}>
              {t('Cancel')}
            </Button>
            <Button variant="danger" size="sm" onClick={submit} loading={voidInvoice.isPending}>
              {t('Void invoice')}
            </Button>
          </>
        }
      >
        <div className="space-y-2.5">
          <p className="rounded-md border border-charcoal-200 bg-charcoal-50 px-2.5 py-2 text-[10px] leading-relaxed text-charcoal-600">
            {t(
              'Voiding cancels an invoice that should never have been issued — it stays on the ledger for audit, stops counting towards outstanding revenue, and its number is retired so it is never reused. Payments already recorded must be refunded outside the ledger first.',
            )}
          </p>
          <label className="block">
            <span className="pc-label">{t('Reason')}</span>
            <input
              className="pc-control w-full"
              placeholder={t('Why is this invoice being voided?')}
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
            />
          </label>
        </div>
      </Modal>
    </PlatformPage>
  )
}

/** Catalogue the mock offers as checkboxes; anything else arrives as a custom line. */
const FEATURE_CATALOG = [
  'Employee records & document vault',
  'Biometric attendance kiosk',
  'Leave, shift & deduction requests',
  'Payslip generation',
  'Employee self-service portal',
  'Multi-branch scoping & transfers',
  'Recruitment & hiring pipeline',
  'Payroll approval and locking',
  'Performance evaluation cycles',
  'Reports & analytics',
  'Gym audit trail',
  'Dedicated success manager',
]

type PlanAddOnDraft = { name: string; quantity: string; price: string }

type PlanDraft = {
  id: number | null
  name: string
  /** The API still stores a tagline; the console no longer edits it. */
  tagline: string
  price: string
  cycleCount: string
  cycleUnit: string
  trialMode: string
  trialDays: string
  seatLimit: string
  branchLimit: string
  isHighlighted: boolean
  features: string[]
  customFeatures: string[]
  addOns: PlanAddOnDraft[]
}

/**
 * Plan catalogue side rail (mock parity): the plan a quota belongs to, its price,
 * limits and live revenue footprint, plus the editor the API already supports.
 */
function PlanRail() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const plans = usePlans()
  const createPlan = useCreatePlan()
  const savePlan = useSavePlan()
  const [draft, setDraft] = useState<PlanDraft | null>(null)
  const [featureInput, setFeatureInput] = useState('')

  const openCreate = () => {
    setFeatureInput('')
    setDraft({
      id: null,
      name: '',
      tagline: '',
      price: '0',
      cycleCount: '1',
      cycleUnit: 'Months',
      trialMode: 'None',
      trialDays: '0',
      seatLimit: '',
      branchLimit: '',
      isHighlighted: false,
      features: [],
      customFeatures: [],
      // A fresh plan already shows one priced extra so the pattern is obvious.
      addOns: [{ name: 'Extra employees', quantity: '5', price: '100' }],
    })
  }

  const openEdit = (plan: SubscriptionPlan) => {
    setFeatureInput('')
    setDraft({
      id: plan.id,
      name: plan.name,
      tagline: plan.tagline ?? '',
      price: String(plan.price),
      cycleCount: String(plan.cycleCount),
      cycleUnit: plan.cycleUnit,
      trialMode: plan.trialMode,
      trialDays: String(plan.trialDays),
      seatLimit: plan.seatLimit === null ? '' : String(plan.seatLimit),
      branchLimit: plan.branchLimit === null ? '' : String(plan.branchLimit),
      isHighlighted: plan.isHighlighted,
      features: plan.features.filter((feature) => FEATURE_CATALOG.includes(feature)),
      customFeatures: plan.features.filter((feature) => !FEATURE_CATALOG.includes(feature)),
      addOns: plan.addOns.map((addOn) => ({
        name: addOn.name,
        quantity: String(addOn.quantity),
        price: String(addOn.price),
      })),
    })
  }

  const submit = () => {
    if (!draft) return
    const body = {
      name: draft.name.trim(),
      tagline: draft.tagline.trim() || null,
      price: Number(draft.price) || 0,
      cycleCount: Math.max(1, Number(draft.cycleCount) || 1),
      cycleUnit: draft.cycleUnit,
      trialMode: draft.trialMode,
      trialDays: Math.max(0, Number(draft.trialDays) || 0),
      seatLimit: draft.seatLimit.trim() === '' ? null : Number(draft.seatLimit),
      branchLimit: draft.branchLimit.trim() === '' ? null : Number(draft.branchLimit),
      isHighlighted: draft.isHighlighted,
      features: [...draft.features, ...draft.customFeatures],
      addOns: draft.addOns
        .map((addOn) => ({
          name: addOn.name.trim(),
          quantity: Math.max(1, Number(addOn.quantity) || 1),
          price: Math.max(0, Number(addOn.price) || 0),
        }))
        .filter((addOn) => addOn.name.length > 0 && addOn.price > 0),
    }

    const onSuccess = () => {
      toast(draft.id === null ? t('Plan created.') : t('Plan updated.'), 'success')
      setDraft(null)
    }
    const onError = () => toast(t('Could not save the plan.'), 'error')

    if (draft.id === null) createPlan.mutate(body, { onSuccess, onError })
    else savePlan.mutate({ id: draft.id, body }, { onSuccess, onError })
  }

  const busy = createPlan.isPending || savePlan.isPending

  const toggleFeature = (feature: string) => {
    if (!draft) return
    setDraft({
      ...draft,
      features: draft.features.includes(feature)
        ? draft.features.filter((value) => value !== feature)
        : [...draft.features, feature],
    })
  }

  const addCustomFeature = () => {
    if (!draft) return
    const value = featureInput.trim()
    if (!value) return
    const known = [...FEATURE_CATALOG, ...draft.customFeatures].some(
      (feature) => feature.toLowerCase() === value.toLowerCase(),
    )
    if (known) {
      toast(t('That feature is already in the list.'), 'error')
      setFeatureInput('')
      return
    }
    setDraft({ ...draft, customFeatures: [...draft.customFeatures, value] })
    setFeatureInput('')
  }

  const updateAddOn = (index: number, patch: Partial<PlanAddOnDraft>) => {
    if (!draft) return
    setDraft({
      ...draft,
      addOns: draft.addOns.map((addOn, i) => (i === index ? { ...addOn, ...patch } : addOn)),
    })
  }

  return (
    <>
      <Panel className="flex min-h-0 flex-col xl:max-h-full">
        <PanelHead className="flex-shrink-0">
          <PanelLabel>{t('Subscription plans')}</PanelLabel>
          <button type="button" className="btn btn-secondary btn-sm" onClick={openCreate}>
            <Plus className="h-3 w-3" aria-hidden="true" />
            {t('New')}
          </button>
        </PanelHead>

        {plans.isPending ? (
          <PanelLoading />
        ) : plans.isError ? (
          <PanelError
            title={t('Could not load the plans')}
            message={describeApiError(plans.error)}
            onRetry={() => void plans.refetch()}
            compact
          />
        ) : plans.data.items.length === 0 ? (
          <PanelEmpty title={t('No plans configured')} />
        ) : (
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
            {[...plans.data.items]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((plan) => (
                <div key={plan.id} className="rounded-md border border-charcoal-200 bg-white px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-bold text-charcoal-800">{plan.name}</p>
                    <span className="flex-shrink-0 text-[10px] font-semibold text-brand-700">
                      {formatMoney(plan.price, plan.currency)}
                      <span className="font-normal text-charcoal-400">/{plan.cycleLabel.toLowerCase()}</span>
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-charcoal-500">
                    {plan.seatLimit === null ? t('Unlimited seats') : t('{{count}} seats', { count: plan.seatLimit })}
                    {' · '}
                    {plan.branchLimit === null
                      ? t('unlimited branches')
                      : plan.branchLimit === 1
                        ? t('1 branch')
                        : t('{{count}} branches', { count: plan.branchLimit })}
                    {plan.addOns.length > 0 &&
                      ` · ${plan.addOns.length === 1 ? t('1 add-on') : t('{{count}} add-ons', { count: plan.addOns.length })}`}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[9px] text-charcoal-400">
                    <span>
                      {plan.companiesOnPlan === 1 ? t('1 gym') : t('{{count}} gyms', { count: plan.companiesOnPlan })}
                    </span>
                    <span className="font-semibold text-charcoal-600">
                      {formatMoney(plan.mrr, plan.currency)} {t('MRR')}
                    </span>
                  </div>
                  <div className="pc-meter mt-1">
                    <div
                      className="pc-meter-fill"
                      style={{ width: `${Math.min(100, Math.max(0, plan.mrrSharePercent))}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    {plan.isArchived ? (
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-charcoal-400">
                        {t('Archived')}
                      </span>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      className="text-[10px] font-semibold text-brand-700 hover:underline"
                      onClick={() => openEdit(plan)}
                    >
                      {t('Edit')}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </Panel>

      <Modal
        open={draft !== null}
        title={draft?.id === null ? t('Create plan') : t('Edit plan')}
        subtitle={
          draft?.id === null
            ? t('Define the commercial terms of a subscription tier')
            : t('Changes apply to new sign-ups; existing gyms keep their terms until renewal')
        }
        width="wide"
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setDraft(null)}>
              {t('Cancel')}
            </Button>
            <Button size="sm" onClick={submit} loading={busy} disabled={!draft?.name.trim()}>
              {draft?.id === null ? t('Create plan') : t('Save plan')}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-2.5">
            <div className="grid gap-2.5 sm:grid-cols-3">
              <label className="block sm:col-span-2">
                <span className="pc-label">{t('Plan name')}</span>
                <input
                  className="pc-control w-full"
                  placeholder={t('e.g. Scale')}
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </label>
              <label className="block">
                <span className="pc-label">{t('Price (EGP)')}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="pc-control w-full"
                  value={draft.price}
                  onChange={(event) => setDraft({ ...draft, price: event.target.value })}
                />
              </label>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="block">
                <span className="pc-label">{t('Billed every')}</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    className="pc-control w-14 flex-shrink-0"
                    value={draft.cycleCount}
                    onChange={(event) => setDraft({ ...draft, cycleCount: event.target.value })}
                    aria-label={t('Billing cycle length')}
                  />
                  <select
                    className="pc-control min-w-0 flex-1"
                    value={draft.cycleUnit}
                    onChange={(event) => setDraft({ ...draft, cycleUnit: event.target.value })}
                    aria-label={t('Billing cycle unit')}
                  >
                    <option value="Months">{t('month(s)')}</option>
                    <option value="Years">{t('year(s)')}</option>
                  </select>
                </div>
              </div>
              <div className="block sm:col-span-2">
                <span className="pc-label">{t('Trial')}</span>
                <div className="flex items-center gap-2">
                  <select
                    className="pc-control min-w-0 flex-1"
                    value={draft.trialMode}
                    onChange={(event) => setDraft({ ...draft, trialMode: event.target.value })}
                  >
                    <option value="None">{t('No trial — paid from day one')}</option>
                    <option value="Days">{t('Free trial before billing starts')}</option>
                    <option value="TrialPlan">{t('This is a trial plan (never billed)')}</option>
                  </select>
                  {draft.trialMode === 'Days' && (
                    <span className="flex flex-shrink-0 items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        className="pc-control w-16"
                        value={draft.trialDays}
                        onChange={(event) => setDraft({ ...draft, trialDays: event.target.value })}
                        aria-label={t('Trial days')}
                      />
                      <span className="whitespace-nowrap text-[10px] text-charcoal-500">{t('days')}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="block">
                <span className="pc-label">{t('Seat limit')}</span>
                <input
                  type="number"
                  min="1"
                  className="pc-control w-full"
                  placeholder={t('Unlimited')}
                  value={draft.seatLimit}
                  onChange={(event) => setDraft({ ...draft, seatLimit: event.target.value })}
                />
              </label>
              <label className="block">
                <span className="pc-label">{t('Branch limit')}</span>
                <input
                  type="number"
                  min="1"
                  className="pc-control w-full"
                  placeholder={t('Unlimited')}
                  value={draft.branchLimit}
                  onChange={(event) => setDraft({ ...draft, branchLimit: event.target.value })}
                />
              </label>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="pc-label mb-0">{t('Included features')}</span>
                <span className="text-[10px] text-charcoal-500">
                  <span className="font-semibold text-charcoal-800">
                    {draft.features.length + draft.customFeatures.length}
                  </span>{' '}
                  {t('selected')}
                </span>
              </div>
              <div className="grid max-h-[26vh] grid-cols-1 gap-x-3 gap-y-1 overflow-y-auto rounded-lg border border-charcoal-200 px-2.5 py-2 sm:grid-cols-2">
                {[...FEATURE_CATALOG, ...draft.customFeatures].map((feature) => (
                  <label key={feature} className="flex items-start gap-1.5">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3 w-3 flex-shrink-0 rounded border-charcoal-300 accent-brand-600"
                      checked={draft.features.includes(feature) || draft.customFeatures.includes(feature)}
                      onChange={() => toggleFeature(feature)}
                    />
                    <span className="text-[10px] leading-snug text-charcoal-700">{feature}</span>
                  </label>
                ))}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <input
                  className="pc-control min-w-0 flex-1"
                  placeholder={t('Add another feature…')}
                  value={featureInput}
                  onChange={(event) => setFeatureInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    addCustomFeature()
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm flex-shrink-0"
                  onClick={addCustomFeature}
                >
                  {t('Add')}
                </button>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="pc-label mb-0">{t('Add-ons & overage')}</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setDraft({ ...draft, addOns: [...draft.addOns, { name: '', quantity: '1', price: '0' }] })}
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                  {t('Add line')}
                </button>
              </div>
              <div className="space-y-1.5">
                {draft.addOns.length === 0 ? (
                  <p className="text-[10px] text-charcoal-400">{t('No add-ons — this plan has a fixed price.')}</p>
                ) : (
                  draft.addOns.map((addOn, index) => (
                    <div key={index} className="flex items-center gap-1.5">
                      <input
                        className="pc-control min-w-0 flex-1"
                        placeholder={t('e.g. Extra employees')}
                        value={addOn.name}
                        onChange={(event) => updateAddOn(index, { name: event.target.value })}
                        aria-label={t('Add-on name')}
                      />
                      <span className="flex-shrink-0 text-[10px] text-charcoal-400">{t('per')}</span>
                      <input
                        type="number"
                        min="1"
                        className="pc-control w-14 flex-shrink-0"
                        value={addOn.quantity}
                        onChange={(event) => updateAddOn(index, { quantity: event.target.value })}
                        aria-label={t('Add-on size')}
                      />
                      <span className="flex-shrink-0 text-[10px] text-charcoal-400">EGP</span>
                      <input
                        type="number"
                        min="0"
                        className="pc-control w-20 flex-shrink-0"
                        value={addOn.price}
                        onChange={(event) => updateAddOn(index, { price: event.target.value })}
                        aria-label={t('Add-on price')}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm flex-shrink-0 text-red-600"
                        onClick={() => setDraft({ ...draft, addOns: draft.addOns.filter((_, i) => i !== index) })}
                        aria-label={t('Remove add-on')}
                      >
                        <XCircle className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <p className="mt-1 text-[10px] text-charcoal-400">
                {t('Charge for going past the allowance — e.g. extra 5 employees for EGP 100. Leave empty for a fixed plan.')}
              </p>
            </div>

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 rounded border-charcoal-300 accent-brand-600"
                checked={draft.isHighlighted}
                onChange={(event) => setDraft({ ...draft, isHighlighted: event.target.checked })}
              />
              <span className="text-[11px] text-charcoal-700">{t('Mark as the recommended plan')}</span>
            </label>
            <p className="text-[10px] text-charcoal-400">
              {t('Leave a limit empty for unlimited. Existing gyms are re-seated only when you change their plan.')}
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}
