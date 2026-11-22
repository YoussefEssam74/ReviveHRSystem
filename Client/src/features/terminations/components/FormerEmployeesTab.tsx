import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, UserMinus } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { EmptyState } from '../../../components/ui/empty-state'
import { Input } from '../../../components/ui/field'
import { TBody, TD, TH, THead, TR, Table } from '../../../components/ui/table'
import { fullDate } from './termination-ui'
import type { Separation } from '../api/terminations.api'

function rehireVerdict(separation: Separation): boolean | null {
  if (separation.exitInterview?.rehireEligible != null) return separation.exitInterview.rehireEligible
  const status = separation.verdict?.rehire?.status
  if (status == null) return null
  return status === 'Eligible'
}

/** Tab 4 — everyone whose exit interview and clearance are complete. */
export function FormerEmployeesTab({ cases }: { cases: Separation[] }) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return cases
    return cases.filter((item) =>
      [item.employee, item.gym, item.position, item.reason, item.verdict?.finalReason]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    )
  }, [cases, search])

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-charcoal-200 bg-white px-2 py-1.5">
        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-charcoal-400"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('Search former employees…')}
            className="h-8 ps-8 text-xs"
            aria-label={t('Search former employees…')}
          />
        </div>
        <span className="text-[11px] text-charcoal-500">
          {visible.length === 1
            ? t('1 former employee')
            : t('{{count}} former employees', { count: visible.length })}
        </span>
      </div>

      <div className="rounded-xl border border-charcoal-200 bg-white">
        {visible.length === 0 ? (
          <EmptyState
            icon={UserMinus}
            title={t('No former employees')}
            message={
              search.trim()
                ? t('No former employees match this search.')
                : t('Employees appear here automatically once the exit interview and clearance are complete.')
            }
          />
        ) : (
          <Table className="rounded-xl">
            <THead>
              <TH>{t('Employee name')}</TH>
              <TH>{t('Branch')}</TH>
              <TH>{t('Position')}</TH>
              <TH>{t('Hire date')}</TH>
              <TH>{t('Termination date')}</TH>
              <TH>{t('Termination reason')}</TH>
              <TH>{t('Eligible for rehire')}</TH>
              <TH>{t('Blacklisted')}</TH>
            </THead>
            <TBody>
              {visible.map((separation) => {
                const rehire = rehireVerdict(separation)
                return (
                  <TR key={separation.id}>
                    <TD>
                      <p className="font-semibold text-charcoal-900">{separation.employee}</p>
                      {separation.employeeNumber && (
                        <p className="text-[10px] text-charcoal-400">{separation.employeeNumber}</p>
                      )}
                    </TD>
                    <TD>{separation.gym}</TD>
                    <TD>{separation.position}</TD>
                    <TD className="whitespace-nowrap">{fullDate(separation.hireDate)}</TD>
                    <TD className="whitespace-nowrap">
                      {fullDate(separation.terminationDate ?? separation.lastDay)}
                    </TD>
                    <TD className="max-w-64">
                      <p
                        className="truncate text-charcoal-700"
                        title={separation.verdict?.finalReason ?? separation.reason ?? undefined}
                      >
                        {separation.verdict?.finalReason ?? separation.reason ?? '—'}
                      </p>
                    </TD>
                    <TD>
                      {rehire == null ? (
                        <span className="text-charcoal-400">—</span>
                      ) : rehire ? (
                        <Badge color="green">{t('Eligible')}</Badge>
                      ) : (
                        <Badge color="red">{t('Not eligible')}</Badge>
                      )}
                    </TD>
                    <TD>
                      {separation.blacklisted ? (
                        <span title={separation.blacklistReason ?? undefined}>
                          <Badge color="red">{t('Yes')}</Badge>
                        </span>
                      ) : (
                        <Badge color="gray">{t('No')}</Badge>
                      )}
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        )}
      </div>

      <p className="text-[11px] text-charcoal-400">
        {t('Former employees are archived automatically when the exit interview and clearance are completed.')}
      </p>
    </div>
  )
}
