'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Download, FileText, Tag, Hash, CheckCircle2, Copy, Check, Pencil, FileDown, Loader2, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ShareButton } from '@/components/reel-notes/share-button'
import type { NoteVersion, InfographicFile, NoteLanguage } from '@/lib/types'
import { slugify } from '@/lib/slugify-client'
import { colorForTag, shade } from '@/lib/tag-colors'

interface Props {
  english?: NoteVersion
  urdu?: NoteVersion
  hinglish?: NoteVersion
  infographicEn?: InfographicFile | null
  infographicUr?: InfographicFile | null
  infographicHi?: InfographicFile | null
  videoName?: string
  noteId?: string | null
  onEdit?: () => void
  /** When true, the share + edit buttons are hidden (read-only shared view). */
  readOnly?: boolean
}

function downloadText(filename: string, text: string, mime = 'text/markdown') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

async function exportPdf(
  note: NoteVersion,
  videoName: string,
  infographic: InfographicFile | null | undefined,
  noteId: string | null | undefined,
): Promise<void> {
  const res = await fetch('/api/export-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      note: note.structured,
      noteId,
      shareToken: typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('share') : null,
      videoName,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || `PDF export failed (${res.status})`)
  // Trigger browser download
  const a = document.createElement('a')
  a.href = data.url
  a.download = data.filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function NoteCard({
  version,
  lang,
  infographic,
  videoName,
  noteId,
  onEdit,
  readOnly,
}: {
  version: NoteVersion
  lang: NoteLanguage
  infographic?: InfographicFile | null
  videoName?: string
  noteId?: string | null
  onEdit?: () => void
  readOnly?: boolean
}) {
  const isUrdu = lang === 'urdu'
  const isHinglish = lang === 'hinglish'
  const { structured, markdown } = version
  const filename = `${slugify(structured.title)}-notes-${lang}.md`
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleCopy = async () => {
    const ok = await copyToClipboard(markdown)
    if (ok) {
      setCopied(true)
      toast.success(isUrdu ? 'نوٹس کاپی ہو گئے' : 'Notes copied to clipboard')
      setTimeout(() => setCopied(false), 1800)
    } else {
      toast.error('Copy failed — try the download button instead.')
    }
  }

  const handleExportPdf = async () => {
    setExporting(true)
    try {
      await exportPdf(version, videoName || 'untitled', infographic, noteId)
      toast.success(isUrdu ? 'PDF تیار ہے' : 'PDF exported')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      className={`group overflow-hidden rounded-lg border bg-card ${isUrdu ? 'font-urdu' : ''}`}
      dir={isUrdu ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <FileText className="h-3 w-3" />
            {isUrdu ? 'اردو نوٹس' : isHinglish ? 'Hinglish Notes' : 'English Notes'}
          </div>
          <h3 className={`truncate text-sm font-semibold ${isUrdu ? 'leading-loose' : ''}`}>
            {structured.title}
          </h3>
        </div>
        <div className="flex shrink-0 gap-1">
          {onEdit && !readOnly && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onEdit} aria-label="Edit notes">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {!readOnly && (
            <ShareButton noteId={noteId ?? null} videoName={videoName || 'untitled'} variant="icon" />
          )}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleExportPdf} disabled={exporting} aria-label="Export PDF">
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleCopy} aria-label="Copy as Markdown">
            {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2" onClick={() => downloadText(filename, markdown)}>
            <Download className="h-3.5 w-3.5" />
            <span className="text-xs">.md</span>
          </Button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {structured.summary && (
          <p className={`rounded-md bg-muted/30 px-3 py-2 text-sm text-muted-foreground ${isUrdu ? 'text-right leading-loose' : ''}`}>
            {structured.summary}
          </p>
        )}

        <div className="space-y-2.5">
          {structured.keyPoints.map((kp, i) => (
            <div
              key={i}
              className={`flex gap-3 rounded-md border border-border/60 bg-muted/10 p-3 ${isUrdu ? 'flex-row-reverse' : ''}`}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                {String(i + 1).padStart(2, '0')}
              </div>
              <div className={`min-w-0 flex-1 ${isUrdu ? 'text-right' : ''}`}>
                <div className={`mb-0.5 text-sm font-semibold ${isUrdu ? 'leading-loose' : ''}`}>{kp.heading}</div>
                <div className={`text-sm text-muted-foreground ${isUrdu ? 'leading-loose' : 'leading-relaxed'}`}>
                  {kp.detail}
                </div>
              </div>
            </div>
          ))}
        </div>

        {structured.tags.length > 0 && (
          <>
            <Separator />
            <div className={`flex flex-wrap items-center gap-2 ${isUrdu ? 'justify-end' : ''}`}>
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              {structured.tags.map((t, i) => {
                const color = colorForTag(t, structured.tagColors)
                return (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="gap-1 border"
                    style={{ backgroundColor: shade(color, 0.85), color: shade(color, -0.3), borderColor: shade(color, 0.6) }}
                  >
                    <Hash className="h-3 w-3" />
                    {t}
                  </Badge>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function NotesView({ english, urdu, hinglish, infographicEn, infographicUr, infographicHi, videoName, noteId, onEdit, readOnly }: Props) {
  if (!english && !urdu && !hinglish) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed py-16 text-center">
        <CheckCircle2 className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Notes will appear here after processing.</p>
      </div>
    )
  }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {english && (
        <NoteCard
          version={english}
          lang="english"
          infographic={infographicEn}
          videoName={videoName}
          noteId={noteId}
          onEdit={onEdit}
          readOnly={readOnly}
        />
      )}
      {urdu && (
        <NoteCard
          version={urdu}
          lang="urdu"
          infographic={infographicUr}
          videoName={videoName}
          noteId={noteId}
          onEdit={onEdit}
          readOnly={readOnly}
        />
      )}
      {hinglish && (
        <NoteCard
          version={hinglish}
          lang="hinglish"
          infographic={infographicHi}
          videoName={videoName}
          noteId={noteId}
          onEdit={onEdit}
          readOnly={readOnly}
        />
      )}
    </div>
  )
}

/** Re-export for the page's "copy all" action. */
export { copyToClipboard }
export type { Props as NotesViewProps }
