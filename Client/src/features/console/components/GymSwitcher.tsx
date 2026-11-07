import { useState } from 'react'
import { Building2, Check, ChevronDown, Loader2 } from 'lucide-react'
import { useMe } from '../../../contexts/MeContext'
import { cn } from '../../../lib/utils'

/** Header gym switcher backed by POST /api/auth/switch-gym. */
export function GymSwitcher() {
  const { me, switchGym, isSwitching } = useMe()
  const [open, setOpen] = useState(false)

  const gyms = me?.gyms ?? []
  const active = me?.activeGym

  // A single gym (or none) needs no menu.
  if (gyms.length <= 1) {
    return (
      <span className="inline-flex max-w-[12rem] items-center gap-1.5 truncate rounded-lg bg-slate-100 px-2.5 py-1.5 text-sm font-medium text-slate-700">
        <Building2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <span className="truncate">{active?.gymName ?? 'No gym'}</span>
      </span>
    )
  }

  const onSelect = async (gymId: number) => {
    setOpen(false)
    if (gymId === active?.gymId) return
    await switchGym(gymId)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isSwitching}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex max-w-[12rem] items-center gap-1.5 truncate rounded-lg bg-slate-100 px-2.5 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-60"
      >
        {isSwitching ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden="true" />
        ) : (
          <Building2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        )}
        <span className="truncate">{active?.gymName ?? 'Select gym'}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            className="absolute right-0 z-40 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
          >
            {gyms.map((gym) => (
              <button
                key={gym.gymId}
                type="button"
                role="menuitem"
                onClick={() => onSelect(gym.gymId)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50',
                  gym.gymId === active?.gymId ? 'text-emerald-700' : 'text-slate-700',
                )}
              >
                <span className="truncate">{gym.gymName}</span>
                {gym.gymId === active?.gymId && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
