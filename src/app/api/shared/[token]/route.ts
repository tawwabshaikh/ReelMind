import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { structuredNoteToMarkdown } from '@/lib/notes'
import type { NoteLanguage, NoteVersion, StructuredNote } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return NextResponse.json({ error: 'Shared note not found.' }, { status: 404 })
  const row = await db.note.findFirst({ where: { shareToken: token } })
  if (!row) return NextResponse.json({ error: 'Shared note not found.' }, { status: 404 })

  const parse = (source: string | null, language: NoteLanguage): NoteVersion | undefined => {
    if (!source) return undefined
    try {
      const structured = JSON.parse(source) as StructuredNote
      structured.language = language
      return { structured, markdown: structuredNoteToMarkdown(structured) }
    } catch { return undefined }
  }

  return NextResponse.json({ note: {
    id: row.id,
    videoName: row.videoName,
    language: row.language,
    createdAt: row.createdAt,
    transcript: row.transcript,
    durationSec: row.durationSec,
    sizeBytes: row.sizeBytes,
    wordCount: row.wordCount,
    english: parse(row.notesEn, 'english'),
    urdu: parse(row.notesUr, 'urdu'),
    hinglish: parse(row.notesHi, 'hinglish'),
    infographicEn: row.infographicEn ? { filename: row.infographicEn.split('/').pop()!, url: `/api/shared/${token}/asset?language=english` } : null,
    infographicUr: row.infographicUr ? { filename: row.infographicUr.split('/').pop()!, url: `/api/shared/${token}/asset?language=urdu` } : null,
    infographicHi: row.infographicHi ? { filename: row.infographicHi.split('/').pop()!, url: `/api/shared/${token}/asset?language=hinglish` } : null,
  } }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
}
