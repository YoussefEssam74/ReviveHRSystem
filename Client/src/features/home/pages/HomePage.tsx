import { Link } from 'react-router-dom'
import { ArrowRight, Building2, Fingerprint, ScrollText, ShieldCheck } from 'lucide-react'
import { useAuthSession } from '../../../contexts/AuthSessionContext'

const FEATURES = [
  {
    icon: Fingerprint,
    title: 'Live attendance',
    description: 'Check-in and check-out events with schedule-aware lateness and early-checkout detection.',
  },
  {
    icon: Building2,
    title: 'Multi-gym workforce',
    description: 'Employees, shift cycles and gym access managed across every branch from one place.',
  },
  {
    icon: ShieldCheck,
    title: 'Role-based access',
    description: 'Portals for admins, HR and employees — each sees exactly what their role allows.',
  },
  {
    icon: ScrollText,
    title: 'Full audit trail',
    description: 'Sensitive changes are recorded with who did it, when, and what changed.',
  },
] as const

export default function HomePage() {
  const { session } = useAuthSession()

  return (
    <div>
      <section className="border-b border-slate-200 bg-gradient-to-b from-emerald-50/70 via-white/60 to-transparent">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:py-28">
          <p className="mx-auto w-fit rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
            Workforce & attendance platform
          </p>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Run your gym workforce on <span className="text-emerald-600">one system</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-600 sm:text-lg">
            Revive HR connects attendance stations, shift schedules and employee records in real time — from the
            front desk to head office.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {session ? (
              <Link
                to="/dashboard"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
              >
                Go to dashboard
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
              >
                Sign in to the portal
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">
          Everything attendance, end to end
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500">
          From the station at the gym door to the reports in head office.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <feature.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-bold text-slate-900">{feature.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
