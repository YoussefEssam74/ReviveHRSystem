import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { i18nReady } from './i18n'
import { reconcileWorkspaceSession } from './features/platform/lib/workspace-switch'
import './index.css'

// Render only after the translation resources are loaded so an Arabic session
// never paints English keys first.
void i18nReady.then(() => {
  // A gym workspace entered from the platform console wins over whatever token
  // the console page last wrote, so the switch survives an in-flight refresh.
  reconcileWorkspaceSession()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})