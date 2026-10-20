import { cn } from '../../lib/utils'

export type BadgeColor = 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'purple' | 'orange'

export function Badge({ color = 'gray', children, className }: { color?: BadgeColor; children: React.ReactNode; className?: string }) {
  return <span className={cn('badge', `badge-${color}`, className)}>{children}</span>
}

const STATUS_COLORS: Record<string, BadgeColor> = {
  // Employment / lifecycle
  active: 'green',
  'on time': 'green',
  present: 'green',
  approved: 'green',
  paid: 'green',
  published: 'green',
  completed: 'green',
  valid: 'green',
  'on shift': 'green',
  // Warning-ish
  late: 'yellow',
  pending: 'yellow',
  'pending hr review': 'yellow',
  'pending hr': 'yellow',
  processing: 'yellow',
  'expiring soon': 'yellow',
  draft: 'yellow',
  'in progress': 'yellow',
  review: 'yellow',
  scheduled: 'blue',
  'partially published': 'yellow',
  'under review': 'yellow',
  // Danger
  absent: 'red',
  rejected: 'red',
  suspended: 'red',
  terminated: 'red',
  overdue: 'red',
  missingcheckout: 'red',
  'missing checkout': 'red',
  expired: 'red',
  banned: 'red',
  cancelled: 'red',
  // Neutral / info
  'on leave': 'orange',
  'notice period': 'orange',
  'early checkout': 'orange',
  off: 'gray',
  inactive: 'gray',
  disabled: 'gray',
  archived: 'gray',
  'day off': 'blue',
  open: 'blue',
  'off day': 'blue',
  // Evaluation results + server enum names (deal with .ToString() payloads)
  exceeds: 'green',
  meets: 'blue',
  below: 'red',
  onleave: 'orange',
  noticeperiod: 'orange',
}

function normalize(status: string): string {
  return status.trim().toLowerCase()
}

/** Maps a business status string to the mock's badge color vocabulary. */
export function statusColor(status: string): BadgeColor {
  return STATUS_COLORS[normalize(status)] ?? 'gray'
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const color = statusColor(status)
  return (
    <span className={cn('badge', `badge-${color}`, className)}>
      {normalize(status) === 'missingcheckout' ? 'Missing Checkout' : status}
    </span>
  )
}
