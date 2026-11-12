import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

/** Responsive table wrapper: horizontal scroll on narrow screens. */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-slate-200 text-start">{children}</tr>
    </thead>
  )
}

export function TH({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn('whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500', className)}
    >
      {children}
    </th>
  )
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>
}

export function TR({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={cn(onClick && 'cursor-pointer transition-colors hover:bg-slate-50', className)}
    >
      {children}
    </tr>
  )
}

export function TD({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 align-middle text-slate-700', className)}>{children}</td>
}
