'use client'

import { useCallback, useRef, useState } from 'react'
import { FileVideo, Link2, UploadCloud, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type VideoSourceMode = 'file' | 'link'

interface Props {
  file: File | null
  onFile: (f: File | null) => void
  mode: VideoSourceMode
  onModeChange: (mode: VideoSourceMode) => void
  url: string
  onUrlChange: (url: string) => void
  disabled?: boolean
}

const ACCEPT_ATTR = '.mp4,.mov,.webm,.mkv,.mpeg,.mpg,.ogv,.avi,video/*'

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function UploadZone({ file, onFile, mode, onModeChange, url, onUrlChange, disabled }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return
      onModeChange('file')
      onFile(files[0])
    },
    [onFile, onModeChange],
  )

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 rounded-xl bg-muted/70 p-1" role="tablist" aria-label="Video source">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'file'}
          disabled={disabled}
          onClick={() => onModeChange('file')}
          className={cn(
            'flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-all',
            mode === 'file' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <UploadCloud className="h-4 w-4" /> Upload a video
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'link'}
          disabled={disabled}
          onClick={() => onModeChange('link')}
          className={cn(
            'flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-all',
            mode === 'link' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Link2 className="h-4 w-4" /> Paste a link
        </button>
      </div>

      {mode === 'link' ? (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <label htmlFor="video-url" className="mb-2 block text-sm font-medium text-foreground">
            Video link
          </label>
          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="video-url"
              type="url"
              value={url}
              onChange={(event) => onUrlChange(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={disabled}
              autoComplete="url"
              className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Paste a public YouTube, Instagram, TikTok, Facebook, X, Vimeo, Reddit, Twitch or other supported video link · up to 120 MB. Private posts aren’t supported.
          </p>
        </div>
      ) : file ? (
        <div className="flex min-h-28 items-center gap-3 rounded-xl border border-emerald-600/20 bg-emerald-600/[0.04] p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <FileVideo className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{file.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Ready to transcribe · {fmtSize(file.size)}</p>
          </div>
          {!disabled && (
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onFile(null)}
              aria-label="Remove video"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Upload video"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDragOver={(event) => {
            event.preventDefault()
            if (!disabled) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            if (!disabled) handleFiles(event.dataTransfer.files)
          }}
          className={cn(
            'group relative flex min-h-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed px-5 py-7 text-center transition-all',
            dragging
              ? 'border-accent bg-accent/10'
              : 'border-border bg-muted/20 hover:border-accent/60 hover:bg-accent/[0.03]',
            disabled && 'pointer-events-none opacity-50',
          )}
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-accent shadow-sm ring-1 ring-border transition-transform group-hover:-translate-y-0.5">
            <UploadCloud className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-foreground">Drop your video here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            or <span className="font-medium text-accent underline-offset-4 group-hover:underline">browse files</span>
          </p>
          <p className="mt-3 text-xs text-muted-foreground">MP4 · MOV · WebM · MKV · up to 120 MB</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="sr-only"
            onChange={(event) => {
              handleFiles(event.target.files)
              event.currentTarget.value = ''
            }}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  )
}
