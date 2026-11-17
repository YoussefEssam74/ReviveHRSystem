import { cn } from '../../lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />
}

/** Card-shaped loading placeholder matching the portal's stat tiles. */
export function StatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card px-3 py-3">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="mt-2 h-5 w-12" />
        </div>
      ))}
    </div>
  )
}
