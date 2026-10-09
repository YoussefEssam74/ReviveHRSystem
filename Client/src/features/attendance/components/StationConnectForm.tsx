import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'

const stationCodeSchema = z.object({
  stationCode: z.string().trim().regex(/^\d{6}$/, 'Station code must be exactly 6 digits'),
})

type StationCodeFormValues = z.infer<typeof stationCodeSchema>

interface StationConnectFormProps {
  pending: boolean
  errorMessage: string | null
  onConnect: (code: string) => void
}

export function StationConnectForm({ pending, errorMessage, onConnect }: StationConnectFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StationCodeFormValues>({
    resolver: zodResolver(stationCodeSchema),
    defaultValues: { stationCode: '' },
  })

  return (
    <form onSubmit={handleSubmit((values) => onConnect(values.stationCode))} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="station-code">Station code</Label>
        <Input
          id="station-code"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          placeholder="6-digit code"
          aria-invalid={Boolean(errors.stationCode)}
          {...register('stationCode')}
        />
        {errors.stationCode && <p role="alert" className="mt-1 text-xs text-red-600">{errors.stationCode.message}</p>}
      </div>

      {errorMessage && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Connect station
      </Button>
    </form>
  )
}
