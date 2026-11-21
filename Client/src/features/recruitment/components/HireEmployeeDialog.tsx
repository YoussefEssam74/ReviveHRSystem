import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { Textarea } from '../../../components/ui/textarea'
import { useMe } from '../../../contexts/MeContext'
import { describeApiError } from '../../../lib/api-client'
import { formatEGP } from '../../../lib/format'
import { getRoles } from '../../hr-team/api/hr-team.api'
import { useAssignWaitingCandidate, useHireCandidate, useVacancies } from '../hooks/useRecruitment'
import type { CandidateCard, WaitingListItem } from '../api/recruitment.api'

const DEFAULT_PASSWORD = 'Revive!2026'
const LEVELS = ['Junior', 'Mid', 'Senior']
const CONTRACT_TYPES = ['Full-time', 'Part-time']

interface HireOutcome {
  employeeId: number
  name: string
  position: string | null
  gym: string | null
  startDate: string | null
}

export interface HireEmployeeDialogProps {
  /** Pipeline candidate (Accepted → hire). */
  candidate?: CandidateCard
  /** Waiting-list entry (assign → hire). */
  waiting?: WaitingListItem
  onClose: () => void
}

/**
 * Three-step hire wizard: Placement → Salary & terms → Account.
 * Candidate mode posts POST /api/applications/{id}/hire; waiting-list mode posts
 * POST /api/recruitment/waiting-list/{id}/assign. Both create the employee account
 * and start onboarding server-side.
 */
export function HireEmployeeDialog({ candidate, waiting, onClose }: HireEmployeeDialogProps) {
  const { t } = useTranslation()
  const { me } = useMe()
  const gyms = me?.gyms ?? []
  const vacancies = useVacancies({ status: 'Open', page: 1, pageSize: 100 })
  // Role presets need team.view; without it the wizard simply offers "no role".
  const { data: rolesData } = useQuery({
    queryKey: ['roles', 'hire'],
    queryFn: ({ signal }) => getRoles({ page: 1, pageSize: 50 }, signal),
    retry: false,
  })
  const hire = useHireCandidate()
  const assign = useAssignWaitingCandidate()
  const pending = hire.isPending || assign.isPending

  const name = candidate?.name ?? waiting?.name ?? ''
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [gymId, setGymId] = useState('')
  const [vacancyId, setVacancyId] = useState('')
  const [position, setPosition] = useState(candidate?.position ?? waiting?.position ?? '')
  const [startDate, setStartDate] = useState(today)
  const [salary, setSalary] = useState(candidate?.form?.salaryExp != null ? String(candidate.form.salaryExp) : '')
  const [annualIncrease, setAnnualIncrease] = useState('')
  const [leaveDays, setLeaveDays] = useState('21')
  const [level, setLevel] = useState('Junior')
  const [contractType, setContractType] = useState('Full-time')
  const [note, setNote] = useState('')
  const [email, setEmail] = useState(candidate?.form?.email ?? '')
  const [password, setPassword] = useState(DEFAULT_PASSWORD)
  const [role, setRole] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<HireOutcome | null>(null)

  const vacancyOptions = waiting
    ? waiting.matchingVacancies.map((match) => ({
        id: match.id,
        label: `${match.position}${match.gym ? ` · ${match.gym}` : ''}`,
      }))
    : (vacancies.data?.items ?? []).map((vacancy) => ({
        id: vacancy.id,
        label: `${vacancy.position}${vacancy.gym ? ` · ${vacancy.gym}` : ''}`,
      }))

  const selectVacancy = (value: string) => {
    setVacancyId(value)
    if (!value) return
    const match = waiting?.matchingVacancies.find((item) => String(item.id) === value)
    if (match) {
      setPosition(match.position)
      const gym = gyms.find((option) => option.gymName === match.gym)
      if (gym) setGymId(String(gym.gymId))
      return
    }
    const vacancy = (vacancies.data?.items ?? []).find((item) => String(item.id) === value)
    const gym = vacancy ? gyms.find((option) => option.gymName === vacancy.gym) : undefined
    if (gym) setGymId(String(gym.gymId))
  }

  const validate = (target: 1 | 2 | 3): string | null => {
    if (target >= 1 && !gymId) return t('Pick the branch the employee will work in.')
    if (target >= 2 && !salary) return t('Enter the monthly salary.')
    if (target >= 2 && !startDate) return t('Pick a start date.')
    if (target >= 3 && !email.trim()) return t('Enter the login email.')
    if (target >= 3 && !password) return t('Enter the login password.')
    return null
  }

  const next = () => {
    const problem = validate(step)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setStep((current) => (current === 1 ? 2 : 3))
  }

  const submit = async () => {
    const problem = validate(3)
    if (problem) {
      setError(problem)
      return
    }
    if (!waiting && !candidate?.applicationId) {
      setError(t('This candidate has no linked application, so it cannot be hired.'))
      return
    }
    setError(null)

    const terms = {
      ...(gymId ? { gymId: Number(gymId) } : {}),
      ...(vacancyId ? { vacancyId: Number(vacancyId) } : {}),
      startDate,
      salary: Number(salary),
      ...(annualIncrease ? { annualIncrease: Number(annualIncrease) } : {}),
      ...(leaveDays ? { leaveDays: Number(leaveDays) } : {}),
      level,
      email: email.trim(),
      password,
      ...(role ? { role } : {}),
    }

    try {
      if (waiting) {
        const data = await assign.mutateAsync({
          id: waiting.id,
          body: { ...terms, ...(position ? { position } : {}) },
        })
        setOutcome({
          employeeId: data.employeeId,
          name: data.name,
          position: data.position,
          gym: data.gym,
          startDate: data.startDate,
        })
      } else if (candidate?.applicationId) {
        const data = await hire.mutateAsync({
          applicationId: candidate.applicationId,
          body: { ...terms, contractType, ...(note.trim() ? { offerLetterNote: note.trim() } : {}) },
        })
        setOutcome({
          employeeId: data.employeeId,
          name: data.name,
          position: data.position,
          gym: data.gym,
          startDate: data.startDate,
        })
      }
    } catch (err) {
      setError(describeApiError(err))
    }
  }

  const steps: { id: 1 | 2 | 3; label: string }[] = [
    { id: 1, label: t('Placement') },
    { id: 2, label: t('Salary & terms') },
    { id: 3, label: t('Account') },
  ]

  if (outcome) {
    return (
      <Dialog
        open
        onClose={onClose}
        title={t('Employee hired — {{name}}', { name: outcome.name })}
        footer={
          <Button onClick={onClose}>{t('Done')}</Button>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            {t('The account is created and onboarding has started.')}
          </div>
          <dl className="divide-y divide-charcoal-100 rounded-lg border border-charcoal-200 text-xs">
            <div className="flex justify-between gap-3 px-3 py-2">
              <dt className="text-charcoal-500">{t('Employee ID')}</dt>
              <dd className="font-semibold text-charcoal-900">#{outcome.employeeId}</dd>
            </div>
            <div className="flex justify-between gap-3 px-3 py-2">
              <dt className="text-charcoal-500">{t('Position')}</dt>
              <dd className="font-medium text-charcoal-900">{outcome.position ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-3 px-3 py-2">
              <dt className="text-charcoal-500">{t('Branch')}</dt>
              <dd className="font-medium text-charcoal-900">{outcome.gym ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-3 px-3 py-2">
              <dt className="text-charcoal-500">{t('Start date')}</dt>
              <dd className="font-medium text-charcoal-900">{outcome.startDate ?? '—'}</dd>
            </div>
          </dl>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('Hire — {{name}}', { name })}
      description={[candidate?.position ?? waiting?.position, t('{{step}} of 3', { step })]
        .filter(Boolean)
        .join(' · ')}
      className="sm:max-w-xl"
      footer={
        <>
          <Button variant="outline" onClick={step === 1 ? onClose : () => setStep((current) => (current === 3 ? 2 : 1))}>
            {step === 1 ? t('Cancel') : t('Back')}
          </Button>
          {step < 3 ? (
            <Button onClick={next}>{t('Next')}</Button>
          ) : (
            <Button variant="success" onClick={submit} loading={pending}>
              {waiting ? t('Assign & create account') : t('Hire & create account')}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <ol className="flex items-center gap-1.5" aria-label={t('Hire wizard steps')}>
          {steps.map((item) => (
            <li key={item.id} className="flex flex-1 items-center gap-1.5">
              <span
                className={
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ' +
                  (step === item.id
                    ? 'bg-brand-600 text-white'
                    : step > item.id
                      ? 'bg-green-100 text-green-700'
                      : 'bg-charcoal-100 text-charcoal-400')
                }
              >
                {step > item.id ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : item.id}
              </span>
              <span className={'truncate text-[10px] ' + (step === item.id ? 'font-semibold text-charcoal-800' : 'text-charcoal-400')}>
                {item.label}
              </span>
            </li>
          ))}
        </ol>

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="rounded-lg border border-charcoal-200 bg-charcoal-50 px-3 py-2 text-[11px] text-charcoal-600">
              {name}
              {position ? ` · ${position}` : ''}
              {candidate?.form?.email ? ` · ${candidate.form.email}` : ''}
            </p>
            <div>
              <Label htmlFor="hire-gym">{t('Branch')}</Label>
              <Select id="hire-gym" value={gymId} onChange={(event) => setGymId(event.target.value)} required>
                <option value="">{t('Select a branch')}</option>
                {gyms.map((gym) => (
                  <option key={gym.gymId} value={String(gym.gymId)}>
                    {gym.gymName}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="hire-vacancy">
                {waiting ? t('Matching vacancy') : t('Vacancy (optional)')}
              </Label>
              <Select id="hire-vacancy" value={vacancyId} onChange={(event) => selectVacancy(event.target.value)}>
                <option value="">{t('No vacancy — direct hire')}</option>
                {vacancyOptions.map((option) => (
                  <option key={option.id} value={String(option.id)}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {vacancies.isError && !waiting && (
                <p className="mt-1 text-[10px] text-charcoal-400">
                  {t('Open vacancies could not be loaded — a direct hire still works.')}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="hire-position">{t('Position')}</Label>
                <Input
                  id="hire-position"
                  value={position}
                  onChange={(event) => setPosition(event.target.value)}
                  disabled={!waiting}
                />
              </div>
              <div>
                <Label htmlFor="hire-start">{t('Start date')}</Label>
                <Input
                  id="hire-start"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="hire-salary">{t('Monthly salary')}</Label>
                <Input
                  id="hire-salary"
                  type="number"
                  min="0"
                  step="100"
                  value={salary}
                  onChange={(event) => setSalary(event.target.value)}
                  required
                />
                {salary && (
                  <p className="mt-1 text-[10px] text-charcoal-400">
                    {t('{{amount}} per month', { amount: formatEGP(Number(salary) || 0) })}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="hire-increase">{t('Annual increase')}</Label>
                <Input
                  id="hire-increase"
                  type="number"
                  min="0"
                  step="100"
                  value={annualIncrease}
                  onChange={(event) => setAnnualIncrease(event.target.value)}
                  placeholder={t('Optional')}
                />
              </div>
              <div>
                <Label htmlFor="hire-leave">{t('Leave days')}</Label>
                <Input
                  id="hire-leave"
                  type="number"
                  min="0"
                  value={leaveDays}
                  onChange={(event) => setLeaveDays(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="hire-level">{t('Level')}</Label>
                <Select id="hire-level" value={level} onChange={(event) => setLevel(event.target.value)}>
                  {LEVELS.map((option) => (
                    <option key={option} value={option}>
                      {t(option)}
                    </option>
                  ))}
                </Select>
              </div>
              {!waiting && (
                <div className="sm:col-span-2">
                  <Label htmlFor="hire-contract">{t('Contract type')}</Label>
                  <Select
                    id="hire-contract"
                    value={contractType}
                    onChange={(event) => setContractType(event.target.value)}
                  >
                    {CONTRACT_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {t(option)}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
            {!waiting && (
              <div>
                <Label htmlFor="hire-note">{t('Offer letter note')}</Label>
                <Textarea
                  id="hire-note"
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={t('Optional note carried onto the offer')}
                />
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="hire-email">{t('Login email')}</Label>
              <Input
                id="hire-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="hire-password">{t('Temporary password')}</Label>
              <Input
                id="hire-password"
                type="text"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <p className="mt-1 text-[10px] text-charcoal-400">
                {t('The employee signs in with this password and can change it later.')}
              </p>
            </div>
            <div>
              <Label htmlFor="hire-role">{t('System role (optional)')}</Label>
              <Select id="hire-role" value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="">{t('No system role')}</option>
                {(rolesData?.items ?? []).map((option) => (
                  <option key={option.id} value={option.name}>
                    {option.name}
                  </option>
                ))}
              </Select>
            </div>
            <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] text-blue-800">
              {t(
                'Saving creates the employee account, closes the vacancy seat and starts the onboarding checklist.',
              )}
            </p>
          </div>
        )}
      </div>
    </Dialog>
  )
}
