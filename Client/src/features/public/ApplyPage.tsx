import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileText,
  ListChecks,
  MapPin,
  ShieldCheck,
  UploadCloud,
  X,
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import { GymLogo } from '../../components/ui/gym-logo'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select } from '../../components/ui/select'
import { Skeleton } from '../../components/ui/skeleton'
import { ApiError, describeApiError } from '../../lib/api-client'
import { formatDate } from '../../lib/format'
import { cn } from '../../lib/utils'
import { getPublicHiringForm, submitApplication, type HiringForm, type PublicAnswer } from './apply.api'

/** Largest document we embed in an answer (keeps the JSON payload sane). */
const MAX_FILE_BYTES = 2 * 1024 * 1024

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Reads the `:formId` route param so the page itself owns a typed id. */
export function ApplyRoute() {
  const params = useParams()
  const formId = Number(params.formId)
  if (!Number.isFinite(formId) || formId <= 0) return <Navigate to="/apply" replace />
  return <ApplyPage formId={formId} />
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'))
    reader.readAsDataURL(file)
  })
}

function branchLabel(form: HiringForm | null, allLabel: string): string {
  if (!form?.gym || form.gym === 'All') return allLabel
  return form.gym
}

/**
 * Public application page (`/apply/:formId`) — the target of the public link HR
 * copies from a hiring form. It loads the Open form anonymously and submits an
 * application, including file-upload questions (a CV, a certificate).
 */
export default function ApplyPage({ formId }: { formId: number }) {
  const { t } = useTranslation()
  const [loaded, setLoaded] = useState<{
    formId: number
    form: HiringForm | null
    error: { message: string; status: number | null } | null
  } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [files, setFiles] = useState<Record<number, { name: string; dataUrl: string }>>({})
  const [error, setError] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [sending, setSending] = useState(false)
  const [submittedFormId, setSubmittedFormId] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getPublicHiringForm(formId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setLoaded({ formId, form: data, error: null })
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setLoaded({
          formId,
          form: null,
          error: {
            message: describeApiError(err),
            status: err instanceof ApiError ? err.status : null,
          },
        })
      })
    return () => controller.abort()
  }, [formId, reloadKey])

  // Loading/error are derived from the result's own form id, so navigating to
  // another form never shows the previous form's fields.
  const loadedForThisForm = loaded && loaded.formId === formId ? loaded : null
  const loading = loadedForThisForm === null
  const form = loadedForThisForm?.form ?? null
  const loadError = loadedForThisForm?.error ?? null

  const retryLoad = () => {
    setLoaded(null)
    setReloadKey((key) => key + 1)
  }

  const questions = useMemo(() => form?.questionList ?? [], [form])
  const nameError = name.trim().length > 0 ? null : t('Enter your full name.')
  const emailError = EMAIL_PATTERN.test(email.trim()) ? null : t('Enter a valid email address.')

  const onPickFile = async (index: number, file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      setError(t('“{{name}}” is larger than 2 MB — please email it to us instead.', { name: file.name }))
      return
    }
    setError(null)
    try {
      const dataUrl = await readAsDataUrl(file)
      setFiles((current) => ({ ...current, [index]: { name: file.name, dataUrl } }))
    } catch {
      setError(t('Could not read that file. Please try another one.'))
    }
  }

  const onDropFile = (index: number, event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    void onPickFile(index, event.dataTransfer.files?.[0])
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAttempted(true)
    if (!form || nameError || emailError) return
    setError(null)
    setSending(true)
    try {
      const payload: PublicAnswer[] = questions.map((question, index) => {
        if (question.type === 'file') {
          const file = files[index]
          return { question: question.text, type: 'text', answer: file ? `${file.name}|${file.dataUrl}` : null }
        }
        return { question: question.text, type: question.type, answer: answers[index] || null }
      })

      await submitApplication({
        formId: form.id,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        gym: form.gym === 'All' ? undefined : form.gym,
        position: form.position ?? undefined,
        source: 'Public link',
        answers: payload,
      })
      setSubmittedFormId(form.id)
    } catch (err) {
      setError(describeApiError(err))
    } finally {
      setSending(false)
    }
  }

  const resetForm = () => {
    setSubmittedFormId(null)
    setAttempted(false)
    setError(null)
    setName('')
    setEmail('')
    setPhone('')
    setAnswers({})
    setFiles({})
  }

  if (loading) return <ApplySkeleton />
  if (loadError) return <UnavailablePanel error={loadError} onRetry={retryLoad} />
  if (!form) return <UnavailablePanel error={{ message: t('The request failed.'), status: null }} onRetry={retryLoad} />

  if (submittedFormId === form.id) {
    return <SuccessPanel form={form} name={name.trim()} email={email.trim()} onReset={resetForm} />
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
      <Link
        to="/apply"
        className="inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold text-slate-500 transition-colors hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
      >
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
        {t('All open positions')}
      </Link>

      <div className="mt-3 grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <aside className="lg:sticky lg:top-20">
          <RoleSummaryCard form={form} questionCount={questions.length} />
        </aside>

        <form
          onSubmit={onSubmit}
          noValidate
          className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-100 px-4 py-3.5">
            <h1 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
              {t('Apply for this role')}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {t('Tell us who you are, then answer the questions below.')}
            </p>
          </div>

          <div className="space-y-4 px-4 py-4">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {form.description && <RoleDescription text={form.description} />}

            <fieldset>
              <legend className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {t('About you')}
              </legend>
              <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="apply-name">
                    {t('Full name')} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="apply-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    aria-invalid={attempted && Boolean(nameError)}
                    aria-describedby={attempted && nameError ? 'apply-name-error' : undefined}
                    className={cn(attempted && nameError && 'border-red-300 focus:border-red-400 focus:ring-red-500/20')}
                  />
                  {attempted && nameError && (
                    <p id="apply-name-error" role="alert" className="mt-1 text-xs text-red-600">
                      {nameError}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="apply-email">
                    {t('Email')} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="apply-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    aria-invalid={attempted && Boolean(emailError)}
                    aria-describedby={attempted && emailError ? 'apply-email-error' : undefined}
                    className={cn(attempted && emailError && 'border-red-300 focus:border-red-400 focus:ring-red-500/20')}
                  />
                  {attempted && emailError && (
                    <p id="apply-email-error" role="alert" className="mt-1 text-xs text-red-600">
                      {emailError}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <Label htmlFor="apply-phone">{t('Phone (optional)')}</Label>
                <Input
                  id="apply-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                />
              </div>
            </fieldset>

            {questions.length > 0 && (
              <fieldset>
                <legend className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {t('Questions')}
                </legend>
                <ul className="mt-2 divide-y divide-slate-100">
                  {questions.map((question, index) => (
                    <li key={`${question.text}-${index}`} className="py-3 first:pt-1 last:pb-0">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-500">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800">{question.text}</p>

                          {question.type === 'text' && (
                            <Input
                              id={`q-${index}`}
                              className="mt-1.5"
                              value={answers[index] ?? ''}
                              onChange={(event) =>
                                setAnswers((current) => ({ ...current, [index]: event.target.value }))
                              }
                            />
                          )}

                          {question.type === 'choose' && (
                            <div className="mt-1.5">
                              <Select
                                id={`q-${index}`}
                                value={answers[index] ?? ''}
                                onChange={(event) =>
                                  setAnswers((current) => ({ ...current, [index]: event.target.value }))
                                }
                              >
                                <option value="">{t('Select an answer…')}</option>
                                {question.options.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          )}

                          {question.type === 'checkbox' && (
                            <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                              {question.options.map((option) => {
                                const selected = (answers[index] ?? '').split('|').filter(Boolean)
                                const checked = selected.includes(option)
                                return (
                                  <label
                                    key={option}
                                    className={cn(
                                      'flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                                      checked
                                        ? 'border-emerald-300 bg-emerald-50/70 text-emerald-800'
                                        : 'border-slate-200 text-slate-600 hover:border-emerald-200 hover:bg-slate-50',
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        setAnswers((current) => {
                                          const next = checked
                                            ? selected.filter((value) => value !== option)
                                            : [...selected, option]
                                          return { ...current, [index]: next.join('|') }
                                        })
                                      }
                                      className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                                    />
                                    <span className="min-w-0 truncate">{option}</span>
                                  </label>
                                )
                              })}
                            </div>
                          )}

                          {question.type === 'file' && (
                            <div className="mt-1.5">
                              {files[index] ? (
                                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-2">
                                  <FileText className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">
                                    {files[index].name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setFiles((current) => {
                                        const next = { ...current }
                                        delete next[index]
                                        return next
                                      })
                                    }
                                    aria-label={t('Remove file')}
                                    className="rounded-md p-1 text-slate-400 transition-colors hover:bg-white hover:text-red-600"
                                  >
                                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                </div>
                              ) : (
                                <label
                                  onDragOver={(event) => event.preventDefault()}
                                  onDrop={(event) => onDropFile(index, event)}
                                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-3 py-2.5 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40"
                                >
                                  <UploadCloud className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                                  <span className="min-w-0">
                                    <span className="block text-xs font-semibold text-slate-700">
                                      {t('Attach a file or drop it here')}
                                    </span>
                                    <span className="block text-[10px] text-slate-400">
                                      {t('PDF, DOC, PNG or JPG · up to 2 MB')}
                                    </span>
                                  </span>
                                  <input
                                    type="file"
                                    className="sr-only"
                                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                                    onChange={(event) => {
                                      void onPickFile(index, event.target.files?.[0])
                                      event.target.value = ''
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}
          </div>

          <div className="sticky bottom-0 flex flex-col gap-2.5 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
              {t('We only use these details for recruitment.')}
            </p>
            <Button type="submit" size="md" loading={sending} className="w-full sm:w-auto">
              {t('Submit application')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

/** The role the visitor is applying for: branch, title, and form facts. */
function RoleSummaryCard({ form, questionCount }: { form: HiringForm; questionCount: number }) {
  const { t } = useTranslation()

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="h-14 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700" aria-hidden="true" />
      <div className="px-4 pb-4">
        <div className="-mt-6 flex items-end justify-between gap-2">
          {form.gym && form.gym !== 'All' ? (
            <GymLogo gym={{ name: form.gym }} className="h-12 w-12 rounded-xl object-cover ring-4 ring-white" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-4 ring-white">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </span>
          )}
          <span className="mb-1 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            {t('Open')}
          </span>
        </div>

        <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
          {branchLabel(form, t('All branches'))}
        </p>
        <h2 className="mt-0.5 text-base font-bold leading-snug text-slate-900">{form.position || form.name}</h2>
        {form.position && form.name !== form.position && <p className="mt-0.5 text-xs text-slate-500">{form.name}</p>}

        <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-slate-500">
              <ListChecks className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              {t('Questions')}
            </dt>
            <dd className="font-semibold text-slate-800">{questionCount}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-slate-500">
              <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              {t('Branch')}
            </dt>
            <dd className="truncate text-end font-semibold text-slate-800">{branchLabel(form, t('All branches'))}</dd>
          </div>
          {form.createdDate && (
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-slate-500">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                {t('Posted')}
              </dt>
              <dd className="font-semibold text-slate-800">{formatDate(form.createdDate)}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}

/** HR's job description, clamped until the candidate asks for the whole text. */
function RoleDescription({ text }: { text: string }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const collapsible = text.length > 420 || text.split('\n').length > 5

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <h2 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <FileText className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
        {t('About the role')}
      </h2>
      <p
        className={cn(
          'mt-1.5 whitespace-pre-line text-xs leading-relaxed text-slate-600',
          collapsible && !expanded && 'line-clamp-5',
        )}
      >
        {text}
      </p>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-1.5 text-[11px] font-semibold text-emerald-700 hover:underline"
        >
          {expanded ? t('Show less') : t('Read the full description')}
        </button>
      )}
    </section>
  )
}

function ApplySkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
      <Skeleton className="h-4 w-32" />
      <div className="mt-3 grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="h-14 bg-slate-100" aria-hidden="true" />
          <div className="px-4 pb-4">
            <Skeleton className="-mt-6 h-12 w-12 rounded-xl" />
            <Skeleton className="mt-3 h-3 w-24" />
            <Skeleton className="mt-1.5 h-4 w-36" />
            <Skeleton className="mt-3 h-14 w-full" />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-1.5 h-3 w-56" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="mt-3 h-10 w-full" />
          <Skeleton className="mt-4 h-16 w-full" />
          <Skeleton className="mt-3 h-16 w-full" />
        </div>
      </div>
    </div>
  )
}

function UnavailablePanel({
  error,
  onRetry,
}: {
  error: { message: string; status: number | null }
  onRetry: () => void
}) {
  const { t } = useTranslation()
  const closed = error.status === 404

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-14 text-center sm:px-6">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
        <AlertCircle className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-lg font-bold tracking-tight text-slate-900">
        {closed ? t('This role is no longer accepting applications') : t('We could not load this form')}
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
        {closed
          ? t('It may have been closed or the link may be out of date. Browse the open positions instead.')
          : error.message}
      </p>
      <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
        <Link to="/apply" className="btn btn-primary btn-md">
          {t('See open positions')}
        </Link>
        {!closed && (
          <button type="button" onClick={onRetry} className="btn btn-secondary btn-md">
            {t('Try again')}
          </button>
        )}
      </div>
    </div>
  )
}

function SuccessPanel({
  form,
  name,
  email,
  onReset,
}: {
  form: HiringForm
  name: string
  email: string
  onReset: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-center shadow-sm">
        <div className="bg-gradient-to-b from-emerald-50 to-white px-5 pb-5 pt-8">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-600/25">
            <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900">{t('Application sent')}</h1>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-600">
            {t('Thanks {{name}} — our HR team will review your application and contact you at {{email}}.', {
              name,
              email,
            })}
          </p>
        </div>

        <dl className="space-y-2 border-t border-slate-100 px-5 py-4 text-start text-xs">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-slate-500">{t('Role')}</dt>
            <dd className="text-end font-semibold text-slate-800">{form.position || form.name}</dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-slate-500">{t('Branch')}</dt>
            <dd className="text-end font-semibold text-slate-800">{branchLabel(form, t('All branches'))}</dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-slate-500">{t('Reference')}</dt>
            <dd className="text-end font-semibold text-slate-800">#{form.id}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5 sm:flex-row sm:justify-center">
          <Link to="/apply" className="btn btn-primary btn-md">
            {t('Browse other open roles')}
          </Link>
          <button type="button" onClick={onReset} className="btn btn-secondary btn-md">
            {t('Submit another application')}
          </button>
        </div>
      </div>
    </div>
  )
}
