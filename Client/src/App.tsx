import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import { queryClient } from './app/query-client'
import { AuthSessionProvider } from './contexts/AuthSessionContext'
import { MeProvider } from './contexts/MeContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './components/ui/toast'

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthSessionProvider>
            <MeProvider>
              <RouterProvider router={router} />
            </MeProvider>
          </AuthSessionProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}