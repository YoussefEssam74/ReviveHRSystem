import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react'
import { apiChangePassword } from '../api/settings.api'
import { Modal } from '../../../components/ui/modal'
import { Button } from '../../../components/ui/button'
import { useToast } from '../../../components/ui/toast'
import { useAuthSession } from '../../../contexts/AuthSessionContext'
import { describeApiError } from '../../../lib/api-client'

export default function SettingsPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const { session, signOut } = useAuthSession()
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)

  return (
    <div className="max-w-xl space-y-1.5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-charcoal-900">{t('Settings')}</h1>
        <p className="mt-0.5 text-[11px] text-charcoal-500">{t('Manage your account and preferences')}</p>
      </div>

      {/* Account */}
      <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
        <div className="border-b border-charcoal-100 bg-charcoal-50/50 px-3 py-1.5">
          <p className="bento-label">{t('ACCOUNT')}</p>
          <p className="mt-0.5 text-[10px] text-charcoal-500">{session?.user.email ?? ''}</p>
        </div>
        <div className="space-y-0.5 p-2">
          <button
            type="button"
            onClick={() => setPasswordOpen(true)}
            className="flex w-full items-center justify-between rounded-lg p-1.5 text-xs transition-colors hover:bg-charcoal-50"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-charcoal-100">
                <KeyRound className="h-4 w-4 text-charcoal-600" aria-hidden="true" />
              </span>
              <span className="text-start font-medium text-charcoal-900">{t('Change Password')}</span>
            </span>
            <ShieldCheck className="h-4 w-4 text-charcoal-400" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            className="flex w-full items-center justify-between rounded-lg p-1.5 text-xs transition-colors hover:bg-red-50"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                <LogOut className="h-4 w-4 text-red-500" aria-hidden="true" />
              </span>
              <span className="font-medium text-red-600">{t('Sign out')}</span>
            </span>
          </button>
        </div>
      </div>

      {passwordOpen && (
        <ChangePasswordModal
          onDone={async () => {
            toast(t('Password changed'))
            setPasswordOpen(false)
          }}
          onClose={() => setPasswordOpen(false)}
        />
      )}

      {/* Confirm the sign-out like the header does, then land on login. */}
      {logoutOpen && (
        <Modal
          open
          title={t('Sign out?')}
          onClose={() => setLogoutOpen(false)}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setLogoutOpen(false)}>
                {t('Cancel')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  signOut()
                  navigate('/login', { replace: true })
                }}
              >
                {t('Sign out')}
              </Button>
            </>
          }
        >
          <p className="text-xs text-charcoal-600">{t('You will need to sign in again to use the portal.')}</p>
        </Modal>
      )}
    </div>
  )
}

/* ==================== Change password (mock openChangePassword) ==================== */

function ChangePasswordModal({ onDone, onClose }: { onDone: () => Promise<void>; onClose: () => void }) {
  const { t } = useTranslation()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => apiChangePassword({ currentPassword, newPassword }),
    onSuccess: async () => {
      await onDone()
    },
    onError: (caught) => setError(describeApiError(caught)),
  })

  return (
    <Modal
      open
      title={t('Change Password')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={mutation.isPending}>
            {t('Cancel')}
          </Button>
          <Button
            size="sm"
            loading={mutation.isPending}
            onClick={() => {
              setError(null)
              if (!currentPassword || !newPassword) {
                setError(t('Fill in both fields.'))
                return
              }
              mutation.mutate()
            }}
          >
            {t('Save')}
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          setError(null)
          if (!currentPassword || !newPassword) {
            setError(t('Fill in both fields.'))
            return
          }
          mutation.mutate()
        }}
      >
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" aria-hidden="true" />
          <p className="text-xs text-blue-800">
            {t('Password must be at least 8 characters with uppercase, lowercase, and numbers.')}
          </p>
        </div>
        <div>
          <label htmlFor="pw-current" className="form-label">
            {t('Current Password')}
          </label>
          <input
            id="pw-current"
            type="password"
            className="form-input"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="pw-new" className="form-label">
            {t('New Password')}
          </label>
          <input
            id="pw-new"
            type="password"
            className="form-input"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
