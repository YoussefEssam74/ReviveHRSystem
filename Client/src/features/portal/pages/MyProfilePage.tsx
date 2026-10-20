import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Lock, MapPin, Pencil } from 'lucide-react'
import {
  downloadProfilePhoto,
  getOwnProfile,
  updateContact,
  uploadProfilePhoto,
} from '../api/employee-file.api'
import { Modal } from '../../../components/ui/modal'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/primitives'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { useToast } from '../../../components/ui/toast'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { formatDate } from '../../../lib/format'

function initialsOf(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

/** The avatar endpoint needs the bearer header, so its blob is fetched and localized. */
function useAvatarUrl(employeeId: number | null, enabled: boolean, epoch: number): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!employeeId || !enabled) return undefined
    let revoked = false
    let current: string | null = null
    downloadProfilePhoto(employeeId)
      .then(({ blob }) => {
        current = URL.createObjectURL(blob)
        if (revoked) URL.revokeObjectURL(current)
        else setUrl(current)
      })
      .catch(() => {
        // No stored photo (404) — keep the initials fallback.
      })
    return () => {
      revoked = true
      if (current) URL.revokeObjectURL(current)
    }
  }, [employeeId, enabled, epoch])

  return url
}

export default function MyProfilePage() {
  const { me } = usePortalSession()
  const employeeId = me?.employeeId ?? null
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [contactOpen, setContactOpen] = useState(false)
  const [photoEpoch, setPhotoEpoch] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const profileQuery = useQuery({
    queryKey: ['portal', 'profile', employeeId],
    queryFn: ({ signal }) => getOwnProfile(employeeId!, signal),
    enabled: employeeId != null,
  })

  const invalidateProfile = () => queryClient.invalidateQueries({ queryKey: ['portal', 'profile'] })

  const photoMutation = useMutation({
    mutationFn: (file: File) => uploadProfilePhoto(employeeId!, file),
    onSuccess: async () => {
      toast('Profile photo updated')
      setPhotoEpoch((epoch) => epoch + 1)
      await invalidateProfile()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  const avatarUrl = useAvatarUrl(employeeId, (profileQuery.data?.photoUrl ?? null) != null, photoEpoch)

  if (employeeId == null) {
    return (
      <EmptyState
        title="No employee profile"
        hint="This account is not linked to an employee profile."
      />
    )
  }
  if (profileQuery.isLoading) return <LoadingState label="Loading your profile…" />
  if (profileQuery.isError) {
    return <ErrorState message={describeApiError(profileQuery.error)} onRetry={() => profileQuery.refetch()} />
  }

  const profile = profileQuery.data
  const contact = { phone: profile?.phone ?? '', address: profile?.address ?? '' }

  return (
    <div className="space-y-2">
      {/* Profile header card */}
      <div className="flex flex-col items-center gap-3 rounded-xl border border-charcoal-200 bg-white p-3 sm:flex-row sm:items-start">
        <div className="relative h-20 w-20 shrink-0">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-brand-100 text-2xl font-bold text-brand-700 shadow-sm">
            {avatarUrl ? (
              <img src={avatarUrl} alt={profile?.fullName ?? ''} className="h-full w-full object-cover" />
            ) : (
              <span>{initialsOf(profile?.fullName ?? '')}</span>
            )}
          </div>
          <button
            type="button"
            aria-label="Upload profile photo"
            onClick={() => fileRef.current?.click()}
            disabled={photoMutation.isPending}
            className="absolute bottom-0 right-0 rounded-full border border-charcoal-200 bg-white p-1.5 text-charcoal-500 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-600"
          >
            <Camera className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) photoMutation.mutate(file)
              event.target.value = ''
            }}
          />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-bold text-charcoal-900">{profile?.fullName}</h2>
              <p className="mt-0.5 text-xs text-charcoal-500">
                {profile?.position} · {profile?.gym.name} {profile?.gym.branch}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 sm:justify-end">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-[10px] font-semibold text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                {profile?.status}
              </span>
              <span className="rounded-full border border-charcoal-200 px-2 py-0.5 text-[10px] text-charcoal-500">
                EMP-{String(profile?.id ?? 0).padStart(4, '0')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
        {/* Editable info */}
        <div className="space-y-2 lg:col-span-2">
          <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
            <div className="flex items-center justify-between border-b border-charcoal-100 bg-charcoal-50/50 px-3 py-2">
              <div>
                <p className="bento-label">PROFILE DETAILS</p>
                <h3 className="mt-0.5 text-sm font-bold text-charcoal-900">Personal Info</h3>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-charcoal-400">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Read-only
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
              <InfoField label="Full Name" value={profile?.fullName} />
              <InfoField label="Date of Birth" value={profile?.dateOfBirth ? formatDate(profile.dateOfBirth) : null} />
              <InfoField label="National ID" value={profile?.nationalId} />
              <InfoField label="Gender" value={profile?.gender} />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
            <div className="flex items-center justify-between border-b border-charcoal-100 bg-charcoal-50/50 px-3 py-2">
              <div>
                <p className="bento-label">COMMUNICATION</p>
                <h3 className="mt-0.5 text-sm font-bold text-charcoal-900">Contact Info</h3>
              </div>
              <button
                type="button"
                onClick={() => setContactOpen(true)}
                className="flex items-center gap-1 text-[10px] font-semibold text-brand-600 hover:text-brand-700"
              >
                <Pencil className="h-3 w-3" aria-hidden="true" />
                Edit
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
              <InfoField label="Mobile Number" value={profile?.phone} />
              <InfoField label="Email (work)" value={profile?.email} />
              <div className="sm:col-span-2">
                <InfoField label="Residential Address" value={profile?.address} />
              </div>
            </div>
          </div>
        </div>

        {/* HR-controlled */}
        <div className="relative overflow-hidden rounded-xl border border-charcoal-200 bg-charcoal-50">
          <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)] opacity-[0.03] pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between border-b border-charcoal-200 bg-charcoal-100/50 px-3 py-2">
            <div>
              <p className="bento-label flex items-center gap-1 text-charcoal-600">
                <Lock className="h-3 w-3" aria-hidden="true" />
                HR CONTROLLED
              </p>
              <h3 className="mt-0.5 text-sm font-bold text-charcoal-900">Employment Info</h3>
            </div>
          </div>
          <div className="relative z-10 space-y-2 p-3">
            <div className="flex items-end justify-between border-b border-charcoal-200 pb-2">
              <div>
                <p className="bento-label text-charcoal-500">Employee ID</p>
                <p className="mt-0.5 text-xs font-semibold text-charcoal-900">
                  EMP-{String(profile?.id ?? 0).padStart(4, '0')}
                </p>
              </div>
            </div>
            <div className="flex items-end justify-between border-b border-charcoal-200 pb-2">
              <div>
                <p className="bento-label text-charcoal-500">Primary Location</p>
                <p className="mt-0.5 text-xs font-semibold text-charcoal-900">
                  {profile?.gym.name} {profile?.gym.branch}
                </p>
              </div>
              <MapPin className="h-3.5 w-3.5 text-charcoal-400" aria-hidden="true" />
            </div>
            <div className="flex items-end justify-between border-b border-charcoal-200 pb-2">
              <div>
                <p className="bento-label text-charcoal-500">Job Title / Position</p>
                <p className="mt-0.5 text-xs font-semibold text-charcoal-900">{profile?.position}</p>
              </div>
            </div>
            <div className="flex items-end justify-between border-b border-charcoal-200 pb-2">
              <div>
                <p className="bento-label text-charcoal-500">Hire Date</p>
                <p className="mt-0.5 text-xs font-semibold text-charcoal-900">
                  {profile?.hireDate ? formatDate(profile.hireDate) : '—'}
                </p>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="bento-label text-charcoal-500">Current Status</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-charcoal-900">
                  <span className="h-2 w-2 rounded-full bg-brand-500" />
                  {profile?.status} {profile?.employmentType}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Editable contact modal (phone + address; email is HR-controlled) */}
      {contactOpen && profile && (
        <ContactEditModal
          title="Edit Contact Information"
          initial={{ phone: contact.phone, address: contact.address }}
          save={async (fields) => {
            await updateContact(employeeId, {
              phone: fields.phone.trim() || null,
              address: fields.address?.trim() || null,
            })
          }}
          onSaved={async () => {
            toast('Contact information updated')
            await invalidateProfile()
            setContactOpen(false)
          }}
          onClose={() => setContactOpen(false)}
        />
      )}
    </div>
  )
}

export interface EditableContactState {
  phone: string
  address?: string
  name?: string
  relationship?: string
}

/** Shared editable-fields modal used by Contact Info and Emergency Contact. */
export function ContactEditModal({
  title,
  initial,
  save,
  onSaved,
  onClose,
}: {
  title: string
  initial: EditableContactState
  save: (fields: EditableContactState) => Promise<void>
  onSaved: () => Promise<void> | void
  onClose: () => void
}) {
  const [state, setState] = useState<EditableContactState>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEmergency = initial.name !== undefined

  function field(key: keyof EditableContactState, label: string, options: { required?: boolean; tel?: boolean } = {}) {
    return (
      <div>
        <label htmlFor={`edit-${key}`} className="form-label">
          {label}
        </label>
        <input
          id={`edit-${key}`}
          type={options.tel ? 'tel' : 'text'}
          className="form-input"
          required={options.required}
          value={state[key] ?? ''}
          onChange={(event) => setState((current) => ({ ...current, [key]: event.target.value }))}
        />
      </div>
    )
  }

  return (
    <Modal open title={title} onClose={onClose} footer={
      <>
        <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          size="sm"
          loading={saving}
          onClick={async () => {
            setError(null)
            setSaving(true)
            try {
              await save(state)
              await onSaved()
            } catch (caught) {
              setError(describeApiError(caught))
            } finally {
              setSaving(false)
            }
          }}
        >
          Save
        </Button>
      </>
    }
    >
      <div className="space-y-3">
        {isEmergency && field('name', 'Name', { required: true })}
        {isEmergency && field('relationship', 'Relationship', { required: true })}
        {field('phone', 'Phone', { required: true, tel: true })}
        {!isEmergency && field('address', 'Address')}
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <label className="bento-label text-charcoal-500">{label}</label>
      <p className="mt-0.5 text-xs text-charcoal-900">{value || '—'}</p>
    </div>
  )
}
