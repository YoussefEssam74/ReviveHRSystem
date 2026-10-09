import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, LockKeyhole } from 'lucide-react'
import { useAuthSession } from '../../../contexts/AuthSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card'
import { useLogin, useSelectGym } from '../hooks/useAuthMutations'
import type { GymOption } from '../api/auth.api'

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormValues = z.infer<typeof loginSchema>

interface GymChallenge {
  gyms: GymOption[]
  tempSessionToken: string
}

export default function LoginPage() {
  const { session } = useAuthSession()
  const login = useLogin()
  const selectGym = useSelectGym()
  const [challenge, setChallenge] = useState<GymChallenge | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  if (session) return <Navigate to="/dashboard" replace />

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null)
    try {
      const response = await login.mutateAsync(values)
      if (response.requiresGymSelection && response.tempSessionToken && response.gyms && response.gyms.length > 0) {
        setChallenge({ gyms: response.gyms, tempSessionToken: response.tempSessionToken })
      } else if (response.requiresGymSelection) {
        setFormError('Your account is assigned to gyms that are not available. Contact your administrator.')
      }
      // Otherwise the mutation hook already stored the completed session.
    } catch (error) {
      setFormError(describeApiError(error))
    }
  }

  const onSelectGym = async (gymId: number) => {
    if (!challenge) return
    setFormError(null)
    try {
      await selectGym.mutateAsync({ gymId, tempSessionToken: challenge.tempSessionToken })
    } catch (error) {
      setFormError(describeApiError(error))
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-20">
      <Card>
        <CardHeader className="text-center">
          <span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            {challenge ? <Building2 className="h-5 w-5" aria-hidden="true" /> : <LockKeyhole className="h-5 w-5" aria-hidden="true" />}
          </span>
          <CardTitle>{challenge ? 'Choose your gym' : 'Sign in'}</CardTitle>
          <CardDescription>
            {challenge
              ? 'Your account works at more than one gym. Pick where you are working today.'
              : 'Use your Revive HR account to access the portal.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {formError && (
            <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}

          {!challenge ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  aria-invalid={Boolean(errors.email)}
                  {...register('email')}
                />
                {errors.email && <p role="alert" className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.password)}
                  {...register('password')}
                />
                {errors.password && <p role="alert" className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
              </div>
              <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
                Sign in
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              {challenge.gyms.map((gym) => {
                if (gym.gymId === undefined) return null
                const gymId = gym.gymId
                return (
                  <button
                    key={gymId}
                    type="button"
                    onClick={() => onSelectGym(gymId)}
                    disabled={selectGym.isPending}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-60"
                  >
                    <span className="text-sm font-semibold text-slate-900">{gym.gymName}</span>
                    <Building2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  </button>
                )
              })}
              <Button
                variant="ghost"
                className="w-full"
                disabled={selectGym.isPending}
                onClick={() => {
                  setChallenge(null)
                  setFormError(null)
                  login.reset()
                }}
              >
                Use a different account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
