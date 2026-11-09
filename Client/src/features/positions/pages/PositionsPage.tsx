import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { Card } from '../../../components/ui/card'
import { Input } from '../../../components/ui/input'
import { Select } from '../../../components/ui/select'
import { Badge } from '../../../components/ui/badge'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { Table, TBody, TD, TH, THead, TR } from '../../../components/ui/table'
import { useGyms, usePositions } from '../hooks/usePositions'
import { useMe } from '../../../contexts/MeContext'
import { describeApiError } from '../../../lib/api-client'

const ACTIVE_OPTIONS = [
  { value: '', label: 'All positions' },
  { value: 'true', label: 'Active only' },
  { value: 'false', label: 'Inactive only' },
]

/** Org-wide positions & levels catalog (§9.2) — read-only headcount / fill view. */
export default function PositionsPage() {
  const { me } = useMe()
  const [gym, setGym] = useState('')
  const [search, setSearch] = useState('')
  const [active, setActive] = useState('')

  const gyms = useGyms()
  const positions = usePositions({
    gym: gym ? Number(gym) : undefined,
    searchTerm: search || undefined,
    active: active ? active === 'true' : undefined,
  })

  const hasFilters = Boolean(gym || search || active)

  return (
    <div>
      <PageHeader
        title="Positions"
        description={
          me?.activeGym
            ? `Positions, levels and headcount across your branches — active gym: ${me.activeGym.gymName}`
            : 'Positions, levels and headcount across your branches'
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <Select
            value={gym}
            onChange={(e) => setGym(e.target.value)}
            className="sm:w-52"
            aria-label="Filter by branch"
          >
            <option value="">All branches</option>
            {(gyms.data ?? []).map((option) => (
              <option key={option.id} value={String(option.id)}>
                {option.name}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Search by title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
            aria-label="Search positions"
          />
          <Select
            value={active}
            onChange={(e) => setActive(e.target.value)}
            className="sm:w-44"
            aria-label="Filter by active flag"
          >
            {ACTIVE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          {positions.data && (
            <p className="ml-auto self-center text-xs text-slate-500">
              {positions.data.total} position{positions.data.total === 1 ? '' : 's'}
            </p>
          )}
        </div>

        {positions.isLoading ? (
          <LoadingState label="Loading positions…" />
        ) : positions.error ? (
          <ErrorState message={describeApiError(positions.error)} />
        ) : (positions.data?.items?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Building2}
            title="No positions found"
            message={hasFilters ? 'Try adjusting your search or filters.' : 'No positions are defined in the catalog yet.'}
          />
        ) : (
          <Table>
            <THead>
              <TH>Position</TH>
              <TH>Levels</TH>
              <TH>Branch</TH>
              <TH>Staff</TH>
              <TH>Open</TH>
              <TH>Fill</TH>
            </THead>
            <TBody>
              {positions.data!.items.map((position) => {
                const fill = Math.max(0, Math.min(100, position.fill))
                return (
                  <TR key={position.id}>
                    <TD>
                      <p className="font-medium text-slate-900">{position.title}</p>
                      {position.department && <p className="text-xs text-slate-500">{position.department}</p>}
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {position.levels.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          position.levels.map((level) => (
                            <Badge key={level}>{level}</Badge>
                          ))
                        )}
                      </div>
                    </TD>
                    <TD className="text-slate-500">{position.gym}</TD>
                    <TD className="font-medium text-slate-900">
                      {position.active} / {position.headcount}
                    </TD>
                    <TD>
                      {position.open > 0 ? (
                        <Badge className="bg-amber-50 text-amber-700 ring-amber-200">{position.open} open</Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${fill}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">{fill}%</span>
                      </div>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
