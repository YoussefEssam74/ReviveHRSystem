import { useMutation, useQuery } from '@tanstack/react-query'
import {
  downloadReportsCsv,
  getReportsOverview,
  type ReportExportParams,
  type ReportsOverviewParams,
} from '../api/reports.api'

/** Reports overview metric cards (reports.view) — scoped server-side (UX gate only). */
export function useReportsOverview(params: ReportsOverviewParams, enabled: boolean = true) {
  return useQuery({
    queryKey: ['reports', 'overview', params],
    queryFn: ({ signal }) => getReportsOverview(params, signal),
    enabled,
  })
}

/** CSV export download — errors surface as an ApiError in the calling page. */
export function useExportReport() {
  return useMutation({
    mutationFn: (params: ReportExportParams) => downloadReportsCsv(params),
  })
}
