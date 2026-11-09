import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './button'

export interface PaginationProps {
  page: number
  pageSize: number
  total: number
  totalPages: number
  onPageChange: (page: number) => void
  /** Optional noun for the summary ("employees", "rows"). */
  noun?: string
}

/** Pager + result summary for the paged list envelope. */
export function Pagination({ page, pageSize, total, totalPages, onPageChange, noun = 'results' }: PaginationProps) {
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row">
      <p className="text-sm text-slate-500">
        Showing <span className="font-medium text-slate-700">{from}</span>–<span className="font-medium text-slate-700">{to}</span> of{' '}
        <span className="font-medium text-slate-700">{total}</span> {noun}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Previous
        </Button>
        <span className="text-sm text-slate-500">
          Page {page} of {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
