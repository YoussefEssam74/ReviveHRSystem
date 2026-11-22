import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../../lib/utils'

/** Short money label for the chart axis: 36,000 → "36k". */
function axisMoney(value: number) {
  const amount = Number(value || 0)
  if (Math.abs(amount) >= 1_000_000) {
    const millions = amount / 1_000_000
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}m`
  }
  if (Math.abs(amount) >= 1_000) {
    const thousands = amount / 1_000
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`
  }
  return String(Math.round(amount))
}

export interface TrendRow {
  /** Short axis label — the mock charts print the month only. */
  label: string
  value: number
  /** Full label for the hover tooltip ("Nov 2026"). */
  title?: string
}

const TOP = 12
const BOTTOM = 88
const MID = (TOP + BOTTOM) / 2

/**
 * The mock's quiet trend chart: only the geometry lives in the SVG, so it
 * stretches to any card width while the labels and dots stay crisp and round.
 * A flat series still reads as data because the axis and its gridlines are real.
 */
export function TrendChart({
  rows,
  ariaLabel,
  height = 92,
  step = 25_000,
  currentLabel,
}: {
  rows: TrendRow[]
  ariaLabel: string
  height?: number
  /** Axis step, rounded up to a round number so the labels read 0 / 25k / 50k. */
  step?: number
  /** Month to emphasise (the selected reporting period). */
  currentLabel?: string
}) {
  const { t } = useTranslation()
  const gradientId = `trend-fill-${useId().replace(/:/g, '')}`

  const peak = Math.max(...rows.map((row) => row.value), 0)
  const max = Math.ceil(peak / step) * step || 1
  const xPercent = (index: number) => (rows.length === 1 ? 0 : (index / (rows.length - 1)) * 100)
  const yPercent = (value: number) => BOTTOM - (value / max) * (BOTTOM - TOP)

  const points = rows.map((row, index) => ({ ...row, x: xPercent(index), y: yPercent(row.value) }))
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
  const area = `${line} L100 100 L0 100 Z`

  return (
    <div className="relative pl-[34px]" role="img" aria-label={ariaLabel}>
      <div className="relative" style={{ height }}>
        <svg
          className="absolute inset-0 block h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand-600)" stopOpacity={0.16} />
              <stop offset="100%" stopColor="var(--color-brand-600)" stopOpacity={0} />
            </linearGradient>
          </defs>
          {[TOP, MID, BOTTOM].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke="var(--color-charcoal-200)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={area} fill={`url(#${gradientId})`} />
          <path
            d={line}
            fill="none"
            stroke="var(--color-brand-600)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {[max, max / 2, 0].map((value, index) => (
          <span
            key={value}
            className="absolute whitespace-nowrap text-[9px] leading-none text-charcoal-400"
            style={{ right: 'calc(100% + 6px)', top: `${[TOP, MID, BOTTOM][index]}%`, transform: 'translateY(-50%)' }}
          >
            {index === 0 && rows.length === 0 ? '' : axisMoney(value)}
          </span>
        ))}

        {points.map((point, index) => {
          const shift = index === 0 ? '0' : index === points.length - 1 ? '-100%' : '-50%'
          const active = currentLabel !== undefined && point.label === currentLabel
          return (
            <span
              key={`${point.label}-${index}`}
              className="absolute"
              style={{ left: `${point.x.toFixed(2)}%`, top: `${point.y.toFixed(2)}%`, transform: `translate(${shift}, -50%)` }}
            >
              <span
                className={cn(
                  'block rounded-full border-[1.5px] border-brand-600 transition-transform hover:scale-150',
                  active ? 'h-1.5 w-1.5 bg-brand-600' : 'h-[5px] w-[5px] bg-white',
                )}
                title={`${point.title ?? point.label}: ${axisMoney(point.value)}`}
              />
            </span>
          )
        })}
      </div>

      <div className="relative mt-1 h-[14px]" aria-hidden="true">
        {points.map((point, index) => {
          const shift = index === 0 ? '0' : index === points.length - 1 ? '-100%' : '-50%'
          return (
            <span
              key={`${point.label}-x-${index}`}
              className={cn(
                'absolute top-0 whitespace-nowrap text-[9px] leading-none',
                point.label === currentLabel ? 'font-semibold text-brand-700' : 'text-charcoal-400',
              )}
              style={{ left: `${point.x.toFixed(2)}%`, transform: `translateX(${shift})` }}
            >
              {point.label}
            </span>
          )
        })}
      </div>
      <p className="sr-only">{t('Monthly values')}</p>
    </div>
  )
}
