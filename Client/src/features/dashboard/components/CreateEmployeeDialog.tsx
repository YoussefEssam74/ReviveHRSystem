import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Camera, Check, Trash2 } from 'lucide-react'
import { Dialog } from '../../../components/ui/dialog'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { getGyms } from '../../console/api/console.api'
import { getRoles, postTeam } from '../../hr-team/api/hr-team.api'
import { useCreateEmployee } from '../../employees/hooks/useEmployees'
import { getEmployees } from '../../employees/api/employees.api'
import { getLeaveDefaults, postRoleChange, uploadEmployeePhoto } from '../../employees/api/employees.api'
import { useDashboardFaceEnroll } from '../hooks/useDashboard'
import { describeApiError } from '../../../lib/api-client'
import type { ToastTone } from '../hooks/useMockToast'

export interface CreateEmployeeDialogProps {
  onClose: () => void
  /** Shared dashboard toast (success / warning pairs with the mock's showToast). */
  toast: (message: string, tone?: ToastTone) => void
}

const LEVELS = ['Junior', 'Mid', 'Senior', 'Manager']
/** Roles the backend accepts on POST /api/employees/{id}/role-change for employees. */
const BASE_ROLES = ['Emp', 'Team Leader', 'Branch Manager']
/** The create account flow seeds the login with this system password (server default). */
const DEFAULT_PASSWORD = 'Revive!2026'
const GENDERS = ['Female', 'Male']
const EMPLOYMENT_TYPES = [
  { value: 'FullTime', label: 'Full-time' },
  { value: 'PartTime', label: 'Part-time' },
]
const MAX_PHOTO_BYTES = 10 * 1024 * 1024

function splitName(fullName: string): { firstName: string; lastName: string } | null {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] }
}

function emailFromName(fullName: string): string {
  // "Flow Check 1211 " â†’ "flow.check" (collapse spaces, drop non-letters, trim dots).
  const slug = fullName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z.]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '')
  return `${slug || 'employee'}@revive.com`
}

/** Random system password that satisfies the server's 8-character minimum. */
function generatePassword(): string {
  const digits = Math.floor(1000 + Math.random() * 9000)
  const symbols = ['!', '@', '#', '$', '%', '&']
  return `Revive${symbols[Math.floor(Math.random() * symbols.length)]}${digits}`
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the photo'))
    reader.readAsDataURL(file)
  })
}

function Field({
  id,
  label,
  required,
  hint,
  children,
  className,
}: {
  id: string
  label: string
  required?: boolean
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs font-semibold text-charcoal-700" htmlFor={id}>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
      {hint && <p className="mt-1 text-[10px] leading-relaxed text-charcoal-500">{hint}</p>}
    </div>
  )
}

/**
 * Fast action "Create Account" (mock js/pages-dashboard.js openCreateAccountModal),
 * split into the two pages HR fills in order:
 *   1. Personal information — photo, identity, contact, login credentials.
 *   2. Employment information — branch, job title, contract, salary and leave setup.
 * The account itself is created server-side by POST /api/employees.
 */
export default function CreateEmployeeDialog({ onClose, toast }: CreateEmployeeDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: gyms = [] } = useQuery({ queryKey: ['gyms'], queryFn: ({ signal }) => getGyms(signal) })
  // Role templates live in Role management; without team.view the base roles are offered.
  const { data: rolesData } = useQuery({
    queryKey: ['roles', 'dashboard'],
    queryFn: ({ signal }) => getRoles({ page: 1, pageSize: 50 }, signal),
    retry: false,
  })

  const createEmployee = useCreateEmployee()
  const enrollFace = useDashboardFaceEnroll()
  const [today] = useState(() => new Date().toISOString().slice(0, 10))

  // ---------------------------------------------------------------- page 1
  const [step, setStep] = useState<1 | 2>(1)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [hireDate, setHireDate] = useState(today)
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [password, setPassword] = useState(DEFAULT_PASSWORD)

  // ---------------------------------------------------------------- page 2
  const [position, setPosition] = useState('')
  const [level, setLevel] = useState('Junior')
  const [salary, setSalary] = useState('')
  const [gymId, setGymId] = useState<number | null>(null)
  const [role, setRole] = useState('Emp')
  /** Team assignment shown when the System Role is Team Leader. */
  const [teamName, setTeamName] = useState('')
  const [teamMemberIds, setTeamMemberIds] = useState<number[]>([])
  const [employmentType, setEmploymentType] = useState('FullTime')
  const [annualLeave, setAnnualLeave] = useState('')
  const [sickLeave, setSickLeave] = useState('')
  const [excusedHours, setExcusedHours] = useState('')
  /** Fields HR edited by hand; database defaults stop overwriting those. */
  const leaveFieldsTouched = useRef({ annual: false, sick: false, excused: false })

  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{
    name: string
    code: string
    email: string
    password: string
    position: string
    branch: string
    employmentType: string
    warnings: string[]
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // The Team Leader section lists the chosen branch's existing employees.
  const teamRosterQuery = useQuery({
    queryKey: ['dashboard', 'create-employee', 'team-roster', gymId],
    queryFn: ({ signal }) => getEmployees({ gym: gymId ?? undefined, status: 'Active', page: 1, pageSize: 100 }, signal),
    enabled: role === 'Team Leader' && gymId != null,
    staleTime: 60_000,
  })
  const teamRoster = teamRosterQuery.data?.items ?? []
  const toggleTeamMember = (id: number) =>
    setTeamMemberIds((current) => (current.includes(id) ? current.filter((memberId) => memberId !== id) : [...current, id]))

  // Object URLs back the local preview only; the server copy arrives after save.
  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null)
      return
    }
    const url = URL.createObjectURL(photo)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  // The Leave & attendance numbers start from the database: annual days earned by
  // the hire date, the standard sick allowance, and the selected branch's
  // attendance policy. A branch (and hire date) is needed before they can load.
  const { data: leaveDefaults } = useQuery({
    queryKey: ['employees', 'leave-defaults', gymId, hireDate],
    queryFn: ({ signal }) => getLeaveDefaults(gymId!, hireDate, signal),
    enabled: gymId != null,
    retry: false,
  })
  const annualLeaveMax = leaveDefaults?.annualLeaveMaxDays ?? 12

  // Prefill once the numbers arrive (and again when the branch or hire date change),
  // but never overwrite a value HR already edited by hand.
  useEffect(() => {
    if (!leaveDefaults) return
    if (!leaveFieldsTouched.current.annual) setAnnualLeave(String(leaveDefaults.annualLeaveDays))
    if (!leaveFieldsTouched.current.sick) setSickLeave(String(leaveDefaults.sickLeaveDays))
    if (!leaveFieldsTouched.current.excused) setExcusedHours(String(leaveDefaults.excusedHoursPerMonth))
  }, [leaveDefaults])

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast(`${label} copied`, 'success')
    } catch {
      toast('Copy failed — select the text and copy it manually', 'warning')
    }
  }

  // Role options: base roles + any role template configured in HR Team Management.
  const roleOptions = BASE_ROLES.concat(
    (rolesData?.items?.map((r) => r.name) ?? []).filter((name) => !BASE_ROLES.includes(name)),
  )

  const onNameChange = (value: string) => {
    setFullName(value)
    if (!emailTouched) setEmail(emailFromName(value))
  }

  const onPhotoPicked = (file: File | undefined) => {
    setError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError(t('Profile photos must be PNG, JPG, WEBP, or GIF.'))
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError(t('The photo must be 10 MB or smaller.'))
      return
    }
    setPhoto(file)
  }

  const firstPersonalError = (): string | null => {
    if (!fullName.trim()) return t('Please enter the employee full name')
    if (!email.trim() || !/.+@.+\..+/.test(email.trim())) return t('Please enter a valid work email')
    if (password.trim().length < 8) return t('The initial password must be at least 8 characters')
    if (!hireDate) return t('Please choose the hire date')
    if (dateOfBirth && dateOfBirth > today) return t('Date of birth cannot be in the future.')
    return null
  }

  const firstEmploymentError = (): string | null => {
    if (!position.trim()) return t('Please enter the position')
    if (gymId == null) return t('Select a home gym / branch')
    if (annualLeave && (Number(annualLeave) < 0 || Number(annualLeave) > 12)) {
      return t('Annual leave must be between 0 and 12 days.')
    }
    if (sickLeave && (Number(sickLeave) < 0 || Number(sickLeave) > 365)) {
      return t('Sick leave must be between 0 and 365 days.')
    }
    if (excusedHours && (Number(excusedHours) < 0 || Number(excusedHours) > 99.99)) {
      return t('Excused hours must be between 0 and 99.99 per month.')
    }
    return null
  }

  const goNext = (event: FormEvent) => {
    event.preventDefault()
    const message = firstPersonalError()
    if (message) {
      setError(message)
      return
    }
    setError(null)
    setStep(2)
  }

  const onSubmit = async () => {
    const message = firstPersonalError() ?? firstEmploymentError()
    if (message) {
      setError(message)
      return
    }

    const names = splitName(fullName)
    if (!names) {
      setError(t('Please enter the employee full name'))
      return
    }

    setError(null)
    try {
      // Only the numbers HR actually changed are sent: untouched values keep
      // following the policy defaults instead of pinning today's policy.
      const annualDays = annualLeave.trim() ? Number(annualLeave) : null
      const sickDays = sickLeave.trim() ? Number(sickLeave) : null
      const excusedCap = excusedHours.trim() ? Number(excusedHours) : null

      const profile = await createEmployee.mutateAsync({
        firstName: names.firstName,
        lastName: names.lastName,
        email: email.trim(),
        phone: phone.trim() || undefined,
        position: position.trim(),
        level,
        salary: salary.trim() ? Number(salary) : undefined,
        gym: gymId!,
        startDate: hireDate,
        password: password.trim(),
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
        nationalId: nationalId.trim() || undefined,
        employmentType,
        annualLeaveDays: annualDays !== null && annualDays > 0 ? annualDays : undefined,
        sickLeaveDays:
          sickDays !== null && sickDays !== leaveDefaults?.sickLeaveDays ? sickDays : undefined,
        excusedHoursPerMonth:
          excusedCap !== null && excusedCap !== leaveDefaults?.excusedHoursPerMonth ? excusedCap : undefined,
      })

      // Optional extras run after the employee exists; failures stay visible but
      // never undo the account.
      const warnings: string[] = []
      if (role !== 'Emp') {
        try {
          await postRoleChange(profile.id, { systemRole: role })
        } catch (roleError) {
          warnings.push(
            t('The {{role}} role could not be applied: {{error}}', {
              role,
              error: describeApiError(roleError),
            }),
          )
        }
      }

      // A Team Leader leaves the wizard with the team they run.
      if (role === 'Team Leader' && teamName.trim()) {
        try {
          await postTeam({
            name: teamName.trim(),
            leaderEmployeeId: profile.id,
            memberEmployeeIds: teamMemberIds,
          })
        } catch (teamError) {
          warnings.push(
            t('The team could not be created: {{error}}', { error: describeApiError(teamError) }),
          )
        }
      } else if (role === 'Team Leader') {
        warnings.push(t('No team name was given, so the Team Leader has no team yet.'))
      }

      if (photo) {
        try {
          await uploadEmployeePhoto(profile.id, photo)
          queryClient.invalidateQueries({ queryKey: ['employees', 'detail', profile.id] })
        } catch (photoError) {
          warnings.push(
            t('The profile photo could not be saved: {{error}}', {
              error: describeApiError(photoError),
            }),
          )
        }

        // The same portrait feeds Face-ID attendance; a photo without a clear
        // face only warns — the account and the avatar are already saved.
        try {
          await enrollFace.mutateAsync({
            employeeNumber: profile.employeeNumber,
            image: await readAsDataUrl(photo),
          })
        } catch (enrollError) {
          warnings.push(
            t('Face-ID could not be enrolled from this photo: {{error}}', {
              error: describeApiError(enrollError),
            }),
          )
        }
      }

      // Hand the credentials over instead of closing: HR needs them to sign the
      // employee in for the first time.
      setCreated({
        name: fullName.trim(),
        code: profile.employeeNumber,
        email: email.trim(),
        password: password.trim(),
        position: position.trim(),
        branch: gyms.find((gym) => gym.id === gymId)?.branch ?? gyms.find((gym) => gym.id === gymId)?.name ?? '',
        employmentType: employmentType === 'PartTime' ? t('Part-time') : t('Full-time'),
        warnings,
      })
    } catch (submitError) {
      setError(describeApiError(submitError))
    }
  }

  const saving = createEmployee.isPending || enrollFace.isPending

  if (created) {
    const credential = (label: string, value: string) => (
      <div className="rounded-lg border border-charcoal-200 bg-charcoal-50 p-2.5">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-charcoal-500">{label}</p>
        <div className="mt-1 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate font-mono text-xs font-bold text-charcoal-900">{value}</code>
          <Button size="sm" variant="secondary" className="h-6 px-2 text-[10px]" onClick={() => copyToClipboard(value, label)}>
            Copy
          </Button>
        </div>
      </div>
    )

    return (
      <Dialog
        open
        onClose={onClose}
        title="Employee account created"
        description="Share these credentials with the employee so they can sign in to the portal."
        className="sm:max-w-md"
        footer={
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
            {photoPreview ? (
              <img src={photoPreview} alt={created.name} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                âœ“
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-charcoal-900">{created.name}</p>
              <p className="font-mono text-[10px] text-charcoal-500">{created.code}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-2 rounded-lg border border-charcoal-200 p-2.5 text-[11px]">
            <div>
              <dt className="text-[9px] font-semibold uppercase tracking-wide text-charcoal-500">{t('Employee ID')}</dt>
              <dd className="font-mono font-bold text-charcoal-900">{created.code}</dd>
            </div>
            <div>
              <dt className="text-[9px] font-semibold uppercase tracking-wide text-charcoal-500">{t('Job Title / Position')}</dt>
              <dd className="text-charcoal-900">{created.position}</dd>
            </div>
            <div>
              <dt className="text-[9px] font-semibold uppercase tracking-wide text-charcoal-500">{t('Branch')}</dt>
              <dd className="text-charcoal-900">{created.branch || '—'}</dd>
            </div>
            <div>
              <dt className="text-[9px] font-semibold uppercase tracking-wide text-charcoal-500">{t('Employment Type')}</dt>
              <dd className="text-charcoal-900">{created.employmentType}</dd>
            </div>
          </dl>

          {credential('Login email', created.email)}
          {credential('Temporary password', created.password)}

          <div className="flex justify-end gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => copyToClipboard(`Email: ${created.email}\nPassword: ${created.password}`, 'Credentials')}
            >
              Copy both
            </Button>
          </div>

          <p className="text-[10px] leading-relaxed text-charcoal-500">
            The employee signs in at the app&apos;s login page with this email and password, then lands in the
            employee portal (requests, schedule, attendance, payroll). They can change the password later from
            their profile settings.
          </p>

          {created.warnings.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[10px] text-amber-800">
              {created.warnings.map((warning) => (
                <li key={warning}>âš  {warning}</li>
              ))}
            </ul>
          )}
        </div>
      </Dialog>
    )
  }

  const stepTab = (index: 1 | 2, label: string) => {
    const isActive = step === index
    const isDone = index < step
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
          isActive
            ? 'border-brand-300 bg-brand-50 text-brand-800'
            : isDone
              ? 'border-brand-200 bg-white text-brand-700'
              : 'border-charcoal-200 bg-charcoal-50 text-charcoal-500'
        }`}
        aria-current={isActive ? 'step' : undefined}
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
            isActive ? 'bg-brand-600 text-white' : isDone ? 'bg-brand-100 text-brand-700' : 'bg-charcoal-200 text-charcoal-600'
          }`}
        >
          {isDone ? <Check className="h-3 w-3" aria-hidden="true" /> : index}
        </span>
        {label}
      </div>
    )
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('Create New Employee Account')}
      description={
        step === 1
          ? t('Page 1 of 2 — personal information and login credentials.')
          : t('Page 2 of 2 — branch, job title, contract and leave setup.')
      }
      className="sm:max-w-xl"
      footer={
        step === 1 ? (
          <>
            <Button variant="outline" size="sm" onClick={onClose}>
              {t('Cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={goNext}>
              {t('Next: Employment info')}
              <ArrowRight className="ms-1 h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={onClose}>
              {t('Cancel')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setStep(1)} disabled={saving}>
              <ArrowLeft className="me-1 h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
              {t('Back')}
            </Button>
            <Button variant="primary" size="sm" onClick={onSubmit} loading={saving}>
              {t('Create Employee & Account')}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {stepTab(1, t('Personal information'))}
          <span className="h-px w-4 bg-charcoal-200" aria-hidden="true" />
          {stepTab(2, t('Employment information'))}
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
            {error}
          </p>
        )}

        {step === 1 ? (
          <form onSubmit={goNext} className="space-y-4">
            <div className="space-y-3 rounded-xl border border-charcoal-200 bg-charcoal-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-charcoal-700">{t('Profile picture')}</p>
              <div className="flex items-center gap-3">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-charcoal-200 bg-white">
                  {photoPreview ? (
                    <img src={photoPreview} alt={t('Profile picture preview')} className="h-full w-full object-cover" />
                  ) : (
                    <Camera className="h-6 w-6 text-charcoal-300" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <input
                    ref={fileInputRef}
                    id="acc-photo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    onChange={(e) => {
                      onPhotoPicked(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg border border-charcoal-300 bg-white px-2.5 py-1.5 text-xs font-medium text-charcoal-700 hover:bg-charcoal-100/60"
                    >
                      {photo ? t('Choose another photo') : t('Upload photo')}
                    </button>
                    {photo && (
                      <button
                        type="button"
                        onClick={() => setPhoto(null)}
                        className="inline-flex items-center gap-1 rounded-lg border border-charcoal-300 bg-white px-2.5 py-1.5 text-xs font-medium text-charcoal-700 hover:bg-charcoal-100/60"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('Remove')}
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] leading-relaxed text-charcoal-500">
                    {t('PNG, JPG, WEBP or GIF up to 10 MB. The same portrait is used for the profile avatar and Face-ID attendance.')}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-charcoal-200 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wide text-charcoal-700">{t('Personal information')}</p>
                <span className="font-mono text-[11px] text-charcoal-500">{t('Employee ID: auto-generated (EMP-####)')}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field id="acc-name" label={t('Full Name')} required>
                  <Input
                    id="acc-name"
                    className="h-8 text-xs"
                    placeholder={t('e.g. Mariam Adel')}
                    value={fullName}
                    onChange={(e) => onNameChange(e.target.value)}
                  />
                </Field>
                <Field id="acc-phone" label={t('Phone')}>
                  <Input
                    id="acc-phone"
                    type="tel"
                    className="h-8 text-xs"
                    placeholder="+20 1XX XXX XXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field id="acc-hire" label={t('Hire Date')} required>
                  <Input
                    id="acc-hire"
                    type="date"
                    className="h-8 text-xs"
                    value={hireDate}
                    onChange={(e) => setHireDate(e.target.value)}
                  />
                </Field>
                <Field id="acc-dob" label={t('Date of Birth')}>
                  <Input
                    id="acc-dob"
                    type="date"
                    className="h-8 text-xs"
                    max={today}
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field id="acc-gender" label={t('Gender')}>
                  <Select id="acc-gender" className="h-8 text-xs" value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">{t('Not specified')}</option>
                    {GENDERS.map((option) => (
                      <option key={option} value={option}>
                        {t(option)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field id="acc-national-id" label={t('National ID')}>
                  <Input
                    id="acc-national-id"
                    inputMode="numeric"
                    maxLength={20}
                    className="h-8 text-xs"
                    placeholder={t('14 digits')}
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                  />
                </Field>
              </div>

              <Field id="acc-email" label={t('Work Email')} required>
                <Input
                  id="acc-email"
                  type="email"
                  className="h-8 text-xs"
                  placeholder="name@revive.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setEmailTouched(true)
                  }}
                />
              </Field>

              <Field
                id="acc-pass"
                label={t('Initial Password')}
                required
                hint={t('The employee signs in with this password and can change it later.')}
              >
                <div className="flex items-center gap-1.5">
                  <Input
                    id="acc-pass"
                    className="h-8 flex-1 font-mono text-xs"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 px-2 text-[11px]"
                    onClick={() => setPassword(generatePassword())}
                  >
                    {t('Generate')}
                  </Button>
                </div>
              </Field>
            </div>

            {/* Enter on page 1 advances the wizard instead of submitting the flow. */}
            <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void onSubmit()
            }}
            className="space-y-4"
          >
            <div className="space-y-3 rounded-xl border border-charcoal-200 bg-charcoal-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wide text-charcoal-700">{t('Job & contract')}</p>
                <span className="text-[10px] text-charcoal-500">{t('Level and system role stay editable later.')}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field id="acc-position" label={t('Job Title / Position')} required>
                  <Input
                    id="acc-position"
                    className="h-8 text-xs"
                    placeholder={t('Type the position freely')}
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                  />
                </Field>
                <Field id="acc-level" label={t('Level')}>
                  <Select id="acc-level" className="h-8 text-xs" value={level} onChange={(e) => setLevel(e.target.value)}>
                    {LEVELS.map((option) => (
                      <option key={option} value={option}>
                        {t(option)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field id="acc-type" label={t('Employment Type')}>
                  <Select
                    id="acc-type"
                    className="h-8 text-xs"
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value)}
                  >
                    {EMPLOYMENT_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.label)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field id="acc-role" label={t('System Role')}>
                  <Select id="acc-role" className="h-8 text-xs" value={role} onChange={(e) => setRole(e.target.value)}>
                    {roleOptions.map((option) => (
                      <option key={option} value={option}>
                        {option === 'Emp' ? t('Emp (No system role)') : option}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field id="acc-salary" label={t('Base Salary (EGP)')}>
                <Input
                  id="acc-salary"
                  type="number"
                  min={0}
                  className="h-8 text-xs"
                  placeholder={t('e.g. 9000')}
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                />
              </Field>

              {role === 'Team Leader' && (
                <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-charcoal-700">
                      {t('Team for this leader')}
                    </p>
                    <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-800">
                      {teamMemberIds.length} {t('selected')}
                    </span>
                  </div>
                  <div className="mt-2 space-y-2">
                    <Field id="acc-team-name" label={t('Team name')}>
                      <Input
                        id="acc-team-name"
                        className="h-8 text-xs"
                        placeholder={t('e.g. Morning Shift Floor Team')}
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                      />
                    </Field>
                    <div>
                      <p className="mb-1 text-[10px] font-semibold text-charcoal-600">
                        {t('Employees to assign')}
                        <span className="ms-1 font-normal text-charcoal-400">
                          {t('({{gym}} roster)', { gym: gyms.find((gym) => gym.id === gymId)?.name ?? t('branch') })}
                        </span>
                      </p>
                      {gymId == null ? (
                        <p className="text-[10px] text-amber-600">{t('Pick the home branch first.')}</p>
                      ) : (
                        <ul className="grid max-h-36 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-charcoal-200 bg-white p-1.5 sm:grid-cols-2">
                          {teamRoster.map((employee) => {
                            const checked = teamMemberIds.includes(employee.id)
                            return (
                              <li key={employee.id}>
                                <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[11px] text-charcoal-700 hover:bg-charcoal-50">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleTeamMember(employee.id)}
                                    className="h-3.5 w-3.5 rounded border-charcoal-300 accent-brand-600"
                                  />
                                  <span className="min-w-0">
                                    <span className="block truncate font-medium">{employee.name}</span>
                                    <span className="block truncate text-[9px] text-charcoal-400">
                                      {employee.employeeNumber} Â· {employee.position}
                                    </span>
                                  </span>
                                </label>
                              </li>
                            )
                          })}
                          {teamRoster.length === 0 && (
                            <li className="px-2 py-2 text-[10px] text-charcoal-500">
                              {t('No other employees in this branch yet.')}
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-charcoal-200 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-charcoal-700">
                {t('Branch Assignment')}{' '}
                <span className="font-normal normal-case text-charcoal-500">{t('(home branch — one per employee)')}</span>
              </p>
              {gyms.length === 0 ? (
                <p className="text-charcoal-400">{t('No gyms available for your scope.')}</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {gyms.map((gym) => (
                    <label
                      key={gym.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs transition-colors ${
                        gymId === gym.id
                          ? 'border-brand-300 bg-brand-50 text-brand-800'
                          : 'border-charcoal-200 bg-charcoal-50 hover:bg-charcoal-100/60'
                      }`}
                    >
                      <input
                        type="radio"
                        name="acc-branch"
                        className="h-3.5 w-3.5 text-brand-600 accent-[#006c49]"
                        checked={gymId === gym.id}
                        onChange={() => setGymId(gym.id)}
                      />
                      <span>
                        {gym.branch ?? gym.name}
                        <span className="text-charcoal-400"> Â· {gym.name}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-xl border border-charcoal-200 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-charcoal-700">{t('Leave & attendance')}</p>
              <div className="grid grid-cols-3 gap-3">
                <Field
                  id="acc-annual"
                  label={t('Annual leave (days)')}
                  hint={t('Earned from the hire date; a grant raises the ceiling up to {{max}} days.', {
                    max: annualLeaveMax,
                  })}
                >
                  <Input
                    id="acc-annual"
                    type="number"
                    min={0}
                    max={annualLeaveMax}
                    step={0.5}
                    className="h-8 text-xs"
                    placeholder={t('Policy')}
                    value={annualLeave}
                    onChange={(e) => {
                      leaveFieldsTouched.current.annual = true
                      setAnnualLeave(e.target.value)
                    }}
                  />
                </Field>
                <Field
                  id="acc-sick"
                  label={t('Sick leave (days)')}
                  hint={t('Standard allowance; blank keeps the default.')}
                >
                  <Input
                    id="acc-sick"
                    type="number"
                    min={0}
                    max={365}
                    step={0.5}
                    className="h-8 text-xs"
                    placeholder="10"
                    value={sickLeave}
                    onChange={(e) => {
                      leaveFieldsTouched.current.sick = true
                      setSickLeave(e.target.value)
                    }}
                  />
                </Field>
                <Field
                  id="acc-excused"
                  label={t('Excused hours / month')}
                  hint={t('Starts from the branch policy; blank keeps following it.')}
                >
                  <Input
                    id="acc-excused"
                    type="number"
                    min={0}
                    max={99.99}
                    step={0.25}
                    className="h-8 text-xs"
                    placeholder={t('Branch cap')}
                    value={excusedHours}
                    onChange={(e) => {
                      leaveFieldsTouched.current.excused = true
                      setExcusedHours(e.target.value)
                    }}
                  />
                </Field>
              </div>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  )
}
