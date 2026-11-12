import { useQuery } from '@tanstack/react-query'
import { getEvents, getGyms, type EventListParams } from '../api/events.api'

/** Paged events queue (gym / type / urgency / resolved filtered). */
export function useEvents(params: EventListParams) {
  return useQuery({
    queryKey: ['events', params],
    queryFn: ({ signal }) => getEvents(params, signal),
  })
}

/** Branch list for the gym filter. */
export function useGyms() {
  return useQuery({
    queryKey: ['gyms'],
    queryFn: ({ signal }) => getGyms(signal),
  })
}
