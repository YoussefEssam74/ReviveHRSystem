import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { Card } from '../../../components/ui/card'
import { Tabs } from '../../../components/ui/tabs'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingState } from '../../../components/async-state'
import { useMe } from '../../../contexts/MeContext'
import { useUserAccessProfile } from '../hooks/useHrTeam'
import { MembersTab } from '../components/MembersTab'
import { RolesTab } from '../components/RolesTab'
import { PermissionsTab } from '../components/PermissionsTab'

type TeamTab = 'members' | 'roles' | 'permissions'

const TABS: { value: TeamTab; label: string }[] = [
  { value: 'members', label: 'Members' },
  { value: 'roles', label: 'Roles' },
  { value: 'permissions', label: 'Permissions' },
]

/**
 * HR Team (S2) — members, roles, and the permission catalog in one page.
 *
 * team.view / team.manage are permission-key catalog entries (they are not part
 * of the featureLevels map served by /api/me), so the UX gate is derived from the
 * caller's own access profile (GET /api/users/{id}, own id always allowed) plus
 * the TopManagement bypass. The API re-checks every call server-side.
 */
export default function HrTeamPage() {
  const { t } = useTranslation()
  const { me, isLoading: meLoading } = useMe()
  const [tab, setTab] = useState<TeamTab>('members')

  const access = useUserAccessProfile(me?.userId ?? 0)
  const keys = access.data?.effectivePermissions ?? []
  const isTop = me?.userType === 'TopManagement'

  const canManage = isTop || keys.includes('team.manage') || keys.includes('*')
  // If the access profile itself failed to load we still attempt the reads: the API
  // enforces team.view and answers with a friendly 403 rendered inline.
  const canView = isTop || canManage || keys.includes('team.view') || access.isError
  const loading = me == null ? meLoading : access.isPending

  return (
    <>
      <PageHeader title={t('HR Team')} description={t('Manage team members, roles, and portal permissions')} />

      {loading ? (
        <Card>
          <LoadingState label={t('Checking your access…')} />
        </Card>
      ) : !canView ? (
        <Card>
          <EmptyState
            icon={Lock}
            title={t("You don't have access to the HR Team")}
            message={t('Ask your administrator for the team.view permission to open this page.')}
          />
        </Card>
      ) : (
        <>
          <Tabs items={TABS.map((item) => ({ ...item, label: t(item.label) }))} value={tab} onChange={setTab} className="mb-4 w-fit" />
          {tab === 'members' && <MembersTab canManage={canManage} />}
          {tab === 'roles' && <RolesTab canManage={canManage} />}
          {tab === 'permissions' && <PermissionsTab canManage={canManage} />}
        </>
      )}
    </>
  )
}
