import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  ChevronRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { useAuthSession } from '../../../contexts/AuthSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Card, CardContent, CardHeader } from '../../../components/ui/card'
import { GymLogo } from '../../../components/ui/gym-logo'
import loginBackdrop from '../../../assets/login-backdrop.svg'
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
  const [showPassword, setShowPassword] = useState(false)

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
    <div className="relative isolate overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Soft brand artwork keeps the page from reading as an empty form on a flat canvas. */}
      <div
        className="pointer-events-none absolute inset-0 -z-20 bg-cover bg-center opacity-90 dark:opacity-20"
        style={{ backgroundImage: `url(${loginBackdrop})` }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-white/20 via-transparent to-slate-50/70 dark:from-slate-950/50 dark:via-slate-950/20 dark:to-slate-950/80"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-32 top-16 -z-10 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-0 -z-10 h-96 w-96 rounded-full bg-cyan-400/15 blur-3xl dark:bg-cyan-500/10"
        aria-hidden="true"
      />

      <div className="flex min-h-[calc(100dvh-4rem-1px)] items-center justify-center px-4 py-10 sm:px-6 lg:py-16">
        <section className="w-full max-w-md" aria-label="Sign in">
          <Card className="fade-in overflow-hidden rounded-3xl border-slate-200/80 bg-white/90 shadow-2xl shadow-black/10 backdrop-blur-xl dark:shadow-black/40">
            <CardHeader className="space-y-4 px-6 pt-6 text-center sm:px-8 sm:pt-8">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25">
                {challenge ? (
                  <Building2 className="h-6 w-6" aria-hidden="true" />
                ) : (
                  <LockKeyhole className="h-6 w-6" aria-hidden="true" />
                )}
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {challenge ? 'Choose your gym' : 'Sign in to Revive HR'}
                </h1>
                <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500">
                  {challenge
                    ? 'Your account works at more than one gym. Pick where you are working today.'
                    : 'Use your Revive HR account to continue to your workspace.'}
                </p>
              </div>
            </CardHeader>

            <CardContent className="px-6 pb-6 pt-2 sm:px-8 sm:pb-8">
              {formError && (
                <div
                  role="alert"
                  className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{formError}</span>
                </div>
              )}

              {!challenge ? (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                        className="h-11 bg-white pl-10 dark:bg-charcoal-100"
                        aria-invalid={Boolean(errors.email)}
                        {...register('email')}
                      />
                    </div>
                    {errors.email && (
                      <p role="alert" className="mt-1 flex items-center gap-1 text-xs text-red-600">
                        <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <LockKeyhole
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        className="h-11 bg-white pl-10 pr-10 dark:bg-charcoal-100"
                        aria-invalid={Boolean(errors.password)}
                        {...register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((visible) => !visible)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="touch-target absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p role="alert" className="mt-1 flex items-center gap-1 text-xs text-red-600">
                        <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {errors.password.message}
                      </p>
                    )}
                  </div>

                  <Button type="submit" size="lg" className="mt-1 h-11 w-full text-sm font-semibold" loading={login.isPending}>
                    Sign in
                  </Button>
                </form>
              ) : (
                <div className="space-y-2.5">
                  {challenge.gyms.map((gym) => {
                    if (gym.gymId === undefined) return null
                    const gymId = gym.gymId
                    return (
                      <button
                        key={gymId}
                        type="button"
                        onClick={() => onSelectGym(gymId)}
                        disabled={selectGym.isPending}
                        className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white/75 px-3.5 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50/70 hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
                      >
                        <GymLogo gym={{ gymId, gymName: gym.gymName }} className="h-9 w-9 rounded-xl" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">{gym.gymName}</span>
                          <span className="block text-[11px] text-slate-500">Continue to this gym</span>
                        </span>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700"
                          aria-hidden="true"
                        />
                      </button>
                    )
                  })}
                  <Button
                    variant="ghost"
                    className="mt-1 w-full"
                    disabled={selectGym.isPending}
                    onClick={() => {
                      setChallenge(null)
                      setFormError(null)
                      login.reset()
                    }}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    Use a different account
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-700" aria-hidden="true" />
            Access is managed by your HR administrator.
          </p>
        </section>
      </div>
    </div>
  )
}
