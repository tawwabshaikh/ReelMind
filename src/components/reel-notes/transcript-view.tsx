'use client'

import { Download, FileText, Clock, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Props {
  transcript: string
  meta?: {
    filename: string
    sizeBytes: number
    durationSec: number | null
    wordCount: number
  }
}

function fmtDuration(sec: number | null): string {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function TranscriptView({ transcript, meta }: Props) {
  if (!transcript) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed py-16 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">The transcript will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {meta && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" /> {meta.filename}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> {fmtDuration(meta.durationSec)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            <Hash className="h-3 w-3" /> {meta.wordCount} words
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            {fmtSize(meta.sizeBytes)}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => {
              const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'transcript.txt'
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            .txt
          </Button>
        </div>
      )}
      <ScrollArea className="h-[460px] rounded-2xl border bg-muted/20 p-5">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 scroll-thin">
          {transcript}
        </p>
      </ScrollArea>
    </div>
  )
}
