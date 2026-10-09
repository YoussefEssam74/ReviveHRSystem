import { CheckCircle2, LogIn, LogOut, ScanFace, Square } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { useFaceScanner } from '../hooks/useFaceScanner'
import type { FaceScanResponse } from '../api/attendance.api'

interface FaceScanPanelProps {
  stationCode: string
  /** Gym-bound station token from kiosk login. */
  stationToken: string
  onResult: (result: FaceScanResponse) => void
  onError: (error: unknown) => void
}

export function FaceScanPanel({ stationCode, stationToken, onResult, onError }: FaceScanPanelProps) {
  const scanner = useFaceScanner({ stationCode, stationToken, onResult, onError })

  const isScanning = scanner.phase === 'starting' || scanner.phase === 'scanning'

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
        <video
          ref={scanner.videoRef}
          autoPlay
          playsInline
          muted
          className={'aspect-video w-full -scale-x-100 object-cover ' + (isScanning ? 'block' : 'hidden')}
        />
        {!isScanning && (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-slate-400">
            <ScanFace className="h-10 w-10" aria-hidden="true" />
            <p className="text-sm">
              {scanner.phase === 'recognized' ? 'Face recognized' : 'Camera is off'}
            </p>
          </div>
        )}
        {isScanning && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/90 to-transparent px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-medium text-white">
              {scanner.phase === 'recognized' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              ) : (
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
              )}
              {scanner.statusText || 'Looking for a face…'}
            </p>
          </div>
        )}
      </div>

      {scanner.cameraError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {scanner.cameraError}
        </p>
      )}

      {isScanning ? (
        <Button variant="outline" size="lg" className="w-full" onClick={scanner.stopScan}>
          <Square className="h-4 w-4" aria-hidden="true" />
          Stop scanning
        </Button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" onClick={() => void scanner.startScan('IN')}>
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Check in with face
          </Button>
          <Button size="lg" variant="secondary" onClick={() => void scanner.startScan('OUT')}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Check out with face
          </Button>
        </div>
      )}
    </div>
  )
}
