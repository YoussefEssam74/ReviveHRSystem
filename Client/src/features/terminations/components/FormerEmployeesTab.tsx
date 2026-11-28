import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserMinus } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { EmptyState } from '../../../components/ui/empty-state'
import { TBody, TD, TH, THead, TR, Table } from '../../../components/ui/table'
import { fullDate, ListFootnote, ListToolbar, ToolbarSearch } from './termination-ui'
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
      <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
        <ListToolbar>
          <ToolbarSearch
            value={search}
            onChange={setSearch}
            placeholder={t('Search former employees…')}
            className="sm:max-w-72"
          />
          <span className="ms-auto text-[11px] text-charcoal-400">
            {visible.length === 1
              ? t('1 former employee')
              : t('{{count}} former employees', { count: visible.length })}
          </span>
        </ListToolbar>

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
              <TH className="text-start">{t('Employee name')}</TH>
              <TH className="hidden text-start xl:table-cell">{t('Branch')}</TH>
              <TH className="hidden text-start xl:table-cell">{t('Position')}</TH>
              <TH className="hidden text-start xl:table-cell">{t('Hire date')}</TH>
              <TH className="text-start">{t('Termination date')}</TH>
              <TH className="text-start">{t('Reason')}</TH>
              <TH className="text-start">{t('Rehire')}</TH>
              <TH className="text-start">{t('Blacklisted')}</TH>
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
                      <p className="text-[10px] text-charcoal-400 xl:hidden">
                        {separation.gym} · {separation.position}
                      </p>
                    </TD>
                    <TD className="hidden xl:table-cell">{separation.gym}</TD>
                    <TD className="hidden xl:table-cell">{separation.position}</TD>
                    <TD className="hidden whitespace-nowrap xl:table-cell">{fullDate(separation.hireDate)}</TD>
                    <TD className="whitespace-nowrap">
                      {fullDate(separation.terminationDate ?? separation.lastDay)}
                    </TD>
                    <TD className="max-w-48">
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

        <ListFootnote>
          {t('Former employees are archived automatically when the exit interview and clearance are completed.')}
        </ListFootnote>
      </div>
    </div>
  )
}
