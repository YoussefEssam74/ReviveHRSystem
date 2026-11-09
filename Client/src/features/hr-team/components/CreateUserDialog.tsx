import { useState } from 'react'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { describeApiError } from '../../../lib/api-client'
import { useCreateUser, useRoles, useTeamGyms } from '../hooks/useHrTeam'
import type { CreateUserBody } from '../api/hr-team.api'

interface CreateUserDialogProps {
  open: boolean
  onClose: () => void
}

/** POST /api/users — name + email + gym access + optional role preset (team.manage). */
export function CreateUserDialog({ open, onClose }: CreateUserDialogProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [gymIds, setGymIds] = useState<number[]>([])
  const [rolePreset, setRolePreset] = useState('')
  const [error, setError] = useState<string | null>(null)

  const gyms = useTeamGyms(open)
  const roles = useRoles({ pageSize: 100 }, open)
  const create = useCreateUser()

  const valid = fullName.trim().length > 0 && email.trim().length > 0 && gymIds.length > 0

  const toggleGym = (id: number) =>
    setGymIds((current) => (current.includes(id) ? current.filter((gymId) => gymId !== id) : [...current, id]))

  const onSubmit = async () => {
    if (!valid) return
    setError(null)
    const body: CreateUserBody = {
      fullName: fullName.trim(),
      email: email.trim(),
      gymIds,
    }
    if (rolePreset) body.rolePreset = rolePreset
    try {
      await create.mutateAsync(body)
      onClose()
    } catch (err) {
      setError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add team member"
      description="Create an HR account with gym access and an optional role."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={create.isPending} disabled={!valid}>
            Create member
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
          <Label htmlFor="member-name">Full name</Label>
          <Input
            id="member-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Mona Hassan"
            autoComplete="off"
          />
        </div>

        <div>
          <Label htmlFor="member-email">Email</Label>
          <Input
            id="member-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="mona@revivegyms.com"
            autoComplete="off"
          />
        </div>

        <div>
          <Label>Gym access (at least one)</Label>
          {gyms.isLoading ? (
            <p className="mt-1 text-sm text-slate-500">Loading gyms…</p>
          ) : gyms.error ? (
            <p className="mt-1 text-sm text-red-600">{describeApiError(gyms.error)}</p>
          ) : (
            <ul className="mt-1 grid max-h-40 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
              {(gyms.data ?? []).map((gym) => (
                <li key={gym.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={gymIds.includes(gym.id)}
                      onChange={() => toggleGym(gym.id)}
                      className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                    />
                    <span className="truncate">{gym.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-slate-400">{gym.branch}</span>
                  </label>
                </li>
              ))}
              {(gyms.data ?? []).length === 0 && (
                <li className="px-2 py-1.5 text-sm text-slate-500">No gyms available for your account.</li>
              )}
            </ul>
          )}
          {gymIds.length === 0 && <p className="mt-1 text-xs text-amber-600">Select at least one gym.</p>}
        </div>

        <div>
          <Label htmlFor="member-role">Role (optional)</Label>
          <Select id="member-role" value={rolePreset} onChange={(e) => setRolePreset(e.target.value)}>
            <option value="">No role — custom permissions</option>
            {(roles.data?.items ?? []).map((role) => (
              <option key={role.id} value={role.name}>
                {role.name}
              </option>
            ))}
          </Select>
        </div>

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          A temporary password is configured automatically for the new account and is never displayed in the console.
        </p>
      </div>
    </Dialog>
  )
}
