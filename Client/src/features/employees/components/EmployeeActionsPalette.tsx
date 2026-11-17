import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CalendarClock,
  ClipboardCheck,
  FilePlus2,
  Inbox,
  UserMinus,
  UserPlus,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Modal } from '../../../components/ui/modal'
import { useMe } from '../../../contexts/MeContext'
import type { FeatureCode } from '../../../lib/permissions'

interface PaletteAction {
  id: string
  label: string
  desc: string
  icon: LucideIcon
  /** Console feature required for the card (omitted = every signed-in user). */
  feature?: FeatureCode
  /** Console route to open; absent means "open the on-behalf request form". */
  route?: string
}

/** HR's roster actions — the console counterpart of the portal's Branch Actions palette. */
const PALETTE_ACTIONS: PaletteAction[] = [
  {
    id: 'request',
    label: 'Create Request for an Employee',
    desc: 'File leave, a correction or a swap on someone’s behalf — it lands in HR review',
    icon: FilePlus2,
    feature: 'requests',
  },
  {
    id: 'requests',
    label: 'Review Requests',
    desc: 'The HR inbox: approve, reject or archive employee requests',
    icon: Inbox,
    feature: 'requests',
    route: '/console/requests',
  },
  {
    id: 'attendance',
    label: 'Correct Attendance',
    desc: 'Fix missing check-ins / check-outs across the active gym',
    icon: CalendarClock,
    feature: 'attendance',
    route: '/console/attendance',
  },
  {
    id: 'payroll',
    label: 'Payroll Sheets',
    desc: 'Open the period sheets and run the payslips',
    icon: Wallet,
    feature: 'payroll',
    route: '/console/payroll',
  },
  {
    id: 'evaluations',
    label: 'Evaluations',
    desc: 'Forms and recorded evaluations for the active gym',
    icon: ClipboardCheck,
    feature: 'evaluations',
    route: '/console/evaluations',
  },
  {
    id: 'recruitment',
    label: 'Recruitment & Hiring',
    desc: 'Vacancies and candidates feeding the employee file',
    icon: UserPlus,
    feature: 'recruitment',
    route: '/console/recruitment',
  },
  {
    id: 'terminations',
    label: 'Terminations',
    desc: 'The leaving pipeline: notice period, exit checklist, verdict',
    icon: UserMinus,
    feature: 'offboarding',
    route: '/console/terminations',
  },
]

/** Roster command palette opened by the directory's Actions button. */
export function EmployeeActionsPalette({
  open,
  onClose,
  onCreateRequest,
}: {
  open: boolean
  onClose: () => void
  /** Opens the on-behalf request form (the palette closes first). */
  onCreateRequest: () => void
}) {
  const { t } = useTranslation()
  const { can } = useMe()
  const navigate = useNavigate()
  const actions = PALETTE_ACTIONS.filter((action) => !action.feature || can(action.feature))

  return (
    <Modal
      open={open}
      title={t('Employee Actions')}
      subtitle={t('Everything you can do for the roster in the active gym.')}
      onClose={onClose}
      width="wide"
    >
      {open && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  onClose()
                  if (action.route) navigate(action.route)
                  else onCreateRequest()
                }}
                className="group flex items-start gap-2.5 rounded-lg border border-charcoal-200 p-3 text-start transition-colors hover:border-brand-300 hover:bg-brand-50/60"
              >
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-charcoal-900">{t(action.label)}</span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-charcoal-500">{t(action.desc)}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
