import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import { queryClient } from './app/query-client'
import { AuthSessionProvider } from './contexts/AuthSessionContext'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionProvider>
        <RouterProvider router={router} />
      </AuthSessionProvider>
    </QueryClientProvider>
  )
}