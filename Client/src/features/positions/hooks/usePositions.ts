import { useQuery } from '@tanstack/react-query'
import { getGyms, getPositions, type PositionListParams } from '../api/positions.api'

/** Positions catalog (gym / searchTerm / active filtered). */
export function usePositions(params: PositionListParams) {
  return useQuery({
    queryKey: ['positions', params],
    queryFn: ({ signal }) => getPositions(params, signal),
  })
}

/** Branch list for the gym filter. */
export function useGyms() {
  return useQuery({
    queryKey: ['gyms'],
    queryFn: ({ signal }) => getGyms(signal),
  })
}
