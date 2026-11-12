import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { Textarea } from '../../../components/ui/textarea'
import { useCreateVacancy, useUpdateVacancy } from '../hooks/useRecruitment'
import { useMe } from '../../../contexts/MeContext'
import { describeApiError } from '../../../lib/api-client'
import { URGENCIES, type Vacancy, type VacancyBody } from '../api/recruitment.api'

export interface VacancyFormDialogProps {
  /** null = create mode, otherwise the vacancy being edited. */
  vacancy: Vacancy | null
  onClose: () => void
}

/** Create / edit a vacancy (recruitment.vacancies.manage). */
export function VacancyFormDialog({ vacancy, onClose }: VacancyFormDialogProps) {
  const { t } = useTranslation()
  const { me } = useMe()
  const createVacancy = useCreateVacancy()
  const updateVacancy = useUpdateVacancy(vacancy?.id ?? 0)
  const mode = vacancy ? 'edit' : 'create'

  const [position, setPosition] = useState(vacancy?.position ?? '')
  const [gymId, setGymId] = useState(
    vacancy?.gymId != null ? String(vacancy.gymId) : me?.activeGym != null ? String(me.activeGym.gymId) : '',
  )
  const [headcount, setHeadcount] = useState(vacancy != null ? String(vacancy.headcount) : '1')
  const [urgency, setUrgency] = useState(vacancy?.urgency ?? 'Medium')
  const [source, setSource] = useState(vacancy?.source ?? '')
  const [jobDescription, setJobDescription] = useState(vacancy?.description ?? '')
  const [requirements, setRequirements] = useState(vacancy?.requirements ?? '')
  const [salary, setSalary] = useState(vacancy?.salary != null ? String(vacancy.salary) : '')
  const [shift, setShift] = useState(vacancy?.shift ?? '')
  const [status, setStatus] = useState(vacancy?.status === 'Draft' ? 'Draft' : 'Open')
  const [actionError, setActionError] = useState<string | null>(null)

  const gymOptions = me?.gyms ?? []
  const canSubmit = position.trim().length > 0 && gymId !== ''

  const onSubmit = async () => {
    if (!canSubmit) return
    setActionError(null)
    const body: VacancyBody = {
      position: position.trim(),
      gymId: Number(gymId),
      urgency,
      ...(headcount.trim() ? { headcountNeeded: Number(headcount) } : {}),
      ...(source.trim() ? { source: source.trim() } : {}),
      ...(jobDescription.trim() ? { jobDescription: jobDescription.trim() } : {}),
      ...(requirements.trim() ? { requirements: requirements.trim() } : {}),
      ...(salary.trim() ? { salary: Number(salary) } : {}),
      ...(shift.trim() ? { shift: shift.trim() } : {}),
      ...(mode === 'create' || status !== vacancy?.status ? { status } : {}),
    }
    try {
      if (vacancy) await updateVacancy.mutateAsync(body)
      else await createVacancy.mutateAsync(body)
      onClose()
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={vacancy ? t('Edit vacancy') : t('New vacancy')}
      description={vacancy ? `${vacancy.position} · ${vacancy.gym}` : t('Open a position on the public vacancy board.')}
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={onSubmit} loading={createVacancy.isPending || updateVacancy.isPending} disabled={!canSubmit}>
            {vacancy ? t('Save changes') : t('Create vacancy')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {actionError && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError}
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="vacancy-position">{t('Position (required)')}</Label>
            <Input
              id="vacancy-position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder={t('e.g. Front Desk')}
            />
          </div>
          <div>
            <Label htmlFor="vacancy-gym">{t('Gym')}</Label>
            <Select id="vacancy-gym" value={gymId} onChange={(e) => setGymId(e.target.value)}>
              {gymOptions.map((option) => (
                <option key={option.gymId} value={String(option.gymId)}>
                  {option.gymName}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="vacancy-headcount">{t('Headcount needed')}</Label>
            <Input id="vacancy-headcount" type="number" min={1} value={headcount} onChange={(e) => setHeadcount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="vacancy-urgency">{t('Urgency')}</Label>
            <Select id="vacancy-urgency" value={urgency} onChange={(e) => setUrgency(e.target.value)}>
              {URGENCIES.map((option) => (
                <option key={option} value={option}>
                  {t(option)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="vacancy-salary">{t('Salary (EGP)')}</Label>
            <Input id="vacancy-salary" type="number" min={0} value={salary} onChange={(e) => setSalary(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="vacancy-shift">{t('Shift')}</Label>
            <Input id="vacancy-shift" value={shift} onChange={(e) => setShift(e.target.value)} placeholder={t('e.g. Morning')} />
          </div>
          <div>
            <Label htmlFor="vacancy-source">{t('Source')}</Label>
            <Input id="vacancy-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder={t('e.g. HR Console')} />
          </div>
          <div>
            <Label htmlFor="vacancy-status">{t('Status')}</Label>
            <Select id="vacancy-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="Open">{t('Open')}</option>
              <option value="Draft">{t('Draft')}</option>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="vacancy-description">{t('Job description')}</Label>
          <Textarea
            id="vacancy-description"
            rows={3}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder={t('What does the role involve?')}
          />
        </div>
        <div>
          <Label htmlFor="vacancy-requirements">{t('Requirements')}</Label>
          <Textarea
            id="vacancy-requirements"
            rows={3}
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder={t('Skills, experience, languages…')}
          />
        </div>
      </div>
    </Dialog>
  )
}
