import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '../lib/api-client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Client errors are definitive (4xx, incl. 403/404) except throttling.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429) return false
        return failureCount < 2
      },
    },
    mutations: {
      retry: false,
    },
  },
})
