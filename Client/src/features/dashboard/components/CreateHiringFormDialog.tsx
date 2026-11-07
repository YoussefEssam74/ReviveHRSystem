import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useMe } from '../../../contexts/MeContext'
import { Dialog } from '../../../components/ui/dialog'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { postHiringForm, type QuestionInput } from '../../evaluations/api/evaluations.api'
import { useQueryClient } from '@tanstack/react-query'
import { describeApiError } from '../../../lib/api-client'
import type { ToastTone } from '../hooks/useMockToast'

export interface CreateHiringFormDialogProps {
  onClose: () => void
  toast: (message: string, tone?: ToastTone) => void
}

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract / Freelance']

/**
 * Applicant fields the backend always collects when candidates apply — shown
 * locked-checked, exactly like the mock's default state (only "Full Name & Phone"
 * was locked there; the API collects the whole set).
 */
const FIXED_APPLICATION_FIELDS = [
  'Full Name & Phone',
  'CV / Resume Upload',
  'Years of Experience',
  'Expected Salary',
  'Fitness Certifications',
  'Shift Availability',
]

/**
 * Fast action "Hiring Form" (mock openCreateHiringFormModal) — publishes a hiring
 * form through POST /api/hiring-forms (evaluations.forms.manage).
 */
export default function CreateHiringFormDialog({ onClose, toast }: CreateHiringFormDialogProps) {
  const { me } = useMe()
  const queryClient = useQueryClient()

  const [position, setPosition] = useState('')
  const [gym, setGym] = useState(me?.activeGym?.gymName ?? 'All')
  const [employmentType, setEmploymentType] = useState('Full-time')
  const [headcount, setHeadcount] = useState('2')
  const [error, setError] = useState<string | null>(null)

  const publish = useMutation({
    mutationFn: (body: Parameters<typeof postHiringForm>[0]) => postHiringForm(body),
    onSuccess: (form) => {
      queryClient.invalidateQueries({ queryKey: ['evaluations', 'hiring-forms'] })
      queryClient.invalidateQueries({ queryKey: ['recruitment'] })
      toast(`Hiring form published for “${form.name}”! Application link generated.`, 'success')
      onClose()
    },
    onError: (submitError) => setError(describeApiError(submitError)),
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const title = position.trim()
    if (!title) {
      setError('Please enter the position title')
      return
    }
    setError(null)

    const seats = Math.max(1, Math.min(99, Number(headcount) || 1))
    const questions: QuestionInput[] = [
      { type: 'choose', text: 'Employment Type', options: EMPLOYMENT_TYPES },
    ]

    publish.mutate({
      name: `${title} — ${seats} seat${seats === 1 ? '' : 's'}`,
      position: title,
      gym,
      status: 'Open',
      questionList: questions,
    })
  }

  const gymNames = me?.gyms.map((option) => option.gymName) ?? []
  const gymOptions = ['All', ...gymNames]

  return (
    <Dialog
      open
      onClose={onClose}
      title="Create New Hiring / Application Form"
      className="sm:max-w-lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={onSubmit} loading={publish.isPending}>
            Publish Hiring Form
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3.5 text-xs">
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1 block font-semibold text-charcoal-700" htmlFor="hf-title">
              Position Title
            </Label>
            <Input id="hf-title" className="h-8 text-xs" placeholder="e.g. Senior Fitness Coach" value={position} onChange={(e) => setPosition(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block font-semibold text-charcoal-700" htmlFor="hf-gym">
              Target Gym Branch
            </Label>
            <Select id="hf-gym" className="h-8 text-xs" value={gym} onChange={(e) => setGym(e.target.value)}>
              {gymOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'All' ? 'All Branches' : option}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1 block font-semibold text-charcoal-700" htmlFor="hf-type">
              Employment Type
            </Label>
            <Select id="hf-type" className="h-8 text-xs" value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
              {EMPLOYMENT_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="mb-1 block font-semibold text-charcoal-700" htmlFor="hf-headcount">
              Target Headcount
            </Label>
            <Input id="hf-headcount" type="number" min={1} className="h-8 text-xs" value={headcount} onChange={(e) => setHeadcount(e.target.value)} />
          </div>
        </div>

        <div>
          <Label className="mb-1.5 block text-xs font-semibold text-charcoal-700" htmlFor="hf-fields-0">
            Required Application Fields
          </Label>
          <div className="grid grid-cols-2 gap-2" id="hf-fields-0">
            {FIXED_APPLICATION_FIELDS.map((field) => (
              <label key={field} className="flex items-center gap-2 rounded-lg bg-charcoal-50 p-2 text-xs">
                <input type="checkbox" checked disabled className="h-3.5 w-3.5 accent-[#006c49]" />
                <span>{field}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-charcoal-500">
            These fields are always collected from applicants; the form additionally asks for the employment type selected above.
          </p>
        </div>
      </form>
    </Dialog>
  )
}
