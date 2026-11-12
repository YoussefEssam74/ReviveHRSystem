import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { Textarea } from '../../../components/ui/textarea'
import { useMe } from '../../../contexts/MeContext'
import { describeApiError } from '../../../lib/api-client'
import {
  ANNOUNCEMENT_ALL_AUDIENCE,
  ANNOUNCEMENT_TYPES,
  postAnnouncement,
} from '../../notifications/api/notifications.api'
import type { ToastTone } from '../hooks/useMockToast'

export interface AnnouncementDialogProps {
  onClose: () => void
  toast: (message: string, tone?: ToastTone) => void
}

/** Fast action "Announcement" (mock openComposeAnnouncement → POST /api/announcements). */
export default function AnnouncementDialog({ onClose, toast }: AnnouncementDialogProps) {
  const { me } = useMe()
  const queryClient = useQueryClient()

  const [title, setTitle] = useState('')
  const [type, setType] = useState<string>(ANNOUNCEMENT_TYPES[0])
  const [audience, setAudience] = useState(ANNOUNCEMENT_ALL_AUDIENCE)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  const publish = useMutation({
    mutationFn: () => postAnnouncement({ title: title.trim(), type, audience, message: message.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      toast('Announcement sent to the selected audience.')
      onClose()
    },
    onError: (submitError) => setError(describeApiError(submitError)),
  })

  const submit = () => {
    setError(null)
    if (!title.trim() || !message.trim()) {
      setError('A title and a message are required.')
      return
    }
    publish.mutate()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Compose Announcement"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={publish.isPending}>
            Send announcement
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div>
          <Label htmlFor="ann-title">Title</Label>
          <Input id="ann-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ann-type">Type</Label>
            <Select id="ann-type" value={type} onChange={(event) => setType(event.target.value)}>
              {ANNOUNCEMENT_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ann-audience">Audience</Label>
            <Select id="ann-audience" value={audience} onChange={(event) => setAudience(event.target.value)}>
              <option value={ANNOUNCEMENT_ALL_AUDIENCE}>{ANNOUNCEMENT_ALL_AUDIENCE}</option>
              {(me?.gyms ?? []).map((gym) => (
                <option key={gym.gymId} value={gym.gymName}>
                  {gym.gymName}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="ann-message">Message</Label>
          <Textarea
            id="ann-message"
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="What do you want to announce?"
          />
        </div>
      </div>
    </Dialog>
  )
}
