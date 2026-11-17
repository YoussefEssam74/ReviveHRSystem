import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { downloadProfilePhoto } from '../api/employee-file.api'
import { cn } from '../../../lib/utils'

/**
 * An employee's avatar, falling back to their initials.
 *
 * The photo endpoint answers 404 for employees without one, so the query is
 * cached as a miss instead of retried — a roster renders one per row and would
 * otherwise re-request every missing photo on each render.
 */
export function EmployeeAvatar({
  employeeId,
  initials,
  className,
}: {
  employeeId: number
  initials: string
  className?: string
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  const photoQuery = useQuery({
    queryKey: ['portal', 'avatar', employeeId],
    queryFn: ({ signal }) => downloadProfilePhoto(employeeId, signal),
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const blob = photoQuery.data?.blob

  useEffect(() => {
    if (!blob) {
      setPhotoUrl(null)
      return undefined
    }
    const objectUrl = URL.createObjectURL(blob)
    setPhotoUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])

  return (
    <span
      className={cn(
        'flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700',
        className,
      )}
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  )
}
