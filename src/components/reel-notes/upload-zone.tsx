'use client'

import { useCallback, useRef, useState } from 'react'
import { UploadCloud, FileVideo, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  file: File | null
  onFile: (f: File | null) => void
  disabled?: boolean
}

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
      onFile(files[0])
    },
    [onFile],
  )

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <FileVideo className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">{fmtSize(file.size)}</p>
        </div>
        {!disabled && (
          <button
            type="button"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            onClick={() => onFile(null)}
            aria-label="Remove file"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }

  return (
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
        'group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
        dragging
          ? 'border-accent bg-accent/5'
          : 'border-border bg-muted/20 hover:border-accent/50 hover:bg-muted/40',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <UploadCloud className="h-7 w-7 text-muted-foreground transition-colors group-hover:text-accent" />
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">
          Drop your video here, or{' '}
          <span className="text-accent underline-offset-2 group-hover:underline">browse files</span>
        </p>
        <p className="text-xs text-muted-foreground">MP4 · MOV · WebM · MKV · up to 120 MB</p>
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
  )
}
