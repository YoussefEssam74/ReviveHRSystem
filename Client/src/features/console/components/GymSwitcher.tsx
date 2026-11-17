import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { useMe } from '../../../contexts/MeContext'
import { describeApiError } from '../../../lib/api-client'
import { useToast } from '../../../components/ui/toast'

/**
 * Header gym switcher backed by POST /api/auth/switch-gym - the same control the
 * employee portal shows (bordered pill, "Your gyms" menu, tick on the active gym).
 */
export function GymSwitcher() {
  const { t } = useTranslation()
  const { me, switchGym, isSwitching } = useMe()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)

  const gyms = me?.gyms ?? []
  const active = me?.activeGym

  // A single gym (or none) needs no menu.
  if (gyms.length <= 1) return null

  const onSelect = async (gymId: number) => {
    setOpen(false)
    if (gymId === active?.gymId) return
    try {
      await switchGym(gymId)
    } catch (error) {
      // A failed switch leaves the session on the current gym. Without this the
      // menu simply closed and the header kept the old name, which reads as
      // "the switcher is broken" instead of naming the actual failure.
      toast(t('Could not switch gym - {{error}}', { error: describeApiError(error) }), 'error')
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={isSwitching}
        className="flex max-w-40 items-center gap-1 rounded-lg border border-charcoal-200 px-2.5 py-1.5 text-xs font-medium text-charcoal-700 hover:bg-charcoal-50 lg:max-w-none"
        aria-label={t('Switch gym')}
        aria-expanded={open}
      >
        <span className="truncate">{active?.gymName ?? t('Choose gym')}</span>
        {isSwitching ? (
          <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin text-charcoal-400" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3 w-3 flex-shrink-0 text-charcoal-400" aria-hidden="true" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute end-0 z-40 mt-2 w-56 rounded-xl border border-charcoal-200 bg-white py-1.5 shadow-xl">
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-charcoal-400">{t('Your gyms')}</p>
            {gyms.map((gym) => {
              const isActive = gym.gymId === active?.gymId
              return (
                <button
                  key={gym.gymId}
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-start text-xs text-charcoal-700 hover:bg-charcoal-50 disabled:opacity-60"
                  onClick={() => onSelect(gym.gymId)}
                >
                  <span className="truncate">{gym.gymName}</span>
                  {isActive && <Check className="h-3.5 w-3.5 flex-shrink-0 text-brand-600" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}