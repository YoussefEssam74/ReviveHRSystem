import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Modal } from '../../../components/ui/modal'
import { Select } from '../../../components/ui/select'
import { useToast } from '../../../components/ui/toast'
import { describeApiError } from '../../../lib/api-client'
import { fileToImageDataUrl, MAX_IMAGE_SOURCE_BYTES } from '../../../lib/image-data-url'
import { getRoles } from '../../hr-team/api/hr-team.api'
import { useCreateHrManager } from '../hooks/usePlatform'

const DEFAULT_PASSWORD = 'Revive!2026'
const GENDERS = ['Female', 'Male']

/** Random system password that satisfies the server's 8-character minimum. */
function generatePassword(): string {
  const digits = Math.floor(1000 + Math.random() * 9000)
  const symbols = ['!', '@', '#', '$', '%', '&']
  return `Revive${symbols[Math.floor(Math.random() * symbols.length)]}${digits}`
}

function Field({
  id,
  label,
  required,
  hint,
  children,
}: {
  id: string
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <label className="mb-1 block text-xs font-semibold text-charcoal-700" htmlFor={id}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10px] leading-relaxed text-charcoal-500">{hint}</p>}
    </div>
  )
}

/**
 * Create a platform HR Manager: the same personal details the HR console's employee
 * wizard collects, plus the system role the account signs in with. Everything fits on
 * one page — no steps and no internal scrolling.
 */
export function CreateHrManagerModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const createManager = useCreateHrManager()

  // Role catalogue: the platform role the account is bound to.
  const roles = useQuery({
    queryKey: ['platform', 'hr-manager-roles'],
    queryFn: ({ signal }) => getRoles({ page: 1, pageSize: 100 }, signal),
    enabled: open,
    retry: false,
  })
  const roleOptions = (roles.data?.items ?? []).filter((role) => role.status === 'Active')
  const defaultRole = roleOptions.find((role) => role.name.toLowerCase() === 'hr manager') ?? roleOptions[0]

  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [hireDate, setHireDate] = useState(today)
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(DEFAULT_PASSWORD)
  const [roleId, setRoleId] = useState('')
  const [sendInvite, setSendInvite] = useState(true)

  const reset = () => {
    setPhotoDataUrl(null)
    setPhotoBusy(false)
    setFullName('')
    setPhone('')
    setHireDate(today)
    setDateOfBirth('')
    setGender('')
    setNationalId('')
    setEmail('')
    setPassword(DEFAULT_PASSWORD)
    setRoleId('')
    setSendInvite(true)
  }

  const close = () => {
    reset()
    onClose()
  }

  const ready = fullName.trim().length > 1 && email.includes('@') && password.trim().length >= 8

  const onPhotoPicked = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast(t('Choose an image file for the profile photo.'), 'error')
      return
    }
    if (file.size > MAX_IMAGE_SOURCE_BYTES) {
      toast(t('The photo must be smaller than 10 MB.'), 'error')
      return
    }

    setPhotoBusy(true)
    try {
      setPhotoDataUrl(await fileToImageDataUrl(file, 256))
    } catch {
      toast(t('That image could not be read. Try a PNG or JPG.'), 'error')
    } finally {
      setPhotoBusy(false)
    }
  }

  const submit = () => {
    if (!ready) return
    const selectedRoleId = roleId || (defaultRole ? String(defaultRole.id) : '')
    createManager.mutate(
      {
        fullName: fullName.trim(),
        email: email.trim(),
        password: password.trim(),
        phone: phone.trim() || null,
        dateOfBirth: dateOfBirth || null,
        gender: gender || null,
        nationalId: nationalId.trim() || null,
        hireDate: hireDate || null,
        photoUrl: photoDataUrl,
        presetRoleId: selectedRoleId ? Number(selectedRoleId) : null,
        sendInvite,
      },
      {
        onSuccess: () => {
          toast(
            sendInvite
              ? t('{{email}} can now reach every gym account.', { email: email.trim() })
              : t('{{email}} was created without an activation invite.', { email: email.trim() }),
            'success',
          )
          onCreated?.()
          close()
        },
        onError: (error) => toast(describeApiError(error), 'error'),
      },
    )
  }

  return (
    <Modal
      open={open}
      title={t('Create HR manager account')}
      subtitle={t('Personal details, sign-in credentials and the system role the account uses.')}
      width="wide"
      onClose={close}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={close}>
            {t('Cancel')}
          </Button>
          <Button size="sm" onClick={submit} loading={createManager.isPending} disabled={!ready}>
            {t('Create account')}
          </Button>
        </>
      }
    >
      <form
        className="space-y-3 text-xs"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <div className="space-y-3 rounded-xl border border-charcoal-200 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-charcoal-200 bg-white">
              {photoDataUrl ? (
                <img src={photoDataUrl} alt={t('Profile picture preview')} className="h-full w-full object-cover" />
              ) : photoBusy ? (
                <Loader2 className="h-4 w-4 animate-spin text-charcoal-300" aria-hidden="true" />
              ) : (
                <Camera className="h-5 w-5 text-charcoal-300" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-charcoal-700">
                {t('Personal information')}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <input
                  ref={photoInputRef}
                  id="hm-photo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={(event) => {
                    void onPhotoPicked(event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="rounded-lg border border-charcoal-300 bg-white px-2.5 py-1 text-[11px] font-medium text-charcoal-700 hover:bg-charcoal-100/60"
                >
                  {photoDataUrl ? t('Change photo') : t('Upload photo')}
                </button>
                {photoDataUrl && (
                  <button
                    type="button"
                    onClick={() => setPhotoDataUrl(null)}
                    className="inline-flex items-center gap-1 rounded-lg border border-charcoal-300 bg-white px-2.5 py-1 text-[11px] font-medium text-charcoal-700 hover:bg-charcoal-100/60"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                    {t('Remove')}
                  </button>
                )}
              </div>
            </div>
            <span className="hidden flex-shrink-0 font-mono text-[10px] text-charcoal-500 sm:block">
              {t('Account ID: generated automatically')}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="hm-name" label={t('Full Name')} required>
              <Input
                id="hm-name"
                className="h-8 text-xs"
                placeholder={t('e.g. Mariam Adel')}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </Field>
            <Field id="hm-phone" label={t('Phone')}>
              <Input
                id="hm-phone"
                type="tel"
                className="h-8 text-xs"
                placeholder="+20 1XX XXX XXXX"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="hm-hire" label={t('Hire Date')} required>
              <Input
                id="hm-hire"
                type="date"
                className="h-8 text-xs"
                value={hireDate}
                onChange={(event) => setHireDate(event.target.value)}
              />
            </Field>
            <Field id="hm-dob" label={t('Date of Birth')}>
              <Input
                id="hm-dob"
                type="date"
                className="h-8 text-xs"
                max={today}
                value={dateOfBirth}
                onChange={(event) => setDateOfBirth(event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="hm-gender" label={t('Gender')}>
              <Select
                id="hm-gender"
                className="h-8 text-xs"
                value={gender}
                onChange={(event) => setGender(event.target.value)}
              >
                <option value="">{t('Not specified')}</option>
                {GENDERS.map((option) => (
                  <option key={option} value={option}>
                    {t(option)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="hm-national-id" label={t('National ID')}>
              <Input
                id="hm-national-id"
                inputMode="numeric"
                maxLength={20}
                className="h-8 text-xs"
                placeholder={t('14 digits')}
                value={nationalId}
                onChange={(event) => setNationalId(event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="hm-email" label={t('Work Email')} required>
              <Input
                id="hm-email"
                type="email"
                className="h-8 text-xs"
                placeholder="name@revive.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field id="hm-role" label={t('System role')} hint={t('The role the account signs in with.')}>
              <Select
                id="hm-role"
                className="h-8 text-xs"
                value={roleId || (defaultRole ? String(defaultRole.id) : '')}
                onChange={(event) => setRoleId(event.target.value)}
              >
                {roleOptions.length === 0 && <option value="">{t('HR Manager')}</option>}
                {roleOptions.map((role) => (
                  <option key={role.id} value={String(role.id)}>
                    {role.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id="hm-pass"
              label={t('Initial Password')}
              required
              hint={t('The manager signs in with this password and can change it later.')}
            >
              <div className="flex items-center gap-1.5">
                <Input
                  id="hm-pass"
                  className="h-8 flex-1 font-mono text-xs"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 px-2 text-[11px]"
                  onClick={() => setPassword(generatePassword())}
                >
                  {t('Generate')}
                </Button>
              </div>
            </Field>
            <div className="flex items-end pb-1">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 h-3.5 w-3.5 rounded border-charcoal-300 accent-brand-600"
                  checked={sendInvite}
                  onChange={(event) => setSendInvite(event.target.checked)}
                />
                <span className="min-w-0">
                  <span className="block text-[11px] text-charcoal-700">{t('Send an activation invite')}</span>
                  <span className="block text-[9px] text-charcoal-400">
                    {t('The account reaches every gym account as soon as it is activated.')}
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>

        <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
      </form>
    </Modal>
  )
}
