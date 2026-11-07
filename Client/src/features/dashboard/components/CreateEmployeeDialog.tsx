import { useEffect, useState, type FormEvent } from 'react'
import { Camera, Loader2, RefreshCw } from 'lucide-react'
import { Dialog } from '../../../components/ui/dialog'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { useCamera } from '../../../lib/use-camera'
import { useQuery } from '@tanstack/react-query'
import { getGyms } from '../../console/api/console.api'
import { getRoles } from '../../hr-team/api/hr-team.api'
import { useCreateEmployee } from '../../employees/hooks/useEmployees'
import { postRoleChange } from '../../employees/api/employees.api'
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

function splitName(fullName: string): { firstName: string; lastName: string } | null {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] }
}

function emailFromName(fullName: string): string {
  return fullName
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z.]/g, '') + '@revive.com'
}

/**
 * Fast action "Create Account" (mock js/pages-dashboard.js openCreateAccountModal):
 * employee profile + home branch, optional Face-ID photo (real camera + enroll API),
 * system role, then POST /api/employees — the account itself is created server-side.
 */
export default function CreateEmployeeDialog({ onClose, toast }: CreateEmployeeDialogProps) {
  const { data: gyms = [] } = useQuery({ queryKey: ['gyms'], queryFn: ({ signal }) => getGyms(signal) })
  // Role templates live in Role management; without team.view the base roles are offered.
  const { data: rolesData } = useQuery({
    queryKey: ['roles', 'dashboard'],
    queryFn: ({ signal }) => getRoles({ page: 1, pageSize: 50 }, signal),
    retry: false,
  })

  const createEmployee = useCreateEmployee()
  const enrollFace = useDashboardFaceEnroll()
  const today = new Date().toISOString().slice(0, 10)
  const [fullName, setFullName] = useState('')
  const [position, setPosition] = useState('')
  const [level, setLevel] = useState('Junior')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [hireDate, setHireDate] = useState(today)
  const [salary, setSalary] = useState('')
  const [gymId, setGymId] = useState<number | null>(null)
  const [role, setRole] = useState('Emp')
  const [error, setError] = useState<string | null>(null)

  // Role options: base roles + any role template configured in HR Team Management.
  const roleOptions = BASE_ROLES.concat(
    (rolesData?.items?.map((r) => r.name) ?? []).filter((name) => !BASE_ROLES.includes(name)),
  )

  // Face-ID capture — the same zoom-free webcam control the kiosk uses.
  const { videoRef, active: cameraActive, start, stop, capture } = useCamera()
  const [photo, setPhoto] = useState<string | null>(null)

  useEffect(() => () => stop(), [stop])

  const onNameChange = (value: string) => {
    setFullName(value)
    if (!emailTouched) setEmail(emailFromName(value))
  }

  const startFaceCamera = async () => {
    const started = await start()
    if (!started) toast('Camera unavailable — you can still create the account without a photo', 'warning')
  }

  const captureFace = () => {
    const dataUrl = capture()
    if (!dataUrl) {
      toast('Camera is not ready yet', 'warning')
      return
    }
    setPhoto(dataUrl)
    stop()
  }

  const retakeFace = () => {
    setPhoto(null)
    void startFaceCamera()
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const nameErrors = !fullName.trim()
      ? 'Please enter the employee full name'
      : !position.trim()
        ? 'Please enter the position'
        : !email.trim() || !/.+@.+\..+/.test(email.trim())
          ? 'Please enter a valid work email'
          : gymId == null
            ? 'Select a home gym / branch'
            : null
    if (nameErrors) {
      setError(nameErrors)
      return
    }

    const names = splitName(fullName)
    if (!names) {
      setError('Please enter the employee full name')
      return
    }

    setError(null)
    stop()
    try {
      const created = await createEmployee.mutateAsync({
        firstName: names.firstName,
        lastName: names.lastName,
        email: email.trim(),
        position: position.trim(),
        level,
        phone: phone.trim() || undefined,
        salary: salary.trim() ? Number(salary) : undefined,
        gym: gymId!,
        startDate: hireDate,
      })

      // Optional extras run after the employee exists; failures stay visible but
      // never undo the account.
      if (role !== 'Emp') {
        try {
          await postRoleChange(created.id, { systemRole: role })
        } catch (roleError) {
          toast(`Employee ${created.employeeNumber} created, but the ${role} role could not be applied: ${describeApiError(roleError)}`, 'warning')
        }
      }
      if (photo) {
        try {
          await enrollFace.mutateAsync({ employeeNumber: created.employeeNumber, image: photo })
          toast(`New employee ${fullName.trim()} (${created.employeeNumber}) created — Face-ID photo saved for attendance.`, 'success')
        } catch (enrollError) {
          toast(`Employee ${created.employeeNumber} created, but Face-ID save failed: ${describeApiError(enrollError)}`, 'warning')
        }
      } else {
        toast(`New employee ${fullName.trim()} (${created.employeeNumber}) created — no Face-ID photo yet.`, 'success')
      }
      onClose()
    } catch (submitError) {
      setError(describeApiError(submitError))
    }
  }

  const saving = createEmployee.isPending || enrollFace.isPending

  return (
    <Dialog
      open
      onClose={onClose}
      title="Create New Employee Account"
      description="Creates the employee profile and their login account (code auto-generated)."
      className="sm:max-w-xl"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={onSubmit} loading={saving}>
            Create Employee &amp; Account
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4 text-xs">
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
            {error}
          </p>
        )}

        <div className="space-y-3 rounded-xl border border-charcoal-200 bg-charcoal-50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-charcoal-700">New Employee Profile</p>
            <span className="font-mono text-[11px] text-charcoal-500">Code: auto-generated (EMP-####)</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs font-semibold text-charcoal-700" htmlFor="acc-name">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input id="acc-name" className="h-8 text-xs" placeholder="e.g. Mariam Adel" value={fullName} onChange={(e) => onNameChange(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold text-charcoal-700" htmlFor="acc-position">
                Position <span className="text-red-500">*</span>
              </Label>
              <Input id="acc-position" className="h-8 text-xs" placeholder="Type the position freely" value={position} onChange={(e) => setPosition(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs font-semibold text-charcoal-700" htmlFor="acc-level">
                Level
              </Label>
              <Select id="acc-level" className="h-8 text-xs" value={level} onChange={(e) => setLevel(e.target.value)}>
                {LEVELS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold text-charcoal-700" htmlFor="acc-phone">
                Phone
              </Label>
              <Input id="acc-phone" type="tel" className="h-8 text-xs" placeholder="+20 1XX XXX XXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs font-semibold text-charcoal-700" htmlFor="acc-email">
                Work Email <span className="text-red-500">*</span>
              </Label>
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
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold text-charcoal-700" htmlFor="acc-hire">
                Hire Date
              </Label>
              <Input id="acc-hire" type="date" className="h-8 text-xs" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs font-semibold text-charcoal-700" htmlFor="acc-salary">
                Base Salary (EGP)
              </Label>
              <Input id="acc-salary" type="number" min={0} className="h-8 text-xs" placeholder="e.g. 9000" value={salary} onChange={(e) => setSalary(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold text-charcoal-700" htmlFor="acc-role">
                System Role
              </Label>
              <Select id="acc-role" className="h-8 text-xs" value={role} onChange={(e) => setRole(e.target.value)}>
                {roleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'Emp' ? 'Emp (No system role)' : option}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-charcoal-200 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-charcoal-700">
            Gym / Branch Assignment <span className="font-normal normal-case text-charcoal-500">(home branch — one per employee)</span>
          </p>
          {gyms.length === 0 ? (
            <p className="text-charcoal-400">No gyms available for your scope.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {gyms.map((gym) => (
                <label
                  key={gym.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs transition-colors ${
                    gymId === gym.id ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-charcoal-200 bg-charcoal-50 hover:bg-charcoal-100/60'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded text-brand-600 accent-[#006c49]"
                    checked={gymId === gym.id}
                    onChange={() => setGymId(gym.id)}
                  />
                  <span>
                    {gym.branch ?? gym.name}
                    <span className="text-charcoal-400"> · {gym.name}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-xl border border-charcoal-200 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-charcoal-700">Face-ID for Attendance</p>
            <span className={`text-[10px] font-semibold ${photo ? 'text-brand-600' : 'text-charcoal-400'}`}>
              {photo ? 'Photo captured ✓' : 'No photo yet'}
            </span>
          </div>
          <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-lg bg-charcoal-900">
            <video ref={videoRef} autoPlay playsInline muted className={`h-full w-full object-cover ${cameraActive && !photo ? '' : 'hidden'}`} />
            {photo && <img src={photo} alt="captured face" className="h-64 w-64 rounded-lg object-cover" />}
            {!cameraActive && !photo && (
              <div className="flex flex-col items-center gap-1 px-6 text-center text-[11px] text-white/50">
                <Camera className="h-7 w-7" aria-hidden="true" />
                Take a clear front-facing photo — the employee checks in automatically at the Attendance Station
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {!cameraActive && !photo && (
              <button type="button" onClick={startFaceCamera} className="btn-mock-secondary flex-1 rounded-lg border border-charcoal-300 bg-white px-2 py-1.5 font-medium text-charcoal-700 text-xs hover:bg-charcoal-100">
                <Camera className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" /> Start Camera
              </button>
            )}
            {cameraActive && !photo && (
              <button type="button" onClick={captureFace} className="flex-1 rounded-lg bg-brand-600 px-2 py-1.5 font-medium text-white text-xs hover:bg-brand-700">
                Capture Photo
              </button>
            )}
            {photo && (
              <button type="button" onClick={retakeFace} className="flex-1 rounded-lg border border-charcoal-300 bg-white px-2 py-1.5 font-medium text-charcoal-700 text-xs hover:bg-charcoal-100">
                <RefreshCw className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" /> Retake
              </button>
            )}
          </div>
        </div>

        <div>
          <Label className="mb-1 block text-xs font-semibold text-charcoal-700" htmlFor="acc-pass">
            Initial Password
          </Label>
          <div className="flex items-center gap-1.5">
            <Input id="acc-pass" readOnly value={DEFAULT_PASSWORD} className="flex-1 font-mono text-xs" />
          </div>
          <p className="mt-1 text-[10px] text-charcoal-500">
            The account starts with this password — change it any time from “Change Password”.
          </p>
        </div>
      </form>
    </Dialog>
  )
}
