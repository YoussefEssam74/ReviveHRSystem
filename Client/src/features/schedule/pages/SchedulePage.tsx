import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { Avatar } from '../../../components/ui/avatar'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Dialog } from '../../../components/ui/dialog'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { Table, TBody, TD, TH, THead, TR } from '../../../components/ui/table'
import {
  useCreateShiftCycle,
  useCreateShiftTemplate,
  useDeleteShiftTemplate,
  usePublishShiftCycle,
  useShiftCycle,
  useShiftCycles,
  useShiftTemplates,
  useUpdateShiftTemplate,
} from '../hooks/useSchedule'
import { useMe } from '../../../contexts/MeContext'
import { describeApiError } from '../../../lib/api-client'
import { cn } from '../../../lib/utils'
import { formatTimeOfDay } from '../../../lib/format'
import type { ShiftTemplate } from '../api/schedule.api'

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Shift cycles → weekly assignment matrix + template management (S5/S8). */
export default function SchedulePage() {
  const { t } = useTranslation()
  const { can, me } = useMe()
  const gymId = me?.activeGym?.gymId ?? null
  const canManage = can('schedule', 2)

  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null)

  // Create-cycle dialog state.
  const [cycleDialogOpen, setCycleDialogOpen] = useState(false)
  const [cycleLabel, setCycleLabel] = useState('')
  const [cycleStart, setCycleStart] = useState('')
  const [cycleEnd, setCycleEnd] = useState('')
  const [cycleError, setCycleError] = useState<string | null>(null)

  // Template dialog state (null = closed; template = edit target, null = create).
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [templateStart, setTemplateStart] = useState('')
  const [templateEnd, setTemplateEnd] = useState('')
  const [templateError, setTemplateError] = useState<string | null>(null)

  // Delete-template confirmation.
  const [deletingTemplate, setDeletingTemplate] = useState<ShiftTemplate | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [publishError, setPublishError] = useState<string | null>(null)

  const cyclesQuery = useShiftCycles(gymId)
  const cycles = cyclesQuery.data ?? []
  // Fall back to the newest cycle; drop a selection that no longer exists.
  const activeCycleId =
    selectedCycleId != null && cycles.some((cycle) => cycle.id === selectedCycleId)
      ? selectedCycleId
      : (cycles[0]?.id ?? null)
  const detailQuery = useShiftCycle(activeCycleId)
  const templatesQuery = useShiftTemplates(gymId)

  const createCycle = useCreateShiftCycle(gymId ?? 0)
  const publishCycle = usePublishShiftCycle()
  const createTemplate = useCreateShiftTemplate(gymId ?? 0)
  const updateTemplate = useUpdateShiftTemplate(gymId ?? 0)
  const deleteTemplate = useDeleteShiftTemplate(gymId ?? 0)

  const openCreateCycle = () => {
    setCycleLabel('')
    setCycleStart('')
    setCycleEnd('')
    setCycleError(null)
    setCycleDialogOpen(true)
  }

  const onCreateCycle = async () => {
    if (gymId == null) return
    if (!cycleStart || !cycleEnd) {
      setCycleError(t('Pick both a start and an end date.'))
      return
    }
    if (cycleEnd < cycleStart) {
      setCycleError(t('The end date must be on or after the start date.'))
      return
    }
    setCycleError(null)
    try {
      const created = await createCycle.mutateAsync({
        label: cycleLabel.trim() || undefined,
        startDate: cycleStart,
        endDate: cycleEnd,
      })
      setCycleDialogOpen(false)
      setSelectedCycleId(created.id)
    } catch (err) {
      setCycleError(describeApiError(err))
    }
  }

  const onPublish = async () => {
    if (activeCycleId == null) return
    setPublishError(null)
    try {
      await publishCycle.mutateAsync(activeCycleId)
    } catch (err) {
      setPublishError(describeApiError(err))
    }
  }

  const openCreateTemplate = () => {
    setEditingTemplate(null)
    setTemplateName('')
    setTemplateStart('09:00')
    setTemplateEnd('17:00')
    setTemplateError(null)
    setTemplateDialogOpen(true)
  }

  const openEditTemplate = (template: ShiftTemplate) => {
    setEditingTemplate(template)
    setTemplateName(template.name)
    setTemplateStart(template.start.slice(0, 5))
    setTemplateEnd(template.end.slice(0, 5))
    setTemplateError(null)
    setTemplateDialogOpen(true)
  }

  const onSaveTemplate = async () => {
    if (gymId == null) return
    if (!templateName.trim()) {
      setTemplateError(t('A template name is required.'))
      return
    }
    if (!templateStart || !templateEnd) {
      setTemplateError(t('Pick both a start and an end time.'))
      return
    }
    if (templateEnd <= templateStart) {
      setTemplateError(t('The end time must be after the start time.'))
      return
    }
    setTemplateError(null)
    const body = { name: templateName.trim(), start: templateStart, end: templateEnd }
    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({ templateId: editingTemplate.id, body })
      } else {
        await createTemplate.mutateAsync(body)
      }
      setTemplateDialogOpen(false)
    } catch (err) {
      setTemplateError(describeApiError(err))
    }
  }

  const onDeleteTemplate = async () => {
    if (gymId == null || deletingTemplate == null) return
    setDeleteError(null)
    try {
      await deleteTemplate.mutateAsync(deletingTemplate.id)
      setDeletingTemplate(null)
    } catch (err) {
      setDeleteError(describeApiError(err))
    }
  }

  const detail = detailQuery.data
  const templates = templatesQuery.data ?? []

  return (
    <div>
      <PageHeader
        title={t('Schedule')}
        description={
          me?.activeGym
            ? t('Shift cycles for {{gym}}', { gym: me.activeGym.gymName })
            : t('Shift cycles and weekly assignments')
        }
        actions={
          canManage && gymId != null ? (
            <Button onClick={openCreateCycle}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('New cycle')}
            </Button>
          ) : undefined
        }
      />

      {gymId == null ? (
        <EmptyState
          icon={CalendarDays}
          title={t('No gym selected')}
          message={t('Pick a branch in the gym switcher to see its schedule.')}
        />
      ) : cyclesQuery.isLoading ? (
        <LoadingState label={t('Loading schedule…')} />
      ) : cyclesQuery.error ? (
        <ErrorState message={describeApiError(cyclesQuery.error)} />
      ) : cycles.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={t('No shift cycles')}
          message={t('Create the first cycle to start planning weekly shifts.')}
          action={
            canManage ? (
              <Button onClick={openCreateCycle}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t('New cycle')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Cycle selector chips */}
          <Card className="mb-4">
            <div className="flex flex-wrap items-center gap-2 p-4">
              {cycles.map((cycle) => (
                <button
                  key={cycle.id}
                  type="button"
                  onClick={() => setSelectedCycleId(cycle.id)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                    cycle.id === activeCycleId
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {cycle.label}
                </button>
              ))}
            </div>
          </Card>

          {/* Weekly assignment matrix */}
          <Card className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900">{detail?.label ?? t('Weekly matrix')}</h2>
                {detail && <StatusBadge status={detail.status} />}
                {(detail?.conflicts.length ?? 0) > 0 && (
                  <Badge className="bg-amber-50 text-amber-700 ring-amber-200">
                    {t('{{count}} conflicts', { count: detail!.conflicts.length })}
                  </Badge>
                )}
              </div>
              {canManage && detail?.status === 'Draft' && (
                <Button size="sm" variant="outline" onClick={onPublish} loading={publishCycle.isPending}>
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('Publish cycle')}
                </Button>
              )}
            </div>

            {publishError && (
              <p role="alert" className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {publishError}
              </p>
            )}

            {detailQuery.isLoading ? (
              <LoadingState label={t('Loading assignments…')} />
            ) : detailQuery.error ? (
              <ErrorState message={describeApiError(detailQuery.error)} onRetry={() => detailQuery.refetch()} />
            ) : (detail?.assignments.length ?? 0) === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title={t('No assignments yet')}
                message={t('Nobody is scheduled in this cycle yet.')}
              />
            ) : (
              <>
                {detail!.conflicts.length > 0 && (
                  <ul className="space-y-1 border-b border-slate-100 bg-amber-50/60 px-4 py-3 text-xs text-amber-800">
                    {detail!.conflicts.slice(0, 5).map((conflict, index) => (
                      <li key={`${conflict.employeeId}-${conflict.day}-${index}`}>{conflict.message}</li>
                    ))}
                    {detail!.conflicts.length > 5 && (
                      <li>{t('+{{count}} more…', { count: detail!.conflicts.length - 5 })}</li>
                    )}
                  </ul>
                )}
                <Table>
                  <THead>
                    <TH>{t('Employee')}</TH>
                    {WEEK_DAYS.map((day) => (
                      <TH key={day} className="text-center">
                        {t(day)}
                      </TH>
                    ))}
                  </THead>
                  <TBody>
                    {detail!.assignments.map((row) => (
                      <TR key={row.employeeId}>
                        <TD>
                          <div className="flex items-center gap-3">
                            <Avatar name={row.initials} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-900">{row.name}</p>
                              <p className="truncate text-xs text-slate-500">{row.position}</p>
                            </div>
                          </div>
                        </TD>
                        {WEEK_DAYS.map((day, index) => {
                          const templateId = row.days[index]
                          const template =
                            templateId == null
                              ? null
                              : detail!.shiftTemplates.find((entry) => entry.id === templateId) ?? null
                          return (
                            <TD key={day} className="px-2 py-2">
                              {template ? (
                                <span
                                  className="block rounded-md px-1.5 py-1 text-center text-xs font-medium"
                                  style={{ backgroundColor: template.bgColor, color: template.textColor }}
                                >
                                  {template.name}
                                  <span className="block text-[10px] opacity-80">
                                    {formatTimeOfDay(template.start)}–{formatTimeOfDay(template.end)}
                                  </span>
                                </span>
                              ) : (
                                <span className="block rounded-md bg-slate-50 px-1.5 py-1 text-center text-xs text-slate-400">
                                  {t('Off')}
                                </span>
                              )}
                            </TD>
                          )
                        })}
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </>
            )}
          </Card>

          {/* Shift templates */}
          <Card>
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">{t('Shift templates')}</h2>
              {canManage && (
                <Button size="sm" variant="outline" onClick={openCreateTemplate}>
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('Add template')}
                </Button>
              )}
            </div>
            {templatesQuery.isLoading ? (
              <LoadingState label={t('Loading templates…')} />
            ) : templatesQuery.error ? (
              <ErrorState message={describeApiError(templatesQuery.error)} />
            ) : templates.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title={t('No shift templates')}
                message={
                  canManage
                    ? t('Add a template to start assigning shifts.')
                    : t('No templates are defined for this gym yet.')
                }
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {templates.map((template) => (
                  <li key={template.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: template.color }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{template.name}</p>
                        <p className="text-xs text-slate-500">
                          {formatTimeOfDay(template.start)} – {formatTimeOfDay(template.end)}
                          {template.isOff ? ` · ${t('Off day')}` : ''}
                        </p>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={t('Edit {{name}}', { name: template.name })}
                          onClick={() => openEditTemplate(template)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={t('Delete {{name}}', { name: template.name })}
                          onClick={() => {
                            setDeletingTemplate(template)
                            setDeleteError(null)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {/* New cycle dialog */}
      <Dialog
        open={cycleDialogOpen}
        onClose={() => setCycleDialogOpen(false)}
        title={t('New shift cycle')}
        description={t('Draft cycles can be edited and published later.')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCycleDialogOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={onCreateCycle} loading={createCycle.isPending}>
              {t('Create cycle')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {cycleError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {cycleError}
            </p>
          )}
          <div>
            <Label htmlFor="cycle-label">{t('Label (optional)')}</Label>
            <Input
              id="cycle-label"
              value={cycleLabel}
              onChange={(e) => setCycleLabel(e.target.value)}
              placeholder={t('e.g. Oct 20 – Oct 26')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cycle-start">{t('Start date')}</Label>
              <Input
                id="cycle-start"
                type="date"
                value={cycleStart}
                onChange={(e) => setCycleStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="cycle-end">{t('End date')}</Label>
              <Input id="cycle-end" type="date" value={cycleEnd} onChange={(e) => setCycleEnd(e.target.value)} />
            </div>
          </div>
        </div>
      </Dialog>

      {/* Shift template dialog (create / edit) */}
      <Dialog
        open={templateDialogOpen}
        onClose={() => setTemplateDialogOpen(false)}
        title={editingTemplate ? t('Edit shift template') : t('New shift template')}
        description={editingTemplate ? editingTemplate.name : t('Reusable shifts used across the weekly matrix.')}
        footer={
          <>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={onSaveTemplate} loading={createTemplate.isPending || updateTemplate.isPending}>
              {t('Save template')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {templateError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {templateError}
            </p>
          )}
          <div>
            <Label htmlFor="template-name">{t('Name')}</Label>
            <Input
              id="template-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder={t('e.g. Morning shift')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="template-start">{t('Start')}</Label>
              <Input
                id="template-start"
                type="time"
                value={templateStart}
                onChange={(e) => setTemplateStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="template-end">{t('End')}</Label>
              <Input id="template-end" type="time" value={templateEnd} onChange={(e) => setTemplateEnd(e.target.value)} />
            </div>
          </div>
        </div>
      </Dialog>

      {/* Delete template confirmation */}
      <Dialog
        open={deletingTemplate != null}
        onClose={() => setDeletingTemplate(null)}
        title={t('Delete shift template')}
        description={
          deletingTemplate
            ? `${deletingTemplate.name} · ${formatTimeOfDay(deletingTemplate.start)}–${formatTimeOfDay(deletingTemplate.end)}`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setDeletingTemplate(null)}>
              {t('Cancel')}
            </Button>
            <Button variant="danger" onClick={onDeleteTemplate} loading={deleteTemplate.isPending}>
              {t('Delete template')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {deleteError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {deleteError}
            </p>
          )}
          <p className="text-sm text-slate-600">
            {t('Cells assigned to this template become Off days so published schedules stay valid.')}
          </p>
        </div>
      </Dialog>
    </div>
  )
}
