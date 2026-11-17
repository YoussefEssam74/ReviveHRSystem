import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Label } from '../../../components/ui/label'
import { Textarea } from '../../../components/ui/textarea'
import { describeApiError } from '../../../lib/api-client'
import { useChangeUserStatus } from '../hooks/useHrTeam'
import type { TeamMember } from '../api/hr-team.api'

interface UserStatusDialogProps {
  member: TeamMember
  onClose: () => void
}

/** PUT /api/users/{id}/status — suspend/reactivate; the reason is required (team.manage). */
export function UserStatusDialog({ member, onClose }: UserStatusDialogProps) {
  const { t } = useTranslation()
  const suspending = member.status === 'Active'
  const target: 'Active' | 'Suspended' = suspending ? 'Suspended' : 'Active'
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const change = useChangeUserStatus(member.id)

  const valid = reason.trim().length > 0

  const onSubmit = async () => {
    if (!valid) return
    setError(null)
    try {
      await change.mutateAsync({ status: target, reason: reason.trim() })
      onClose()
    } catch (err) {
      setError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={suspending ? t('Suspend {{name}}', { name: member.name }) : t('Reactivate {{name}}', { name: member.name })}
      description={
        suspending
          ? t('The account can no longer sign in until it is reactivated.')
          : t('The account will be able to sign in again.')
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button variant={suspending ? 'danger' : 'primary'} onClick={onSubmit} loading={change.isPending} disabled={!valid}>
            {suspending ? t('Suspend member') : t('Reactivate member')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div>
          <Label htmlFor="status-reason">{t('Reason (required)')}</Label>
          <Textarea
            id="status-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              suspending ? t('Why is this account being suspended?') : t('Why is this account being reactivated?')
            }
          />
        </div>
        <p className="text-xs text-slate-500">
          {t('The change is recorded in the audit log under your name. Suspending your own account is refused by the server.')}
        </p>
      </div>
    </Dialog>
  )
}
