import { useEffect, useState } from 'react'
import { apiDownload } from '../../lib/api-client'
import { gymLogoApiPath, gymLogoUrl, gymMonogram, type GymBrandInput } from '../../lib/gym-brand'
import { cn } from '../../lib/utils'

/**
 * The active gym's logo, in fallback order: the logo uploaded for the gym
 * (streamed by the authenticated GET /api/gyms/{id}/logo), the bundled brand
 * asset in Client/public/gym-logos/, then a monogram tile — so branding never
 * collapses into a broken image.
 *
 * The uploaded logo is fetched as an authenticated blob rather than pointed at
 * from `img[src]`, because a bearer token does not ride on image requests.
 */
export function GymLogo({ gym, className }: { gym: GymBrandInput | null | undefined; className?: string }) {
  const apiPath = gymLogoApiPath(gym)
  const bundledSource = gymLogoUrl(gym)
  const [uploaded, setUploaded] = useState<{ path: string; url: string } | null>(null)
  const [failedSource, setFailedSource] = useState<string | null>(null)

  useEffect(() => {
    if (!apiPath) return undefined

    const controller = new AbortController()
    let revoked = false
    let objectUrl: string | null = null

    apiDownload(apiPath, controller.signal)
      .then(({ blob }) => {
        objectUrl = URL.createObjectURL(blob)
        if (revoked) URL.revokeObjectURL(objectUrl)
        else setUploaded({ path: apiPath, url: objectUrl })
      })
      .catch(() => {
        // A 404 means no logo was uploaded for this gym, so the bundled asset
        // (or the monogram) is the right thing to show.
      })

    return () => {
      revoked = true
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [apiPath])

  // Only trust a blob that belongs to the gym being rendered, so switching gyms
  // never flashes the previous branch's logo while the new one downloads.
  const uploadedSource = uploaded && uploaded.path === apiPath ? uploaded.url : null
  const source =
    uploadedSource && failedSource !== uploadedSource ? uploadedSource : bundledSource

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
