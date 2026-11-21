import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, UserX } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { useEmployeeOptions } from '../hooks/useTerminations'
import type { EmployeeOption } from '../api/terminations.api'

export interface EmployeePickerProps {
  value: EmployeeOption | null
  onChange: (employee: EmployeeOption | null) => void
  inputId: string
}

/** Type-ahead employee picker shared by the termination and offboarding dialogs. */
export function EmployeePicker({ value, onChange, inputId }: EmployeePickerProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const options = useEmployeeOptions(search)

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-charcoal-200 bg-charcoal-50 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-charcoal-900">{value.name}</p>
          <p className="truncate text-xs text-charcoal-500">
            {value.position} · {value.gym}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
          {t('Change')}
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="relative">
        <Search
          className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-400"
          aria-hidden="true"
        />
        <Input
          id={inputId}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('Search by name, email or employee number…')}
          className="ps-9"
        />
      </div>
      {search.trim().length >= 2 && (
        <ul className="mt-2 max-h-48 divide-y divide-charcoal-100 overflow-y-auto rounded-lg border border-charcoal-200">
          {options.isLoading ? (
            <li className="px-3 py-2 text-sm text-charcoal-500">{t('Searching…')}</li>
          ) : (options.data?.items?.length ?? 0) === 0 ? (
            <li className="px-3 py-2 text-sm text-charcoal-500">{t('No matching employees.')}</li>
          ) : (
            options.data!.items.map((employee) => (
              <li key={employee.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(employee)
                    setSearch('')
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-start transition-colors hover:bg-charcoal-50"
                >
                  <UserX className="h-4 w-4 shrink-0 text-charcoal-400" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-charcoal-900">{employee.name}</span>
                    <span className="block truncate text-xs text-charcoal-500">
                      {employee.position} · {employee.gym}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </>
  )
}
