const STORAGE_KEY = 'revive.biometric_url'

/** Local biometric service (python biometric_test/app.py) or the hosted instance. */
export const DEFAULT_BIOMETRIC_URL = 'https://revive-hr-biometrics.onrender.com'

export const BIOMETRIC_URL_PRESETS = [
  { label: 'Cloud (Render)', url: DEFAULT_BIOMETRIC_URL },
  { label: 'Local (port 10000)', url: 'http://localhost:10000' },
]

export function getBiometricUrl(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_BIOMETRIC_URL
  } catch {
    return DEFAULT_BIOMETRIC_URL
  }
}

export function saveBiometricUrl(url: string) {
  const normalized = url.trim().replace(/\/+$/, '')
  try {
    window.localStorage.setItem(STORAGE_KEY, normalized)
  } catch {
    // Storage unavailable; the value still applies for this page view.
  }
}
