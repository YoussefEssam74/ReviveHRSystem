/**
 * Shared client-side upload guard. The API enforces the same limits, but
 * validating before the request gives the employee an immediate, named reason
 * instead of a generic failure after a slow upload.
 */
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
  if (file.size === 0) return 'That file is empty. Choose another file.'

  const dot = file.name.lastIndexOf('.')
  const extension = dot >= 0 ? file.name.slice(dot).toLowerCase() : ''
  if (!extension || !allowedExtensions.includes(extension)) {
    return `Choose a ${formatsLabel} file.`
  }

  if (file.size > maxBytes) {
    return `That file is too large. The maximum is ${Math.round(maxBytes / (1024 * 1024))} MB.`
  }

  return null
}
