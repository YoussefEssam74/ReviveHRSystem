import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'
import { Card } from '../../../components/ui/card'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingState } from '../../../components/async-state'
import { useMe } from '../../../contexts/MeContext'
import { AdminSubscriptionsView } from '../components/AdminSubscriptionsView'
import { GymSubscriptionView } from '../components/GymSubscriptionView'

/**
 * Subscription billing route. Revive Admin gets the platform-wide console; a
 * gym's Branch Manager / Super Admin gets the self-service view for the active
 * gym. Every other role is denied.
 */
export default function SubscriptionsPage() {
  const { t } = useTranslation()
  const { me, isLoading } = useMe()

  if (isLoading) {
    return <LoadingState label={t('Checking your access…')} />
  }

  if (me?.userType === 'TopManagement') {
    return <AdminSubscriptionsView />
  }

  if (me?.roleInActiveGym === 'Branch Manager' || me?.roleInActiveGym === 'Super Admin') {
    return <GymSubscriptionView />
  }

  return (
    <Card>
      <EmptyState
        icon={Lock}
        title={t("You don't have access to subscription billing")}
        message={t('Only Revive Admin or the gym management can view subscription details.')}
      />
    </Card>
  )
}
