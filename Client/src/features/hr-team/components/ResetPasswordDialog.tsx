import { useState } from 'react'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { describeApiError } from '../../../lib/api-client'
import { useResetUserPassword } from '../hooks/useHrTeam'
import type { TeamMember } from '../api/hr-team.api'

interface ResetPasswordDialogProps {
  member: TeamMember
  onClose: () => void
}

/** POST /api/users/{id}/reset-password — the admin sets a known password (team.manage). */
export function ResetPasswordDialog({ member, onClose }: ResetPasswordDialogProps) {
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const reset = useResetUserPassword(member.id)

  const valid = newPassword.length >= 8

  const onSubmit = async () => {
    if (!valid) return
    setError(null)
    try {
      await reset.mutateAsync(newPassword)
      onClose()
    } catch (err) {
      setError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Reset password — ${member.name}`}
      description={member.email}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={reset.isPending} disabled={!valid}>
            Reset password
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
          <Label htmlFor="reset-password">New password</Label>
          <Input
            id="reset-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
          {newPassword.length > 0 && newPassword.length < 8 && (
            <p className="mt-1 text-xs text-amber-600">Passwords must be at least 8 characters.</p>
          )}
        </div>
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          The new password is written directly to the account and is never displayed or logged in the console — share it
          with the member securely.
        </p>
      </div>
    </Dialog>
  )
}
