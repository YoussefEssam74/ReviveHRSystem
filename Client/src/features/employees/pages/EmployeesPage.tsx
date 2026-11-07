import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { Card } from '../../../components/ui/card'
import { Input } from '../../../components/ui/input'
import { Select } from '../../../components/ui/select'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { Avatar } from '../../../components/ui/avatar'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { Pagination } from '../../../components/ui/pagination'
import { Table, TBody, TD, TH, THead, TR } from '../../../components/ui/table'
import { useEmployees } from '../hooks/useEmployees'
import { useMe } from '../../../contexts/MeContext'
import { formatDate, formatMoney } from '../../../lib/format'
import { describeApiError } from '../../../lib/api-client'

const STATUS_OPTIONS = ['', 'Active', 'On Leave', 'Suspended', 'Terminated']

/** HR employee directory (S1) — paged, searchable, gym-scoped. */
export default function EmployeesPage() {
  const navigate = useNavigate()
  const { me } = useMe()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, error } = useEmployees({
    search: search || undefined,
    status: status || undefined,
    page,
    pageSize: 20,
  })

  // Reset to page 1 when filters change.
  const onSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }
  const onStatus = (value: string) => {
    setStatus(value)
    setPage(1)
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        description={me?.activeGym ? `Staff at ${me.activeGym.gymName}` : 'Employee directory'}
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="sm:max-w-xs"
            aria-label="Search employees"
          />
          <Select value={status} onChange={(e) => onStatus(e.target.value)} className="sm:w-48" aria-label="Filter by status">
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option || 'All statuses'}
              </option>
            ))}
          </Select>
        </div>

        {isLoading ? (
          <LoadingState label="Loading employees…" />
        ) : error ? (
          <ErrorState message={describeApiError(error)} />
        ) : (data?.items?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Users}
            title="No employees found"
            message={search || status ? 'Try adjusting your search or filters.' : 'No staff are assigned to this gym yet.'}
          />
        ) : (
          <>
            <Table>
              <THead>
                <TH>Employee</TH>
                <TH>Position</TH>
                <TH>Status</TH>
                <TH>Hired</TH>
                <TH className="text-right">Salary</TH>
              </THead>
              <TBody>
                {data!.items.map((employee) => (
                  <TR key={employee.id} onClick={() => navigate(`/console/employees/${employee.id}`)}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={employee.initials} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{employee.name}</p>
                          <p className="truncate text-xs text-slate-500">{employee.email ?? employee.employeeNumber}</p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <p className="text-slate-900">{employee.position}</p>
                      {employee.level && <Badge className="mt-0.5">{employee.level}</Badge>}
                    </TD>
                    <TD>
                      <StatusBadge status={employee.status} />
                    </TD>
                    <TD className="text-slate-500">{formatDate(employee.hireDate)}</TD>
                    <TD className="text-right font-medium text-slate-900">{formatMoney(employee.salary)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination
              page={data!.page}
              pageSize={data!.pageSize}
              total={data!.total}
              totalPages={data!.totalPages}
              onPageChange={setPage}
              noun="employees"
            />
          </>
        )}
      </Card>
    </div>
  )
}
