import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardList,
  ExternalLink,
  KeyRound,
  LogOut,
  Megaphone,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react'
import {
  apiChangePassword,
  getPreferences,
  updatePreferences,
  type NotificationPreference,
} from '../api/settings.api'
import { Modal } from '../../../components/ui/modal'
import { Button } from '../../../components/ui/button'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { useToast } from '../../../components/ui/toast'
import { useAuthSession } from '../../../contexts/AuthSessionContext'
import { PAGE_PATHS } from '../portal-nav'
import { describeApiError } from '../../../lib/api-client'
import { cn } from '../../../lib/utils'

const PREFERENCE_ROWS: ReadonlyArray<{
  key: keyof NotificationPreference
  label: string
  description: string
  Icon: typeof Megaphone
}> = [
  { key: 'requests', label: 'Request Updates', description: 'Status changes to the requests you submit', Icon: ClipboardList },
  { key: 'attendance', label: 'Attendance Alerts', description: 'Late check-ins and absence warnings', Icon: UserCheck },
  { key: 'recruitment', label: 'Recruitment Updates', description: 'Progress of hiring stages you take part in', Icon: Users },
  { key: 'management', label: 'Management Actions', description: 'Approvals, reviews and desk decisions', Icon: UserCheck },
  { key: 'announcements', label: 'Announcements', description: 'Gym-wide HR announcements', Icon: Megaphone },
]

export default function SettingsPage() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const { session, signOut } = useAuthSession()
  const queryClient = useQueryClient()

  const [passwordOpen, setPasswordOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)

  const prefsQuery = useQuery({
    queryKey: ['portal', 'settings'],
    queryFn: ({ signal }) => getPreferences(signal),
  })

  const prefsMutation = useMutation({
    mutationFn: (preferences: NotificationPreference) => updatePreferences(preferences),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['portal', 'settings'], updated)
      toast('Preferences saved')
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  function toggle(key: keyof NotificationPreference, current: boolean) {
    if (!preferences) return
    prefsMutation.mutate({ ...preferences, [key]: !current })
  }

  const preferences = prefsQuery.data ?? null

  return (
    <div className="max-w-xl space-y-1.5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-charcoal-900">Settings</h1>
        <p className="mt-0.5 text-[11px] text-charcoal-500">Manage your account and preferences</p>
      </div>

      {/* Account */}
      <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
        <div className="border-b border-charcoal-100 bg-charcoal-50/50 px-3 py-1.5">
          <p className="bento-label">ACCOUNT</p>
          <p className="mt-0.5 text-[10px] text-charcoal-500">{session?.user.email ?? ''}</p>
        </div>
        <div className="space-y-0.5 p-2">
          <button
            type="button"
            onClick={() => navigate(PAGE_PATHS.documents)}
            className="flex w-full items-center justify-between rounded-lg p-1.5 text-xs transition-colors hover:bg-charcoal-50"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-charcoal-100">
                <ExternalLink className="h-4 w-4 text-charcoal-600" aria-hidden="true" />
              </span>
              <span className="text-left font-medium text-charcoal-900">My Documents</span>
            </span>
            <ExternalLink className="h-4 w-4 text-charcoal-400" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setPasswordOpen(true)}
            className="flex w-full items-center justify-between rounded-lg p-1.5 text-xs transition-colors hover:bg-charcoal-50"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-charcoal-100">
                <KeyRound className="h-4 w-4 text-charcoal-600" aria-hidden="true" />
              </span>
              <span className="text-left font-medium text-charcoal-900">Change Password</span>
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
              <span className="font-medium text-red-600">Sign out</span>
            </span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
        <div className="border-b border-charcoal-100 bg-charcoal-50/50 px-3 py-1.5">
          <p className="bento-label">NOTIFICATIONS</p>
        </div>
        <div className="p-2">
          {prefsQuery.isLoading ? (
            <LoadingState label="Loading preferences…" />
          ) : prefsQuery.isError ? (
            <ErrorState message={describeApiError(prefsQuery.error)} onRetry={() => prefsQuery.refetch()} />
          ) : preferences ? (
            <div className="space-y-0">
              {PREFERENCE_ROWS.map((row, index) => {
                const value = preferences[row.key]
                return (
                  <div
                    key={row.key}
                    className={cn(
                      'flex items-center justify-between py-1.5',
                      index < PREFERENCE_ROWS.length - 1 && 'border-b border-charcoal-50',
                    )}
                  >
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-medium text-charcoal-900">
                        <row.Icon className="h-3.5 w-3.5 text-charcoal-400" aria-hidden="true" />
                        {row.label}
                      </p>
                      <p className="mt-0.5 text-[10px] text-charcoal-500">{row.description}</p>
                    </div>
                    <Toggle checked={value} busy={prefsMutation.isPending} onChange={() => toggle(row.key, value)} />
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>

      {passwordOpen && (
        <ChangePasswordModal
          onDone={async () => {
            toast('Password changed')
            setPasswordOpen(false)
          }}
          onClose={() => setPasswordOpen(false)}
        />
      )}

      {/* Confirm the sign-out like the header does, then land on login. */}
      {logoutOpen && (
        <Modal
          open
          title="Sign out?"
          onClose={() => setLogoutOpen(false)}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setLogoutOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  signOut()
                  navigate('/login', { replace: true })
                }}
              >
                Sign out
              </Button>
            </>
          }
        >
          <p className="text-xs text-charcoal-600">You will need to sign in again to use the portal.</p>
        </Modal>
      )}
    </div>
  )
}

function Toggle({ checked, busy, onChange }: { checked: boolean; busy?: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={busy}
      onClick={onChange}
      aria-label="Toggle notification preference"
      data-on={checked ? '' : undefined}
      className={cn(
        'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors',
        checked ? 'bg-brand-600' : 'bg-charcoal-200',
        'disabled:opacity-60',
      )}
    >
      <span
        className={cn(
          'absolute left-[2px] h-4 w-4 rounded-full bg-white shadow transition-all',
          checked && 'translate-x-4',
        )}
      />
    </button>
  )
}

/* ==================== Change password (mock openChangePassword) ==================== */

function ChangePasswordModal({ onDone, onClose }: { onDone: () => Promise<void>; onClose: () => void }) {
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
      title="Change Password"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={mutation.isPending}
            onClick={() => {
              setError(null)
              if (!currentPassword || !newPassword) {
                setError('Fill in both fields.')
                return
              }
              mutation.mutate()
            }}
          >
            Save
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
            setError('Fill in both fields.')
            return
          }
          mutation.mutate()
        }}
      >
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" aria-hidden="true" />
          <p className="text-xs text-blue-800">
            Password must be at least 8 characters with uppercase, lowercase, and numbers.
          </p>
        </div>
        <div>
          <label htmlFor="pw-current" className="form-label">
            Current Password
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
            New Password
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
