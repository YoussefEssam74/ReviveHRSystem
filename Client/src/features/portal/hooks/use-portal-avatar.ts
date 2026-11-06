import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { downloadProfilePhoto, getOwnProfile } from '../api/employee-file.api'

/**
 * The signed-in employee's avatar for the portal chrome (header and sidebar).
 *
 * The profile query shares its key with MyProfilePage, so uploading a new photo
 * there invalidates it here too; the new `photoUrl` (or `dataUpdatedAt` when the
 * URL itself is unchanged) triggers a fresh authenticated blob download.
 */
export function usePortalAvatar(employeeId: number | null): string | null {
  const [photoObjectUrl, setPhotoObjectUrl] = useState<string | null>(null)

  const profileQuery = useQuery({
    queryKey: ['portal', 'profile', employeeId],
    queryFn: ({ signal }) => getOwnProfile(employeeId!, signal),
    enabled: employeeId != null,
    retry: false,
    staleTime: 60_000,
  })

  const photoUrl = profileQuery.data?.photoUrl ?? null
  const profileVersion = profileQuery.dataUpdatedAt

  useEffect(() => {
    if (!employeeId || !photoUrl) {
      setPhotoObjectUrl(null)
      return undefined
    }

    const controller = new AbortController()
    let revoked = false
    let objectUrl: string | null = null

    downloadProfilePhoto(employeeId, controller.signal)
      .then(({ blob }) => {
        objectUrl = URL.createObjectURL(blob)
        if (revoked) URL.revokeObjectURL(objectUrl)
        else setPhotoObjectUrl(objectUrl)
      })
      .catch(() => {
        // A stale URL or a deleted file leaves the initials fallback in place.
        if (!revoked) setPhotoObjectUrl(null)
      })

    return () => {
      revoked = true
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    // profileVersion changes after the profile page uploads/replaces a photo.
  }, [employeeId, photoUrl, profileVersion])

  return photoObjectUrl
}
