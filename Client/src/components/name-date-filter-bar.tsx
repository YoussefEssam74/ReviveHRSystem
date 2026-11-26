import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { NO_NAME_DATE_FILTER, isFilterActive, type NameDateFilter } from '../lib/name-date-filter'
import { Input } from './ui/input'

export interface NameDateFilterBarProps {
  filter: NameDateFilter
  onChange: (next: NameDateFilter) => void
  /** Placeholder of the name search, e.g. "Search by candidate name…". */
  placeholder: string
  shown: number
  total: number
}

/** Name search plus From/To day window — one bar per list tab. */
export function NameDateFilterBar({ filter, onChange, placeholder, shown, total }: NameDateFilterBarProps) {
  const { t } = useTranslation()
  const active = isFilterActive(filter)
  const update = (patch: Partial<NameDateFilter>) => onChange({ ...filter, ...patch })

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-charcoal-200 bg-white p-2">
      <div className="relative min-w-[180px] flex-1">
        <Search
          className="pointer-events-none absolute inset-y-0 start-2 my-auto h-3.5 w-3.5 text-charcoal-400"
          aria-hidden="true"
        />
        <Input
          value={filter.name}
          onChange={(event) => update({ name: event.target.value })}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-8 ps-7 text-xs"
        />
      </div>
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-charcoal-500">
        {t('From')}
        <Input
          type="date"
          value={filter.from}
          onChange={(event) => update({ from: event.target.value })}
          aria-label={t('From date')}
          className="h-8 w-[132px] text-xs"
        />
      </label>
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-charcoal-500">
        {t('To')}
        <Input
          type="date"
          value={filter.to}
          onChange={(event) => update({ to: event.target.value })}
          aria-label={t('To date')}
          className="h-8 w-[132px] text-xs"
        />
      </label>
      {active && (
        <button
          type="button"
          onClick={() => onChange(NO_NAME_DATE_FILTER)}
          className="btn btn-sm btn-ghost text-[10px]"
        >
          {t('Clear filters')}
        </button>
      )}
      <span className="ms-auto text-[10px] text-charcoal-400">{t('{{shown}} of {{total}}', { shown, total })}</span>
    </div>
  )
}
