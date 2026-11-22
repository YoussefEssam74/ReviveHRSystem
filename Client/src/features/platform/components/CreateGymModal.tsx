import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Modal } from '../../../components/ui/modal'
import { useToast } from '../../../components/ui/toast'
import { describeApiError } from '../../../lib/api-client'
import { formatMoney } from '../../../lib/format'
import { useCreateBranch, useCreateCompany, usePlans } from '../hooks/usePlatform'

type BranchDraft = { name: string; area: string }

const blankBranch = (): BranchDraft => ({ name: '', area: '' })

/** Derive a short account code from the gym name: "Revive North Coast" → "RNC". */
function suggestCode(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
  return letters.slice(0, 5) || 'GYM'
}

/**
 * Create a gym account: company, its plan subscription and every branch in one
 * pass. The API creates the company plus its primary branch in one transaction,
 * so any extra branch is created straight after against the new id.
 */
export function CreateGymModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated?: (companyId: number) => void
}) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const plans = usePlans()
  const createCompany = useCreateCompany()
  const createBranch = useCreateBranch()

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [city, setCity] = useState('')
  const [planId, setPlanId] = useState('')
  const [startTrial, setStartTrial] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [branches, setBranches] = useState<BranchDraft[]>([blankBranch(), blankBranch()])

  const reset = () => {
    setName('')
    setCode('')
    setCity('')
    setPlanId('')
    setStartTrial(false)
    setContactName('')
    setContactEmail('')
    setContactPhone('')
    setBranches([blankBranch(), blankBranch()])
  }

  const close = () => {
    reset()
    onClose()
  }

  const namedBranches = branches.filter((branch) => branch.name.trim())
  const selectedPlan = plans.data?.items.find((plan) => String(plan.id) === planId)
  const trialOffered = Boolean(selectedPlan && selectedPlan.trialMode !== 'None')
  const ready =
    name.trim().length > 1 &&
    code.trim().length > 0 &&
    planId !== '' &&
    contactEmail.includes('@') &&
    Boolean(namedBranches[0])
  const busy = createCompany.isPending || createBranch.isPending

  const updateBranch = (index: number, patch: Partial<BranchDraft>) =>
    setBranches((current) => current.map((branch, i) => (i === index ? { ...branch, ...patch } : branch)))

  const submit = () => {
    if (!ready) return
    const trimmed = namedBranches.map((branch) => ({ name: branch.name.trim(), area: branch.area.trim() || null }))

    createCompany.mutate(
      {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        city: city.trim() || null,
        primaryBranch: { name: trimmed[0].name, area: trimmed[0].area },
        contact: {
          name: contactName.trim() || null,
          email: contactEmail.trim(),
          phone: contactPhone.trim() || null,
        },
        subscription: { planId: Number(planId), startTrial: trialOffered && startTrial },
        // HR staff are added from the gym record once it exists.
        assignHrLater: true,
      },
      {
        onSuccess: async (created) => {
          const extra = trimmed.slice(1)
          for (const branch of extra) {
            await createBranch.mutateAsync({ companyId: created.id, body: branch }).catch(() => undefined)
          }
          toast(
            t('{{name}} was created with {{count}} branch(es).', {
              name: created.name,
              count: trimmed.length,
            }),
            'success',
          )
          reset()
          onCreated?.(created.id)
        },
        onError: (error) => toast(describeApiError(error), 'error'),
      },
    )
  }

  return (
    <Modal
      open={open}
      title={t('Create gym account')}
      subtitle={t('The account, its subscription and its branches in one step')}
      width="wide"
      onClose={close}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={close}>
            {t('Cancel')}
          </Button>
          <Button size="sm" onClick={submit} loading={busy} disabled={!ready}>
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Create gym account')}
          </Button>
        </>
      }
    >
      <div className="space-y-2.5">
        <div className="grid gap-2.5 sm:grid-cols-3">
          <label className="block sm:col-span-2">
            <span className="pc-label">{t('Gym name')}</span>
            <input
              className="pc-control w-full"
              placeholder={t('Revive North Coast')}
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                if (!code) setCode(suggestCode(event.target.value))
              }}
            />
          </label>
          <label className="block">
            <span className="pc-label">{t('Account code')}</span>
            <input
              className="pc-control w-full font-mono uppercase"
              placeholder="RNC"
              maxLength={8}
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
          </label>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="block">
            <span className="pc-label">{t('City')}</span>
            <input
              className="pc-control w-full"
              placeholder={t('Cairo')}
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="pc-label">{t('Subscription plan')}</span>
            <select className="pc-control w-full" value={planId} onChange={(event) => setPlanId(event.target.value)}>
              <option value="">{t('Choose a plan')}</option>
              {plans.data?.items
                .filter((plan) => !plan.isArchived)
                .map((plan) => (
                  <option key={plan.id} value={String(plan.id)}>
                    {plan.name} — {formatMoney(plan.price, plan.currency)}/{plan.cycleLabel.toLowerCase()}
                  </option>
                ))}
            </select>
          </label>
        </div>

        {trialOffered && (
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5 h-3.5 w-3.5 rounded border-charcoal-300 accent-brand-600"
              checked={startTrial}
              onChange={(event) => setStartTrial(event.target.checked)}
            />
            <span className="min-w-0 text-[11px] text-charcoal-700">
              {t('Start on the free trial — the first invoice is raised when the trial ends.')}
            </span>
          </label>
        )}

        <div className="grid gap-2.5 sm:grid-cols-3">
          <label className="block">
            <span className="pc-label">{t('Billing contact')}</span>
            <input
              className="pc-control w-full"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="pc-label">{t('Contact email')}</span>
            <input
              type="email"
              className="pc-control w-full"
              placeholder="ops@gym.com"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="pc-label">{t('Contact phone')}</span>
            <input
              className="pc-control w-full"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
            />
          </label>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="pc-label mb-0">{t('Branches')}</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setBranches((current) => [...current, blankBranch()])}
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              {t('Add branch')}
            </button>
          </div>
          <div className="space-y-1.5">
            {branches.map((branch, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <input
                  className="pc-control min-w-0 flex-1"
                  placeholder={index === 0 ? t('Primary branch name') : t('Branch name {{number}}', { number: index + 1 })}
                  value={branch.name}
                  onChange={(event) => updateBranch(index, { name: event.target.value })}
                  aria-label={
                    index === 0 ? t('Primary branch name') : t('Branch name {{number}}', { number: index + 1 })
                  }
                />
                <input
                  className="pc-control w-32 flex-shrink-0"
                  placeholder={t('Area')}
                  value={branch.area}
                  onChange={(event) => updateBranch(index, { area: event.target.value })}
                  aria-label={t('Branch area')}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm flex-shrink-0 text-red-600 disabled:opacity-30"
                  disabled={index === 0}
                  onClick={() => setBranches((current) => current.filter((_, i) => i !== index))}
                  aria-label={t('Remove branch')}
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-charcoal-400">
            {t('The first branch is the account head office. Branch codes are generated from the account code.')}
          </p>
        </div>
      </div>
    </Modal>
  )
}
