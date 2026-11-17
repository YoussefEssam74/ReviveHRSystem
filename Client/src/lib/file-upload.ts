/**
 * Shared client-side upload guard. The API enforces the same limits, but
 * validating before the request gives the employee an immediate, named reason
 * instead of a generic failure after a slow upload.
 */
import { translate as t } from '../i18n'

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export const DOCUMENT_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx'] as const
export const DOCUMENT_ACCEPT = DOCUMENT_EXTENSIONS.join(',')
export const DOCUMENT_FORMATS_LABEL = 'PDF, Word, JPG, PNG or WEBP'

export const REQUEST_ATTACHMENT_EXTENSIONS = [...DOCUMENT_EXTENSIONS, '.gif'] as const
export const REQUEST_ATTACHMENT_ACCEPT = REQUEST_ATTACHMENT_EXTENSIONS.join(',')
export const REQUEST_ATTACHMENT_FORMATS_LABEL = 'PDF, Word, JPG, PNG, WEBP or GIF'

export interface UploadValidationOptions {
  allowedExtensions?: readonly string[]
  formatsLabel?: string
  maxBytes?: number
}

/** Returns a user-facing error, or null when the file is safe to send. */
export function validateUploadFile(
  file: File,
  {
    allowedExtensions = DOCUMENT_EXTENSIONS,
    formatsLabel = DOCUMENT_FORMATS_LABEL,
    maxBytes = MAX_UPLOAD_BYTES,
  }: UploadValidationOptions = {},
): string | null {
  if (file.size === 0) return t('That file is empty. Choose another file.')

  const dot = file.name.lastIndexOf('.')
  const extension = dot >= 0 ? file.name.slice(dot).toLowerCase() : ''
  if (!extension || !allowedExtensions.includes(extension)) {
    return t('Choose a {{formats}} file.', { formats: formatsLabel })
  }

  if (file.size > maxBytes) {
    return t('That file is too large. The maximum is {{size}} MB.', { size: Math.round(maxBytes / (1024 * 1024)) })
  }

  return null
}
