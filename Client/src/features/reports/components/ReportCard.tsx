import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card'

export interface ReportCardProps {
  title: string
  description?: string
  children: ReactNode
}

/** Section card for one reports overview area (workforce, attendance…). */
export function ReportCard({ title, description, children }: ReportCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  )
}

/** Inline label/value grid used inside a report card. */
export function MetricGrid({ metrics }: { metrics: { label: string; value: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
      {metrics.map((metric) => (
        <div key={metric.label}>
          <dt className="text-xs text-slate-500">{metric.label}</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-900">{metric.value}</dd>
        </div>
      ))}
    </dl>
  )
}
