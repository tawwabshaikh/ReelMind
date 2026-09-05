'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Download, FileText, Clock, Hash, Type, Gauge, Copy, Check } from 'lucide-react'
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
function fmtReadingTime(words: number): string {
  // ~200 wpm reading speed
  const sec = Math.round((words / 200) * 60)
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}

export function TranscriptView({ transcript, meta }: Props) {
  const [copied, setCopied] = useState(false)

  if (!transcript) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed py-16 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">The transcript will appear here.</p>
      </div>
    )
  }

  const charCount = transcript.length
  const words = meta?.wordCount ?? transcript.split(/\s+/).filter(Boolean).length

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcript)
      setCopied(true)
      toast.success('Transcript copied')
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Copy failed')
    }
  }

  const stats = [
    { icon: <FileText className="h-3 w-3" />, label: 'source', value: meta?.filename ?? 'transcript' },
    { icon: <Clock className="h-3 w-3" />, label: 'duration', value: fmtDuration(meta?.durationSec ?? null) },
    { icon: <Hash className="h-3 w-3" />, label: 'words', value: String(words) },
    { icon: <Type className="h-3 w-3" />, label: 'chars', value: String(charCount) },
    { icon: <Gauge className="h-3 w-3" />, label: 'read', value: fmtReadingTime(words) },
  ]

  return (
    <div className="space-y-3">
      {meta && (
        <div className="flex flex-wrap items-center gap-2">
          {stats.slice(0, 4).map((s, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
              title={s.label}
            >
              {s.icon}
              <span className="max-w-[140px] truncate">{s.value}</span>
            </span>
          ))}
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
            title="estimated reading time"
          >
            <Gauge className="h-3 w-3" /> {stats[4].value}
          </span>
          <div className="ml-auto flex gap-1.5">
            <Button size="sm" variant="outline" onClick={handleCopy} aria-label="Copy transcript">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <Button
              size="sm"
              variant="outline"
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
