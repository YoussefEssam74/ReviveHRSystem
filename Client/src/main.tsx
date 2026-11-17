import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { i18nReady } from './i18n'
import './index.css'

// Render only after the translation resources are loaded so an Arabic session
// never paints English keys first.
void i18nReady.then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})