import { useTranslation } from 'react-i18next'
import { Download, Paperclip } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * A document answer travels as "<file name>|data:<mime>;base64,..." so it rides
 * inside the answers payload. The raw value must never be printed as text.
 */
const FILE_SEPARATOR = '|data:'

interface DocumentAnswer {
  fileName: string
  href: string
  isImage: boolean
}

function toDocument(raw: string): DocumentAnswer | null {
  const separator = raw.indexOf(FILE_SEPARATOR)
  if (separator > 0) {
    const href = raw.slice(separator + 1)
    return {
      fileName: raw.slice(0, separator) || 'attachment',
      href,
      isImage: href.startsWith('data:image/'),
    }
  }

  // Stored without a name (older submissions) - still a payload, never text.
  if (raw.startsWith('data:') && raw.includes('base64,')) {
    return { fileName: 'attachment', href: raw, isImage: raw.startsWith('data:image/') }
  }

  return null
}

/** One stored document answer: a download chip, plus a preview when it is an image. */
function DocumentValue({ document }: { document: DocumentAnswer }) {
  const { t } = useTranslation()

  return (
    <div className="space-y-2">
      <a
        href={document.href}
        download={document.fileName}
        className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-800 hover:bg-brand-100"
      >
        <Paperclip className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{document.fileName}</span>
        <Download className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="sr-only">{t('Download')}</span>
      </a>

      {document.isImage && (
        <a href={document.href} target="_blank" rel="noreferrer" className="block w-fit">
          <img
            src={document.href}
            alt={document.fileName}
            className="max-h-40 rounded-lg border border-charcoal-200 object-contain"
          />
        </a>
      )}
    </div>
  )
}

export interface AnswerValueProps {
  /** A stored answer: plain text, string list (multi choice), or a document payload. */
  answer: unknown
  className?: string
}

/** Renders one stored answer without ever dumping a file payload as text. */
export function AnswerValue({ answer, className }: AnswerValueProps) {
  const { t } = useTranslation()

  if (answer == null || answer === '' || (Array.isArray(answer) && answer.length === 0)) {
    return <span className={cn('text-xs text-charcoal-400', className)}>{t('Not answered')}</span>
  }

  if (Array.isArray(answer)) {
    return (
      <ul className={cn('flex flex-wrap gap-1', className)}>
        {answer.map((item, index) => (
          <li key={`${item}-${index}`} className="badge badge-gray text-[10px]">
            {String(item)}
          </li>
        ))}
      </ul>
    )
  }

  const raw = String(answer)
  const document = toDocument(raw)
  if (document) return <DocumentValue document={document} />

  return <p className={cn('whitespace-pre-wrap text-xs text-charcoal-800', className)}>{raw}</p>
}
