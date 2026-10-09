import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Camera, CameraOff, CheckCircle2, ScanFace } from 'lucide-react'
import { useAuthSession } from '../../../contexts/AuthSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { useCamera } from '../../../lib/use-camera'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card'
import { postFaceEnrollment, type FaceEnrollmentResponse } from '../api/attendance.api'

const enrollmentSchema = z.object({
  employeeNumber: z.string().trim().min(1, 'Employee number is required').max(50),
})

type EnrollmentFormValues = z.infer<typeof enrollmentSchema>

/** HR-side face enrollment: one live frame per employee, stored in the database. */
export default function EnrollmentPage() {
  const { session } = useAuthSession()
  const camera = useCamera()
  const [enrolled, setEnrolled] = useState<FaceEnrollmentResponse | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const enroll = useMutation({
    mutationFn: (input: { employeeNumber: string; image: string }) => postFaceEnrollment(input),
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EnrollmentFormValues>({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: { employeeNumber: '' },
  })

  if (!session) return <Navigate to="/login" replace />

  const onCapture = handleSubmit(async (values) => {
    setFormError(null)
    setEnrolled(null)
    const image = camera.capture()
    if (!image) {
      setFormError('Start the camera first, then capture.')
      return
    }
    try {
      const response = await enroll.mutateAsync({ employeeNumber: values.employeeNumber, image })
      setEnrolled(response)
      camera.stop()
    } catch (error) {
      setFormError(describeApiError(error))
    }
  })

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="mb-8 text-center">
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <ScanFace className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Face enrollment</h1>
        <p className="mt-1 text-sm text-slate-500">Register an employee's face for Face-ID attendance check-in.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enroll a face</CardTitle>
          <CardDescription>
            Enter the employee number, start the camera, then capture while they face it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="enroll-employee-number">Employee number</Label>
            <Input
              id="enroll-employee-number"
              autoComplete="off"
              maxLength={50}
              placeholder="e.g. EMP-1042"
              aria-invalid={Boolean(errors.employeeNumber)}
              {...register('employeeNumber')}
            />
            {errors.employeeNumber && <p role="alert" className="mt-1 text-xs text-red-600">{errors.employeeNumber.message}</p>}
          </div>

          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
            <video
              ref={camera.videoRef}
              autoPlay
              playsInline
              muted
              className={'aspect-video w-full -scale-x-100 object-cover ' + (camera.active ? 'block' : 'hidden')}
            />
            {!camera.active && (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-slate-400">
                <Camera className="h-10 w-10" aria-hidden="true" />
                <p className="text-sm">Camera is off</p>
              </div>
            )}
          </div>

          {camera.error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {camera.error}
            </p>
          )}
          {formError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}

          {enrolled && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm">
              <p className="flex items-center gap-2 font-bold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Face enrolled
              </p>
              <p className="mt-1 text-slate-700">{enrolled.fullName} · {enrolled.employeeNumber}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {camera.active ? (
              <Button variant="outline" size="lg" onClick={camera.stop}>
                <CameraOff className="h-4 w-4" aria-hidden="true" />
                Stop camera
              </Button>
            ) : (
              <Button size="lg" onClick={() => void camera.start()}>
                <Camera className="h-4 w-4" aria-hidden="true" />
                Start camera
              </Button>
            )}
            <Button size="lg" loading={enroll.isPending} onClick={(event) => void onCapture(event)}>
              Capture &amp; enroll
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
