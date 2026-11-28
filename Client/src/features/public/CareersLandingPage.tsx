import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Briefcase, Building2, MapPin, Search, SearchX, Sparkles } from 'lucide-react'
import { ErrorState } from '../../components/async-state'
import { EmptyState } from '../../components/ui/empty-state'
import { GymLogo } from '../../components/ui/gym-logo'
import { Input } from '../../components/ui/input'
import { Skeleton } from '../../components/ui/skeleton'
import { describeApiError } from '../../lib/api-client'
import { formatDate } from '../../lib/format'
import { cn } from '../../lib/utils'
import { getPublicHiringForms, type HiringFormListItem } from './apply.api'

const ALL_BRANCHES = '*'

export default function CareersLandingPage() {
  const { t } = useTranslation()
  const [forms, setForms] = useState<HiringFormListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [search, setSearch] = useState('')
  const [branch, setBranch] = useState(ALL_BRANCHES)

  useEffect(() => {
    const controller = new AbortController()
    getPublicHiringForms({ signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return
        setForms(data.items)
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(describeApiError(err))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [reloadKey])

  const reload = () => {
    setLoading(true)
    setError(null)
    setReloadKey((key) => key + 1)
  }

  const branches = useMemo(() => {
    const names = forms.map((form) => form.gym).filter((gym) => gym && gym !== 'All')
    return [...new Set(names)].sort((a, b) => a.localeCompare(b))
  }, [forms])

  const visibleForms = useMemo(() => {
    const term = search.trim().toLowerCase()
    return forms.filter((form) => {
      if (branch !== ALL_BRANCHES && form.gym !== branch) return false
      if (!term) return true
      return `${form.name} ${form.position ?? ''} ${form.description ?? ''} ${form.gym}`.toLowerCase().includes(term)
    })
  }, [forms, branch, search])

  const filtersApplied = branch !== ALL_BRANCHES || search.trim().length > 0
  const clearFilters = () => {
    setBranch(ALL_BRANCHES)
    setSearch('')
  }

  const countLabel = loading
    ? t('Loading…')
    : forms.length === 0
      ? t('No positions are published right now.')
      : filtersApplied
        ? t('{{visible}} of {{total}} match', { visible: visibleForms.length, total: forms.length })
        : forms.length === 1
          ? t('1 position is open right now')
          : t('{{count}} positions are open right now', { count: forms.length })

  return (
    <div>
      <section className="relative isolate overflow-hidden border-b border-slate-200">
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-emerald-50 via-white to-slate-50" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -start-24 -top-28 -z-10 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/10"
          aria-hidden="true"
        />

        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-7 sm:px-6 sm:py-9 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {t('We are hiring')}
            </span>
            <h1 className="mt-2.5 text-2xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-3xl">
              {t('Build your career with')} <span className="text-emerald-600">Revive HR</span>
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
              {t('Explore every open role across our branches and apply in a few minutes — no account needed.')}
            </p>
          </div>

          <dl className="flex shrink-0 items-center gap-6">
            <Stat value={loading ? '—' : String(forms.length)} label={t('Open roles')} />
            <Stat
              value={loading ? '—' : branches.length > 0 ? String(branches.length) : t('All')}
              label={t('Branches hiring')}
            />
          </dl>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 className="text-base font-bold tracking-tight text-slate-900">{t('Open positions')}</h2>
            <span className="text-xs text-slate-500">{countLabel}</span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('Search role or branch…')}
              aria-label={t('Search role or branch')}
              className="h-9 bg-white ps-8 text-sm"
            />
          </div>
        </div>

        {branches.length > 1 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <BranchChip active={branch === ALL_BRANCHES} onClick={() => setBranch(ALL_BRANCHES)}>
              {t('All branches')}
            </BranchChip>
            {branches.map((name) => (
              <BranchChip key={name} active={branch === name} onClick={() => setBranch(name)}>
                {name}
              </BranchChip>
            ))}
          </div>
        )}

        <div className="mt-3">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="mt-1.5 h-3 w-1/2" />
                    <Skeleton className="mt-1.5 h-3 w-4/5" />
                  </div>
                  <Skeleton className="hidden h-8 w-20 shrink-0 rounded-lg sm:block" />
                </div>
              ))}
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : visibleForms.length === 0 ? (
            forms.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title={t('No open roles right now')}
                message={t('New positions are published here as soon as our HR team opens them. Check back soon.')}
              />
            ) : (
              <EmptyState
                icon={SearchX}
                title={t('No roles match your search')}
                message={t('Try a different role name, or clear the filters to see every opening.')}
                action={
                  <button type="button" onClick={clearFilters} className="btn btn-secondary btn-sm">
                    {t('Clear filters')}
                  </button>
                }
              />
            )
          ) : (
            <ul className="space-y-2">
              {visibleForms.map((form) => (
                <li key={form.id}>
                  <PositionRow form={form} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <HiringSteps />
      </section>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dd className="text-xl font-extrabold leading-none tracking-tight text-slate-900">{value}</dd>
      <dt className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
    </div>
  )
}

function BranchChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
        active
          ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700',
      )}
    >
      {children}
    </button>
  )
}

/** One open role: title, branch/meta, the HR-written job description, and Apply. */
function PositionRow({ form }: { form: HiringFormListItem }) {
  const { t } = useTranslation()
  const title = form.position || form.name
  const branch = form.gym === 'All' ? t('All branches') : form.gym

  return (
    <Link
      to={`/apply/${form.id}`}
      className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-900/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 sm:items-center"
    >
      {form.gym && form.gym !== 'All' ? (
        <GymLogo gym={{ name: form.gym }} className="mt-0.5 h-10 w-10 shrink-0 rounded-xl object-cover sm:mt-0" />
      ) : (
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 sm:mt-0">
          <Building2 className="h-5 w-5" aria-hidden="true" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="truncate text-sm font-bold text-slate-900 group-hover:text-emerald-700">{title}</h3>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            {t('Open')}
          </span>
          {form.position && form.name !== form.position && (
            <span className="truncate text-[11px] text-slate-400">{form.name}</span>
          )}
        </div>

        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3 text-slate-400" aria-hidden="true" />
            {branch}
          </span>
          <span aria-hidden="true">·</span>
          <span>{form.questions === 1 ? t('1 question') : t('{{count}} questions', { count: form.questions })}</span>
          {form.createdDate && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                {t('Posted')} {formatDate(form.createdDate)}
              </span>
            </>
          )}
        </p>

        {form.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">{form.description}</p>
        )}
      </div>

      <span className="inline-flex shrink-0 items-center gap-1 self-center rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-colors group-hover:bg-emerald-700 sm:px-3 sm:text-xs">
        {t('Apply')}
        <ArrowRight
          className="hidden h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 sm:block rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  )
}

/** Slim reminder of the process — one line instead of a full section. */
function HiringSteps() {
  const { t } = useTranslation()
  const steps = [t('Find a role'), t('Send your details'), t('Hear back from HR')]

  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200 pt-4">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t('How hiring works')}</span>
      {steps.map((step, index) => (
        <span key={step} className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white">
            {index + 1}
          </span>
          {step}
        </span>
      ))}
    </div>
  )
}
