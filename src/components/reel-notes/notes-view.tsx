'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Download, FileText, Tag, Hash, CheckCircle2, Copy, Check, Pencil, FileDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { NoteVersion, InfographicFile } from '@/lib/types'
import { slugify } from '@/lib/slugify-client'

interface Props {
  english?: NoteVersion
  urdu?: NoteVersion
  infographicEn?: InfographicFile | null
  infographicUr?: InfographicFile | null
  videoName?: string
  onEdit?: () => void
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
): Promise<void> {
  const res = await fetch('/api/export-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      note: note.structured,
      infographicUrl: infographic?.url ?? null,
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
  onEdit,
}: {
  version: NoteVersion
  lang: 'english' | 'urdu'
  infographic?: InfographicFile | null
  videoName?: string
  onEdit?: () => void
}) {
  const isUrdu = lang === 'urdu'
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
      await exportPdf(version, videoName || 'untitled', infographic)
      toast.success(isUrdu ? 'PDF تیار ہے' : 'PDF exported')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      className={`group overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md ${isUrdu ? 'font-urdu' : ''}`}
      dir={isUrdu ? 'rtl' : 'ltr'}
    >
      {/* Header band */}
      <div className="relative flex items-center justify-between gap-3 border-b bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-4 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(220px_80px_at_85%_-40%,rgba(255,255,255,0.18),transparent)]" aria-hidden />
        <div className="relative min-w-0">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-50/90">
            <FileText className="h-3.5 w-3.5" />
            {isUrdu ? 'اردو نوٹس' : 'English Notes'}
          </div>
          <h3 className={`text-lg font-bold leading-snug ${isUrdu ? 'leading-loose' : ''}`}>
            {structured.title}
          </h3>
        </div>
        <div className="relative flex shrink-0 gap-1.5">
          {onEdit && (
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/15 text-white hover:bg-white/25"
              onClick={onEdit}
              aria-label="Edit notes"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="bg-white/15 text-white hover:bg-white/25"
            onClick={handleExportPdf}
            disabled={exporting}
            aria-label="Export PDF"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="bg-white/15 text-white hover:bg-white/25"
            onClick={handleCopy}
            aria-label="Copy as Markdown"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="bg-white/15 text-white hover:bg-white/25"
            onClick={() => downloadText(filename, markdown)}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            .md
          </Button>
        </div>
      </div>

      <div className="space-y-5 p-5">
        {structured.summary && (
          <p className={`rounded-lg bg-muted/30 px-3 py-2 text-sm text-muted-foreground ${isUrdu ? 'text-right leading-loose' : ''}`}>
            {structured.summary}
          </p>
        )}

        <div className="space-y-3">
          {structured.keyPoints.map((kp, i) => (
            <div
              key={i}
              className={`flex gap-3 rounded-xl border border-border/60 bg-muted/20 p-3.5 transition-colors hover:bg-muted/40 ${isUrdu ? 'flex-row-reverse' : ''}`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-white shadow-sm">
                {String(i + 1).padStart(2, '0')}
              </div>
              <div className={`min-w-0 flex-1 ${isUrdu ? 'text-right' : ''}`}>
                <div className={`mb-1 font-semibold ${isUrdu ? 'leading-loose' : ''}`}>{kp.heading}</div>
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
              {structured.tags.map((t, i) => (
                <Badge key={i} variant="secondary" className="bg-amber-100/70 text-amber-800 hover:bg-amber-100">
                  <Hash className="mr-0.5 h-3 w-3" />
                  {t}
                </Badge>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function NotesView({ english, urdu, infographicEn, infographicUr, videoName, onEdit }: Props) {
  if (!english && !urdu) {
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
          onEdit={onEdit}
        />
      )}
      {urdu && (
        <NoteCard
          version={urdu}
          lang="urdu"
          infographic={infographicUr}
          videoName={videoName}
          onEdit={onEdit}
        />
      )}
    </div>
  )
}

/** Re-export for the page's "copy all" action. */
export { copyToClipboard }
export type { Props as NotesViewProps }
