import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LogIn, LogOut, Unplug } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import type { AttendanceEventType } from '../types'

const employeeNumberSchema = z.object({
  employeeNumber: z.string().trim().min(1, 'Employee number is required').max(50),
})

type EmployeeNumberFormValues = z.infer<typeof employeeNumberSchema>

interface AttendanceEventFormProps {
  gymName: string
  pending: boolean
  errorMessage: string | null
  onRecord: (employeeNumber: string, type: AttendanceEventType) => void
  onDisconnect: () => void
}

export function AttendanceEventForm({ gymName, pending, errorMessage, onRecord, onDisconnect }: AttendanceEventFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmployeeNumberFormValues>({
    resolver: zodResolver(employeeNumberSchema),
    defaultValues: { employeeNumber: '' },
  })

  const submit = (type: AttendanceEventType) => {
    handleSubmit((values) => onRecord(values.employeeNumber, type))()
  }

  return (
    <form className="space-y-4" onSubmit={(event) => event.preventDefault()} noValidate>
      <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-emerald-700">Connected station</p>
          <p className="truncate text-sm font-bold text-slate-900">{gymName}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onDisconnect}>
          <Unplug className="h-3.5 w-3.5" aria-hidden="true" />
          Disconnect
        </Button>
      </div>

      <div>
        <Label htmlFor="employee-number">Employee number</Label>
        <Input
          id="employee-number"
          autoComplete="off"
          maxLength={50}
          placeholder="e.g. EMP-1042"
          aria-invalid={Boolean(errors.employeeNumber)}
          {...register('employeeNumber')}
        />
        {errors.employeeNumber && <p role="alert" className="mt-1 text-xs text-red-600">{errors.employeeNumber.message}</p>}
      </div>

      {errorMessage && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" loading={pending} onClick={() => submit('IN')}>
          <LogIn className="h-4 w-4" aria-hidden="true" />
          Check in
        </Button>
        <Button size="lg" variant="secondary" loading={pending} onClick={() => submit('OUT')}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Check out
        </Button>
      </div>
    </form>
  )
}
