import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ShieldCheck } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Modal } from '../../../components/ui/modal'
import { useToast } from '../../../components/ui/toast'
import { describeApiError } from '../../../lib/api-client'
import { useCreateRole, usePermissionCatalog } from '../../hr-team/hooks/useHrTeam'

export function CreateRoleModal({
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
  const catalog = usePermissionCatalog(open)
  const createRole = useCreateRole()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    if (createRole.isPending) return
    setName('')
    setDescription('')
    setSelected([])
    setError(null)
    onClose()
  }

  const togglePermission = (key: string) => {
    setSelected((current) =>
      current.includes(key) ? current.filter((permission) => permission !== key) : [...current, key],
    )
  }

  const allKeys = catalog.data?.items.map((item) => item.key) ?? []
  const allSelected = allKeys.length > 0 && selected.length === allKeys.length
  const descriptions = new Map<string, string | null>(
    (catalog.data?.items ?? []).map((item) => [item.key, item.description]),
  )

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) return
    setError(null)

    createRole.mutate(
      { name: cleanName, description: description.trim() || null, permissions: selected },
      {
        onSuccess: () => {
          toast(t('Role created with {{count}} permission(s).', { count: selected.length }), 'success')
          setName('')
          setDescription('')
          setSelected([])
          onCreated?.()
          onClose()
        },
        onError: (saveError) => setError(describeApiError(saveError)),
      },
    )
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('Create role')}
      subtitle={t('Name the role, then choose what its members can access.')}
      width="wide"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={close} disabled={createRole.isPending}>
            {t('Cancel')}
          </Button>
          <Button
            type="submit"
            form="create-platform-role-form"
            size="sm"
            loading={createRole.isPending}
            disabled={!name.trim() || catalog.isPending || catalog.isError}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Create role')}
          </Button>
        </>
      }
    >
      <form id="create-platform-role-form" className="space-y-3" onSubmit={submit}>
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="block">
            <span className="pc-label">{t('Role name')}</span>
            <input
              autoFocus
              className="pc-control w-full"
              maxLength={80}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('e.g. Operations Coordinator')}
            />
          </label>
          <label className="block">
            <span className="pc-label">{t('Description')}</span>
            <input
              className="pc-control w-full"
              maxLength={240}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('What this role is responsible for')}
            />
          </label>
        </div>

        <section aria-labelledby="role-permissions-title" className="overflow-hidden rounded-xl border border-charcoal-200">
          <div className="flex flex-wrap items-center gap-2 border-b border-charcoal-200 px-3 py-2">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
            <h3 id="role-permissions-title" className="min-w-0 flex-1 text-[11px] font-semibold text-charcoal-800">
              {t('Permissions and access')}
              <span className="ms-1.5 font-normal text-charcoal-500">
                {t('{{selected}} selected', { selected: selected.length })}
              </span>
            </h3>
            <Button
              variant="outline"
              size="sm"
              disabled={catalog.isPending || allKeys.length === 0}
              onClick={() => setSelected(allSelected ? [] : allKeys)}
            >
              {allSelected ? t('Clear all') : t('Select all')}
            </Button>
          </div>

          {catalog.isPending ? (
            <p className="px-3 py-6 text-center text-xs text-charcoal-500">{t('Loading permission catalog...')}</p>
          ) : catalog.isError ? (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-4">
              <p role="alert" className="text-xs text-red-700">{describeApiError(catalog.error)}</p>
              <Button variant="outline" size="sm" onClick={() => void catalog.refetch()}>
                {t('Retry')}
              </Button>
            </div>
          ) : (
            <div className="max-h-[46vh] space-y-3 overflow-y-auto p-3">
              {catalog.data.modules.map((module) => {
                const moduleSelected = module.permissions.every((key) => selected.includes(key))
                return (
                  <section key={module.name}>
                    <div className="mb-1 flex items-center justify-between gap-2 border-b border-charcoal-100 pb-1">
                      <h4 className="text-[10px] font-bold uppercase tracking-wide text-charcoal-500">{module.name}</h4>
                      <button
                        type="button"
                        aria-label={
                          moduleSelected
                            ? t('Clear permissions for {{module}}', { module: module.name })
                            : t('Select permissions for {{module}}', { module: module.name })
                        }
                        className="text-[9px] font-semibold text-brand-700 hover:underline"
                        onClick={() => {
                          setSelected((current) => {
                            const withoutModule = current.filter((key) => !module.permissions.includes(key))
                            return moduleSelected ? withoutModule : [...withoutModule, ...module.permissions]
                          })
                        }}
                      >
                        {moduleSelected ? t('Clear section') : t('Select section')}
                      </button>
                    </div>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {module.permissions.map((key) => {
                        const description = descriptions.get(key)
                        return (
                          <label
                            key={key}
                            className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-charcoal-50"
                          >
                            <input
                              type="checkbox"
                              checked={selected.includes(key)}
                              onChange={() => togglePermission(key)}
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand-600"
                            />
                            <span className="min-w-0">
                              <span className="block break-all text-[10px] font-semibold text-charcoal-800">{key}</span>
                              {description && (
                                <span className="block text-[9px] leading-relaxed text-charcoal-500">
                                  {description}
                                </span>
                              )}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </section>
      </form>
    </Modal>
  )
}
