import { useState } from 'react'
import { gymLogoUrl, gymMonogram, type GymBrandInput } from '../../lib/gym-brand'
import { cn } from '../../lib/utils'

/**
 * The active gym's logo. Seeded files live in Client/public/gym-logos/; an
 * unknown gym (or a missing file) renders a monogram tile instead, so branding
 * never collapses into a broken image.
 */
export function GymLogo({ gym, className }: { gym: GymBrandInput | null | undefined; className?: string }) {
  const source = gymLogoUrl(gym)
  const [failedSource, setFailedSource] = useState<string | null>(null)

  if (source && failedSource !== source) {
    return (
      <img
        src={source}
        alt=""
        aria-hidden="true"
        className={cn('shrink-0 object-contain', className)}
        onError={() => setFailedSource(source)}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-600 text-[9px] font-bold leading-none text-white',
        className,
      )}
    >
      {gymMonogram(gym?.name ?? gym?.gymName)}
    </span>
  )
}
