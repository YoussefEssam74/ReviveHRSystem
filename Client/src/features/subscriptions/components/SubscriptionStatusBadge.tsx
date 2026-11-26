import { useTranslation } from 'react-i18next'
import { Badge } from '../../../components/ui/badge'
import type { SubscriptionStatus } from '../api/subscriptions.api'

const TONES = {
  Active: 'green',
  GracePeriod: 'yellow',
  Suspended: 'red',
  Cancelled: 'gray',
} as const

const LABELS: Record<SubscriptionStatus, string> = {
  Active: 'Active',
  GracePeriod: 'Grace period',
  Suspended: 'Suspended',
  Cancelled: 'Cancelled',
}

/** Subscription lifecycle pill shared by the table and the detail dialog. */
export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const { t } = useTranslation()
  return <Badge color={TONES[status] ?? 'gray'}>{t(LABELS[status] ?? status)}</Badge>
}
