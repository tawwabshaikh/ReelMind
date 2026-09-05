'use client'

import { Download, FileText, Tag, Hash, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { NoteVersion } from '@/lib/types'
import { slugify } from '@/lib/slugify-client'

interface Props {
  english?: NoteVersion
  urdu?: NoteVersion
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

function NoteCard({ version, lang }: { version: NoteVersion; lang: 'english' | 'urdu' }) {
  const isUrdu = lang === 'urdu'
  const { structured, markdown } = version
  const filename = `${slugify(structured.title)}-notes-${lang}.md`

  return (
    <div
      className={`rounded-2xl border bg-card shadow-sm overflow-hidden ${isUrdu ? 'font-urdu' : ''}`}
      dir={isUrdu ? 'rtl' : 'ltr'}
    >
      {/* Header band */}
      <div className="flex items-center justify-between gap-3 border-b bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-4 text-white">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-50/90">
            <FileText className="h-3.5 w-3.5" />
            {isUrdu ? 'اردو نوٹس' : 'English Notes'}
          </div>
          <h3 className={`text-lg font-bold leading-snug ${isUrdu ? 'leading-loose' : ''}`}>
            {structured.title}
          </h3>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0 bg-white/15 text-white hover:bg-white/25"
          onClick={() => downloadText(filename, markdown)}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          .md
        </Button>
      </div>

      <div className="space-y-5 p-5">
        {structured.summary && (
          <p className={`text-sm text-muted-foreground ${isUrdu ? 'text-right leading-loose' : ''}`}>
            {structured.summary}
          </p>
        )}

        <div className="space-y-3">
          {structured.keyPoints.map((kp, i) => (
            <div
              key={i}
              className={`flex gap-3 rounded-xl border border-border/60 bg-muted/30 p-3.5 ${isUrdu ? 'flex-row-reverse' : ''}`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-sm font-bold text-emerald-700">
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

export function NotesView({ english, urdu }: Props) {
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
      {english && <NoteCard version={english} lang="english" />}
      {urdu && <NoteCard version={urdu} lang="urdu" />}
    </div>
  )
}
