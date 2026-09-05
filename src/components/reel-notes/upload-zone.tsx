'use client'

import { useCallback, useRef, useState } from 'react'
import { UploadCloud, FileVideo, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  file: File | null
  onFile: (f: File | null) => void
  disabled?: boolean
}

const ACCEPTED = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', 'video/mpeg', 'video/ogg']
const ACCEPT_ATTR = '.mp4,.mov,.webm,.mkv,.mpeg,.mpg,.ogv,video/*'

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function UploadZone({ file, onFile, disabled }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return
      const f = files[0]
      onFile(f)
    },
    [onFile],
  )

  return (
    <div className="space-y-3">
      {!file ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload video"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            if (!disabled) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (disabled) return
            handleFiles(e.dataTransfer.files)
          }}
          className={cn(
            'group relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all',
            dragging
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
              : 'border-border bg-muted/30 hover:border-emerald-400/60 hover:bg-muted/50',
            disabled && 'pointer-events-none opacity-60',
          )}
        >
          {/* Decorative corner accents */}
          <div className="pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full bg-emerald-500/5 blur-2xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-amber-500/5 blur-2xl" aria-hidden />
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 transition-transform group-hover:scale-110">
            <UploadCloud className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              Drop a video here, or <span className="text-emerald-600 underline-offset-2 group-hover:underline">browse</span>
            </p>
            <p className="text-xs text-muted-foreground">MP4, MOV, WebM, MKV · up to 120 MB</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={disabled}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/20 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
            <FileVideo className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{file.name}</p>
            <p className="text-xs text-muted-foreground">{fmtSize(file.size)}</p>
          </div>
          {!disabled && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onFile(null)}
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
