import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { structuredNoteToMarkdown } from '@/lib/notes'
import type { StructuredNote, NoteVersion } from '@/lib/types'

export const runtime = 'nodejs'

/**
 * GET /api/notes/[id] — full detail of a single note-generation run, so a
 * history row can be clicked to reload notes + transcript + infographics
 * back into the workspace without re-uploading the video.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Missing note id' }, { status: 400 })
  }
  try {
    const row = await db.note.findUnique({ where: { id } })
    if (!row) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const parse = (s: string | null, lang: 'english' | 'urdu'): NoteVersion | undefined => {
      if (!s) return undefined
      try {
        const structured = JSON.parse(s) as StructuredNote
        // Ensure language field is set correctly even on old rows
        structured.language = lang
        return { structured, markdown: structuredNoteToMarkdown(structured) }
      } catch {
        return undefined
      }
    }

    const english = parse(row.notesEn, 'english')
    const urdu = parse(row.notesUr, 'urdu')

    return NextResponse.json({
      note: {
        id: row.id,
        videoName: row.videoName,
        language: row.language,
        createdAt: row.createdAt,
        transcript: row.transcript,
        english,
        urdu,
        infographicEn: row.infographicEn ? { filename: row.infographicEn, url: `/generated/${row.infographicEn}` } : null,
        infographicUr: row.infographicUr ? { filename: row.infographicUr, url: `/generated/${row.infographicUr}` } : null,
      },
    })
  } catch (err) {
    console.error('[/api/notes/[id]] error', err)
    return NextResponse.json({ error: 'Failed to load note' }, { status: 500 })
  }
}
