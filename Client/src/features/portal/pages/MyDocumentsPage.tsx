import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Award,
  BadgeCheck,
  Briefcase,
  Download,
  FileText,
  IdCard,
  Upload,
} from 'lucide-react'
import {
  getHrDocuments,
  getOwnDocuments,
  getRequiredDocuments,
  uploadDocument,
  type EmployeeDocument,
} from '../api/employee-file.api'
import { Modal } from '../../../components/ui/modal'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/primitives'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { StatusBadge } from '../../../components/ui/badge'
import { useToast } from '../../../components/ui/toast'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { apiDownload, describeApiError } from '../../../lib/api-client'
import { formatDate } from '../../../lib/format'
import { cn } from '../../../lib/utils'

const REQUIRED_ICONS: Record<string, typeof FileText> = {
  contract: Briefcase,
  nationalid: IdCard,
  certification: Award,
  other: BadgeCheck,
}

function requiredIcon(key: string) {
  return REQUIRED_ICONS[key] ?? FileText
}

/** Mirror of the mock's download flow: fetch → anchor click. */
function saveBlob({ blob, fileName, fallbackName }: { blob: Blob; fileName: string | null; fallbackName: string }) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName ?? fallbackName
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function MyDocumentsPage() {
  const { me } = usePortalSession()
  const employeeId = me?.employeeId ?? null
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [uploadFor, setUploadFor] = useState<string | null>(null) // required-doc key, '' = generic
  const [detailDoc, setDetailDoc] = useState<EmployeeDocument | null>(null)

  const documentsQuery = useQuery({
    queryKey: ['portal', 'documents', employeeId],
    queryFn: ({ signal }) => getOwnDocuments(employeeId!, signal),
    enabled: employeeId != null,
  })
  const requiredQuery = useQuery({
    queryKey: ['portal', 'required-documents', employeeId],
    queryFn: ({ signal }) => getRequiredDocuments(employeeId!, signal),
    enabled: employeeId != null,
  })
  const hrQuery = useQuery({
    queryKey: ['portal', 'hr-documents', employeeId],
    queryFn: ({ signal }) => getHrDocuments(employeeId!, signal),
    enabled: employeeId != null,
  })

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['portal', 'documents'] }),
      queryClient.invalidateQueries({ queryKey: ['portal', 'required-documents'] }),
    ])

  const downloadMutation = useMutation({
    mutationFn: ({ path }: { path: string; fallback: string }) => apiDownload(path),
    onSuccess: ({ blob, fileName }) => saveBlob({ blob, fileName, fallbackName: fileName ?? 'document' }),
    onError: (error) => toast(describeApiError(error), 'error'),
  })
  const downloadOwn = (doc: EmployeeDocument) =>
    downloadMutation.mutate({ path: `/api/employees/${employeeId}/documents/${doc.id}/download`, fallback: doc.name })
  const downloadHr = (id: number, name: string) =>
    downloadMutation.mutate({ path: `/api/employees/${employeeId}/hr-documents/${id}/download`, fallback: name })

  if (employeeId == null) {
    return <EmptyState title="No employee profile" hint="This account is not linked to an employee profile." />
  }
  if (documentsQuery.isLoading || requiredQuery.isLoading) {
    return <LoadingState label="Loading your documents…" />
  }
  if (documentsQuery.isError) {
    return <ErrorState message={describeApiError(documentsQuery.error)} onRetry={() => documentsQuery.refetch()} />
  }
  if (requiredQuery.isError) {
    return <ErrorState message={describeApiError(requiredQuery.error)} onRetry={() => requiredQuery.refetch()} />
  }

  const documents = documentsQuery.data ?? []
  const required = requiredQuery.data ?? []
  const hrDocs = hrQuery.data ?? []
  const byId = new Map(documents.map((doc) => [doc.id, doc]))
  const uploaded = required.filter((item) => item.documentId != null)
  const doneCount = uploaded.length

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-bold text-charcoal-900">My Documents</h1>
          <p className="mt-0.5 text-[11px] text-charcoal-500">
            {doneCount} of {required.length} required documents uploaded
          </p>
        </div>
        <button type="button" onClick={() => setUploadFor('')} className="btn btn-sm btn-primary">
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          Upload
        </button>
      </div>

      {/* Required documents checklist */}
      <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
        <div className="flex items-center justify-between border-b border-charcoal-100 px-3 py-1.5">
          <p className="bento-label">REQUIRED DOCUMENTS · EMPLOYEE UPLOADS</p>
          <span className="text-[10px] text-charcoal-400">
            {doneCount}/{required.length} complete
          </span>
        </div>
        <div className="divide-y divide-charcoal-50">
          {required.map((item) => {
            const Icon = requiredIcon(item.key)
            const doc = item.documentId != null ? byId.get(item.documentId) ?? null : null
            return (
              <div key={item.key} className="flex items-center gap-2 px-3 py-1.5">
                <div
                  className={cn(
                    'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md',
                    doc ? 'bg-brand-100 text-brand-600' : 'bg-charcoal-100 text-charcoal-400',
                  )}
                >
                  <Icon className="h-3 w-3" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-charcoal-900">
                    {item.label}
                    <span className="text-[10px] font-normal text-charcoal-500">
                      {' '}
                      · {doc ? `Uploaded ${formatDate(doc.uploadDate)}` : 'Not uploaded yet'}
                    </span>
                  </p>
                </div>
                {doc ? (
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button type="button" onClick={() => setDetailDoc(doc)} className="hover:opacity-80">
                      <StatusBadge status={doc.status} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Download ${doc.name}`}
                      onClick={() => downloadOwn(doc)}
                      className="rounded-md p-1 transition-colors hover:bg-charcoal-100"
                    >
                      <Download className="h-3 w-3 text-charcoal-500" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setUploadFor(item.key)}
                    className="btn btn-sm btn-secondary flex-shrink-0"
                  >
                    <Upload className="h-3 w-3" aria-hidden="true" />
                    Upload
                  </button>
                )}
              </div>
            )
          })}
          {required.length === 0 && (
            <p className="px-3 py-3 text-xs text-charcoal-400">No document requirements are configured.</p>
          )}
        </div>
      </div>

      {/* HR published official documents */}
      <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
        <div className="flex items-center justify-between border-b border-charcoal-100 px-3 py-1.5">
          <p className="bento-label">HR UPLOADED · OFFICIAL COMPANY DOCUMENTS</p>
          <span className="inline-flex items-center gap-1 text-[10px] text-charcoal-400">
            <IdCard className="h-3 w-3" aria-hidden="true" />
            View / Download only
          </span>
        </div>
        <div className="divide-y divide-charcoal-50">
          {hrDocs.length === 0 ? (
            <p className="px-3 py-3 text-xs text-charcoal-400">HR has not published any documents for you yet.</p>
          ) : (
            hrDocs.map((hrDoc) => (
              <div key={hrDoc.id} className="flex items-center gap-2 px-3 py-1.5">
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-charcoal-100 text-charcoal-500">
                  <FileText className="h-3 w-3" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-charcoal-900">
                    {hrDoc.name}
                    <span className="text-[10px] font-normal text-charcoal-500">
                      {' '}
                      · {hrDoc.category} · {formatDate(hrDoc.addedDate)}
                      {hrDoc.size ? ` · ${hrDoc.size}` : ''}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  disabled={hrDoc.sizeBytes == null || !hrDoc.size}
                  onClick={() => downloadHr(hrDoc.id, hrDoc.name)}
                  className="btn btn-sm btn-secondary flex-shrink-0"
                >
                  <Download className="h-3 w-3" aria-hidden="true" />
                  Download
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* All on-file documents */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-sm font-bold text-charcoal-900">All On-File Documents</p>
        <span className="text-[10px] text-charcoal-400">{documents.length} documents</span>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-charcoal-200 bg-white lg:block">
        {documents.length === 0 ? (
          <EmptyState
            title="No documents on file"
            hint="Upload the required documents above — HR can then review your file."
          />
        ) : (
          <div className="table-responsive">
            <table className="data-table data-table-compact">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Category</th>
                  <th>Uploaded</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="cursor-pointer" onClick={() => setDetailDoc(doc)}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md',
                            doc.status === 'Expiring Soon' || doc.status === 'Expired'
                              ? 'bg-orange-100 text-orange-600'
                              : 'bg-charcoal-100 text-charcoal-600',
                          )}
                        >
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        </div>
                        <span className="text-xs font-medium text-charcoal-900">{doc.name}</span>
                      </div>
                    </td>
                    <td className="text-xs">{doc.category}</td>
                    <td className="text-xs">{formatDate(doc.uploadDate)}</td>
                    <td className={cn('text-xs', doc.expiryDate && doc.status === 'Expiring Soon' && 'font-medium text-orange-600')}>
                      {doc.expiryDate ? formatDate(doc.expiryDate) : '—'}
                    </td>
                    <td>
                      <StatusBadge status={doc.status} />
                    </td>
                    <td>
                      <button
                        type="button"
                        aria-label={`Download ${doc.name}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          downloadOwn(doc)
                        }}
                        className="rounded-lg p-1 transition-colors hover:bg-charcoal-100"
                      >
                        <Download className="h-3.5 w-3.5 text-charcoal-500" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="space-y-1.5 lg:hidden">
        {documents.length === 0 ? (
          <EmptyState title="No documents on file" hint="Upload the required documents above." />
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              role="button"
              tabIndex={0}
              onClick={() => setDetailDoc(doc)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') setDetailDoc(doc)
              }}
              className="card card-interactive cursor-pointer p-2"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
                    doc.status === 'Expiring Soon' || doc.status === 'Expired'
                      ? 'bg-orange-100 text-orange-600'
                      : 'bg-charcoal-100 text-charcoal-600',
                  )}
                >
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-charcoal-900">{doc.name}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-[10px] text-charcoal-500">{doc.category}</span>
                    {doc.expiryDate ? (
                      <span
                        className={cn(
                          'text-[10px]',
                          doc.status === 'Expiring Soon' ? 'font-medium text-orange-600' : 'text-charcoal-400',
                        )}
                      >
                        Exp: {formatDate(doc.expiryDate)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <StatusBadge status={doc.status} />
                  <button
                    type="button"
                    aria-label={`Download ${doc.name}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      downloadOwn(doc)
                    }}
                    className="rounded-lg p-1.5 transition-colors hover:bg-charcoal-100"
                  >
                    <Download className="h-3.5 w-3.5 text-charcoal-500" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail modal (mock openDocDetail) */}
      <Modal
        open={detailDoc != null}
        title={detailDoc?.name ?? ''}
        onClose={() => setDetailDoc(null)}
        footer={
          detailDoc && (
            <>
              <Button variant="secondary" size="sm" onClick={() => setDetailDoc(null)}>
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  downloadOwn(detailDoc)
                  setDetailDoc(null)
                }}
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download
              </Button>
            </>
          )
        }
      >
        {detailDoc && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="badge badge-gray">{detailDoc.category}</span>
              <StatusBadge status={detailDoc.status} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-charcoal-50 p-2.5 text-center">
                <p className="bento-label mb-0.5 text-charcoal-500">UPLOADED</p>
                <p className="text-xs font-semibold text-charcoal-900">{formatDate(detailDoc.uploadDate)}</p>
              </div>
              <div className="rounded-lg bg-charcoal-50 p-2.5 text-center">
                <p className="bento-label mb-0.5 text-charcoal-500">EXPIRES</p>
                <p
                  className={cn(
                    'text-xs font-semibold',
                    detailDoc.status === 'Expiring Soon' ? 'text-orange-600' : 'text-charcoal-900',
                  )}
                >
                  {detailDoc.expiryDate ? formatDate(detailDoc.expiryDate) : 'N/A'}
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-charcoal-50 p-6 text-center">
              <FileText className="mx-auto mb-2 h-10 w-10 text-charcoal-300" aria-hidden="true" />
              <p className="text-xs text-charcoal-500">Document preview</p>
            </div>
          </div>
        )}
      </Modal>

      {/* Upload modal (mock openUploadModal) — the real API derives the name from the file */}
      {uploadFor != null && (
        <UploadModal
          employeeId={employeeId}
          required={required}
          preselectedKey={uploadFor}
          onDone={async () => {
            toast('Document uploaded for HR review')
            await invalidate()
            setUploadFor(null)
          }}
          onClose={() => setUploadFor(null)}
        />
      )}
    </div>
  )
}

/* ==================== Upload modal ==================== */

function UploadModal({
  employeeId,
  required,
  preselectedKey,
  onDone,
  onClose,
}: {
  employeeId: number
  required: Array<{ key: string; label: string }>
  preselectedKey: string
  onDone: () => Promise<void>
  onClose: () => void
}) {
  const [category, setCategory] = useState(preselectedKey || required[0]?.key || '')
  const [expiryDate, setExpiryDate] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const uploadMutation = useMutation({
    mutationFn: () =>
      uploadDocument(employeeId, {
        category,
        expiryDate: expiryDate || null,
        file: file!,
      }),
    onSuccess: async () => {
      await onDone()
    },
    onError: (caught) => setError(describeApiError(caught)),
  })

  const types = required.length > 0
    ? required
    : [
        { key: 'contract', label: 'Employment Contract' },
        { key: 'nationalid', label: 'National ID (Front & Back)' },
        { key: 'certification', label: 'Certifications' },
        { key: 'other', label: 'Other Documents' },
      ]

  return (
    <Modal
      open
      width="wide"
      title="Upload Document"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={uploadMutation.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={uploadMutation.isPending}
            disabled={!category || !file}
            onClick={() => {
              setError(null)
              uploadMutation.mutate()
            }}
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            Upload
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          setError(null)
          if (!category || !file) {
            setError('Choose a document type and a file first.')
            return
          }
          uploadMutation.mutate()
        }}
      >
        <div>
          <label htmlFor="doc-category" className="form-label">
            Document Type
          </label>
          <select
            id="doc-category"
            className="form-select"
            required
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Select…</option>
            {types.map((type) => (
              <option key={type.key} value={type.key}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="doc-expiry" className="form-label">
            Expires On <span className="font-normal text-charcoal-400">(optional)</span>
          </label>
          <input
            id="doc-expiry"
            type="date"
            className="form-input"
            value={expiryDate}
            onChange={(event) => setExpiryDate(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="doc-file" className="form-label">
            File
          </label>
          <label
            htmlFor="doc-file"
            className="flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-charcoal-200 p-6 text-center transition-colors hover:border-brand-400"
          >
            <Upload className="mb-1 h-6 w-6 text-charcoal-300" aria-hidden="true" />
            <p className="text-xs text-charcoal-500">{file ? file.name : 'Click to upload or drag & drop'}</p>
            <p className="mt-0.5 text-[10px] text-charcoal-400">PDF, JPG, PNG up to 10MB</p>
            <input
              id="doc-file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null)
                event.target.value = ''
              }}
            />
          </label>
          <p className="mt-1 text-[10px] text-charcoal-400">
            The document name is taken from the file you choose.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
