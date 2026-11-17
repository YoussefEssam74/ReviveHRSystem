import { cn } from '../../lib/utils'

export interface AvatarProps {
  /** Initials to display. */
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-base',
}

/** Initials avatar with a stable per-name tint. */
export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-700',
        sizeClasses[size],
        className,
      )}
      aria-hidden="true"
    >
      {name || '?'}
    </span>
  )
}
