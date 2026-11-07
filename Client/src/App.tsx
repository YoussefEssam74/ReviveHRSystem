import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import { queryClient } from './app/query-client'
import { AuthSessionProvider } from './contexts/AuthSessionContext'
import { MeProvider } from './contexts/MeContext'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionProvider>
        <MeProvider>
          <RouterProvider router={router} />
        </MeProvider>
      </AuthSessionProvider>
    </QueryClientProvider>
  )
}