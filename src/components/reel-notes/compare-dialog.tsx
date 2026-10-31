'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { X, FileText, Tag, Hash, Clock, ImageIcon, ArrowLeftRight, Loader2, GitCompare, Plus, Minus, RefreshCw, Equal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { colorForTag, shade } from '@/lib/tag-colors'
import { diffKeyPoints, summarizeDiff, type DiffRow, type DiffStatus } from '@/lib/diff'
import type { CompareResponse, CompareNote, NoteVersion } from '@/lib/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The two note ids to compare. */
  aId: string | null
  bId: string | null
}

function TagBadges({ tags, tagColors }: { tags: string[]; tagColors?: Record<string, string> }) {
  if (tags.length === 0) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => {
        const c = colorForTag(t, tagColors)
        return (
          <Badge
            key={t}
            variant="secondary"
            className="gap-0.5 border text-[11px]"
            style={{ backgroundColor: shade(c, 0.85), color: shade(c, -0.3), borderColor: shade(c, 0.6) }}
          >
            <Hash className="h-2.5 w-2.5" />
            {t}
          </Badge>
        )
      })}
    </div>
  )
}

function NoteColumn({ note, side }: { note: CompareNote; side: 'A' | 'B' }) {
  const version = note.english || note.urdu || note.hinglish
  if (!version) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-8 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No notes in this note.</p>
      </div>
    )
  }
  const { structured } = version
  const isUrdu = structured.language === 'urdu'
  return (
    <div
      className={`flex flex-1 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm ${isUrdu ? 'font-urdu' : ''}`}
      dir={isUrdu ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between gap-2 border-b px-4 py-3 text-white ${
          side === 'A' ? 'bg-gradient-to-r from-emerald-600 to-emerald-700' : 'bg-gradient-to-r from-amber-600 to-orange-600'
        }`}
      >
        <div className="min-w-0">
          <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-90">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[9px]">{side}</span>
            {note.videoName}
          </div>
          <h3 className={`truncate text-base font-bold ${isUrdu ? 'leading-loose' : ''}`}>{structured.title}</h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-[10px] opacity-90">
          <span className="rounded bg-white/20 px-1.5 py-0.5 uppercase">{note.language}</span>
          {note.wordCount != null && <span>{note.wordCount} words</span>}
          {note.durationSec != null && <span>{Math.round(note.durationSec)}s</span>}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4 scroll-thin">
        {structured.summary && (
          <p className={`rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground ${isUrdu ? 'text-right leading-loose' : ''}`}>
            {structured.summary}
          </p>
        )}
        <div className="space-y-2">
          {structured.keyPoints.map((kp, i) => (
            <div
              key={i}
              className={`flex gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5 ${isUrdu ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-bold text-white ${
                  side === 'A' ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              >
                {String(i + 1).padStart(2, '0')}
              </div>
              <div className={`min-w-0 flex-1 ${isUrdu ? 'text-right' : ''}`}>
                <div className={`text-xs font-semibold ${isUrdu ? 'leading-loose' : ''}`}>{kp.heading}</div>
                <div className={`text-[11px] text-muted-foreground ${isUrdu ? 'leading-loose' : 'leading-relaxed'}`}>
                  {kp.detail}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tags */}
        {structured.tags.length > 0 && (
          <div className={`flex flex-wrap items-center gap-1.5 border-t pt-3 ${isUrdu ? 'justify-end' : ''}`}>
            <Tag className="h-3 w-3 text-muted-foreground" />
            <TagBadges tags={structured.tags} tagColors={structured.tagColors} />
          </div>
        )}

        {/* Infographic thumbnails */}
        {(note.infographicEn || note.infographicUr || note.infographicHi) && (
          <div className="flex gap-2 border-t pt-3">
            {note.infographicEn && (
              <img src={note.infographicEn.url} alt="EN infographic" className="h-20 w-auto rounded border object-cover" />
            )}
            {note.infographicUr && (
              <img src={note.infographicUr.url} alt="UR infographic" className="h-20 w-auto rounded border object-cover" />
            )}
            {note.infographicHi && (
              <img src={note.infographicHi.url} alt="Hinglish infographic" className="h-20 w-auto rounded border object-cover" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Diff view ----

const DIFF_STYLES: Record<DiffStatus, { bg: string; border: string; icon: React.ReactNode; label: string; iconColor: string }> = {
  added: { bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-500/40', icon: <Plus className="h-3.5 w-3.5" />, label: 'Added in B', iconColor: 'text-emerald-600' },
  removed: { bg: 'bg-red-50 dark:bg-red-950/20', border: 'border-red-500/40', icon: <Minus className="h-3.5 w-3.5" />, label: 'Only in A', iconColor: 'text-red-600' },
  changed: { bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-500/40', icon: <RefreshCw className="h-3.5 w-3.5" />, label: 'Changed', iconColor: 'text-amber-600' },
  unchanged: { bg: 'bg-muted/20', border: 'border-border/40', icon: <Equal className="h-3.5 w-3.5" />, label: 'Unchanged', iconColor: 'text-muted-foreground' },
}

function DiffRowCard({ row }: { row: DiffRow }) {
  const s = DIFF_STYLES[row.status]
  return (
    <div className={`rounded-lg border p-3 ${s.bg} ${s.border}`}>
      <div className="mb-1 flex items-center gap-2">
        <span className={s.iconColor}>{s.icon}</span>
        <span className="text-xs font-semibold">{row.heading}</span>
        <Badge variant="outline" className={`ml-auto text-[9px] uppercase ${s.iconColor} border-current/30`}>
          {s.label}
        </Badge>
      </div>
      {row.status === 'changed' ? (
        <div className="space-y-1.5">
          <div className="rounded bg-red-50/50 px-2 py-1 text-[11px] text-red-900 line-through dark:bg-red-950/30 dark:text-red-200">
            <span className="mr-1 font-bold text-red-600">A:</span>
            {row.detailA}
          </div>
          <div className="rounded bg-emerald-50/50 px-2 py-1 text-[11px] text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            <span className="mr-1 font-bold text-emerald-600">B:</span>
            {row.detailB}
          </div>
        </div>
      ) : (
        <p className={`text-[11px] text-muted-foreground ${row.status === 'removed' ? 'line-through opacity-70' : ''}`}>
          {row.detailA || row.detailB}
        </p>
      )}
    </div>
  )
}

function DiffView({ data }: { data: CompareResponse }) {
  const aVersion = data.a.english || data.a.urdu || data.a.hinglish
  const bVersion = data.b.english || data.b.urdu || data.b.hinglish
  if (!aVersion || !bVersion) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Both notes need content to diff.
      </div>
    )
  }
  const rows = diffKeyPoints(aVersion.structured.keyPoints, bVersion.structured.keyPoints)
  const summary = summarizeDiff(rows)

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      {/* Summary bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diff summary</span>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-700">
            <Plus className="h-3 w-3" /> {summary.added} added
          </Badge>
          <Badge variant="outline" className="gap-1 border-red-500/40 text-red-700">
            <Minus className="h-3 w-3" /> {summary.removed} removed
          </Badge>
          <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-700">
            <RefreshCw className="h-3 w-3" /> {summary.changed} changed
          </Badge>
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <Equal className="h-3 w-3" /> {summary.unchanged} unchanged
          </Badge>
        </div>
      </div>

      {/* Diff rows */}
      <div className="flex-1 space-y-2 overflow-y-auto scroll-thin">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No key points to diff.</p>
        ) : (
          rows.map((row, i) => <DiffRowCard key={i} row={row} />)
        )}
      </div>
    </div>
  )
}

// ---- Main dialog ----

export function CompareDialog({ open, onOpenChange, aId, bId }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<CompareResponse | null>(null)
  const [mode, setMode] = useState<'side-by-side' | 'diff'>('side-by-side')

  useEffect(() => {
    if (!open || !aId || !bId) {
      // Clear cached comparison data when the dialog closes or loses its ids.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    setMode('side-by-side')
    ;(async () => {
      try {
        const res = await fetch(`/api/notes/compare?a=${encodeURIComponent(aId)}&b=${encodeURIComponent(bId)}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || `Comparison failed (${res.status})`)
        setData(json as CompareResponse)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Comparison failed')
        toast.error(e instanceof Error ? e.message : 'Comparison failed')
      } finally {
        setLoading(false)
      }
    })()
  }, [open, aId, bId])

  const sharedTags = (() => {
    if (!data) return []
    const aTags = new Set(data.a.english?.structured.tags || data.a.urdu?.structured.tags || data.a.hinglish?.structured.tags || [])
    const bTags = data.b.english?.structured.tags || data.b.urdu?.structured.tags || data.b.hinglish?.structured.tags || []
    return bTags.filter((t) => aTags.has(t))
  })()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-emerald-600" />
                Compare notes
              </DialogTitle>
              <DialogDescription className="mt-0.5">
                {mode === 'side-by-side'
                  ? 'Side-by-side comparison. Shared tags are highlighted below.'
                  : 'Diff view — added, removed, and changed key points.'}
              </DialogDescription>
            </div>
            {data && !loading && (
              <div className="flex shrink-0 gap-1 rounded-lg bg-muted/50 p-1">
                <button
                  type="button"
                  onClick={() => setMode('side-by-side')}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    mode === 'side-by-side' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ArrowLeftRight className="h-3 w-3" /> Side-by-side
                </button>
                <button
                  type="button"
                  onClick={() => setMode('diff')}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    mode === 'diff' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <GitCompare className="h-3 w-3" /> Diff
                </button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex h-[calc(92vh-180px)] flex-col gap-4 overflow-hidden px-6 py-4">
          {loading && (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          )}
          {error && (
            <div className="flex flex-1 items-center justify-center text-sm text-destructive">{error}</div>
          )}
          {data && !loading && mode === 'side-by-side' && (
            <>
              <div className="flex flex-1 gap-4 overflow-hidden">
                <NoteColumn note={data.a} side="A" />
                <NoteColumn note={data.b} side="B" />
              </div>

              {/* Shared tags bar */}
              <div className="shrink-0 rounded-xl border bg-muted/30 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Tag className="h-3 w-3" />
                  Shared tags ({sharedTags.length})
                </div>
                {sharedTags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {sharedTags.map((t) => {
                      const c = colorForTag(t)
                      return (
                        <Badge
                          key={t}
                          variant="secondary"
                          className="gap-0.5 border text-[11px]"
                          style={{ backgroundColor: shade(c, 0.85), color: shade(c, -0.3), borderColor: shade(c, 0.6) }}
                        >
                          <Hash className="h-2.5 w-2.5" />
                          {t}
                        </Badge>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No shared tags between these two notes.</p>
                )}
              </div>
            </>
          )}
          {data && !loading && mode === 'diff' && <DiffView data={data} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
