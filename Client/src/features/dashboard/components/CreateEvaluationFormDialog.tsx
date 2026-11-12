import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { useMe } from '../../../contexts/MeContext'
import { describeApiError } from '../../../lib/api-client'
import {
  postEvaluationDispatch,
  postEvaluationForm,
  postEvaluationLaunchCycle,
  type QuestionInput,
} from '../../evaluations/api/evaluations.api'
import type { ToastTone } from '../hooks/useMockToast'

export interface CreateEvaluationFormDialogProps {
  onClose: () => void
  toast: (message: string, tone?: ToastTone) => void
}

/** The rating questions the mock's evaluation builder starts from. */
const DEFAULT_QUESTIONS: QuestionInput[] = [
  { type: 'text', text: 'Punctuality & attendance', options: [] },
  { type: 'text', text: 'Member service quality', options: [] },
  { type: 'text', text: 'Team collaboration', options: [] },
  { type: 'choose', text: 'Overall recommendation', options: ['Exceeds', 'Meets', 'Below'] },
]

/**
 * Fast action "Evaluation Form" (mock openCreateEvaluationFormModal): creates the
 * template, launches its review cycle and dispatches it to the eligible evaluators.
 */
export default function CreateEvaluationFormDialog({ onClose, toast }: CreateEvaluationFormDialogProps) {
  const { me } = useMe()
  const queryClient = useQueryClient()

  const [name, setName] = useState('Monthly Performance Review')
  const [position, setPosition] = useState('All')
  const [gym, setGym] = useState(me?.activeGym?.gymName ?? 'All')
  const [period, setPeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()} Q${Math.floor(now.getMonth() / 3) + 1}`
  })
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: async () => {
      const form = await postEvaluationForm({
        name: name.trim(),
        position,
        gym,
        status: 'Active',
        questionList: DEFAULT_QUESTIONS,
      })
      await postEvaluationLaunchCycle(form.id, { period })
      const dispatch = await postEvaluationDispatch(form.id)
      return { form, dispatch }
    },
    onSuccess: ({ form, dispatch }) => {
      queryClient.invalidateQueries({ queryKey: ['evaluations'] })
      toast(
        `Evaluation form “${form.name}” created · ${dispatch.routedEvaluators} evaluator${dispatch.routedEvaluators === 1 ? '' : 's'} routed.`,
      )
      onClose()
    },
    onError: (submitError) => setError(describeApiError(submitError)),
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Please enter a form name.')
      return
    }
    setError(null)
    create.mutate()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Create New Evaluation Form"
      className="sm:max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={create.isPending}>
            Create &amp; Dispatch
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3">
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div>
          <Label htmlFor="ev-name">Form name</Label>
          <Input id="ev-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ev-position">Target position</Label>
            <Input
              id="ev-position"
              value={position}
              onChange={(event) => setPosition(event.target.value)}
              placeholder="All"
            />
          </div>
          <div>
            <Label htmlFor="ev-gym">Target branch</Label>
            <Select id="ev-gym" value={gym} onChange={(event) => setGym(event.target.value)}>
              <option value="All">All Branches</option>
              {(me?.gyms ?? []).map((option) => (
                <option key={option.gymId} value={option.gymName}>
                  {option.gymName}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="ev-period">Review period</Label>
          <Input id="ev-period" value={period} onChange={(event) => setPeriod(event.target.value)} />
        </div>

        <div className="rounded-xl border border-charcoal-200 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-charcoal-700">Questions</p>
          <ul className="mt-1.5 space-y-1">
            {DEFAULT_QUESTIONS.map((question) => (
              <li key={question.text} className="flex items-center justify-between rounded bg-charcoal-50 px-2 py-1 text-[11px]">
                <span className="text-charcoal-800">{question.text}</span>
                <span className="badge badge-gray text-[9px]">{question.type === 'choose' ? 'Choice' : 'Rating'}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[10px] text-charcoal-400">
            The template starts from these questions — refine them later in Evaluations → Form Builder.
          </p>
        </div>
      </form>
    </Dialog>
  )
}
