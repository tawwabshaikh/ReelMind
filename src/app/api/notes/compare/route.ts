import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { structuredNoteToMarkdown } from '@/lib/notes'
import type { StructuredNote, NoteVersion } from '@/lib/types'

export const runtime = 'nodejs'

/**
 * GET /api/notes/compare?a=<id>&b=<id> — fetch two notes for side-by-side
 * comparison. Returns both notes' full detail (structured + markdown) so the
 * frontend can render a comparison view without two separate round-trips.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const aId = searchParams.get('a')
    const bId = searchParams.get('b')
    if (!aId || !bId) {
      return NextResponse.json({ error: 'Provide both "a" and "b" note ids.' }, { status: 400 })
    }
    if (aId === bId) {
      return NextResponse.json({ error: 'Cannot compare a note with itself.' }, { status: 400 })
    }

    const [rowA, rowB] = await Promise.all([
      db.note.findUnique({ where: { id: aId } }),
      db.note.findUnique({ where: { id: bId } }),
    ])
    if (!rowA) return NextResponse.json({ error: `Note ${aId} not found.` }, { status: 404 })
    if (!rowB) return NextResponse.json({ error: `Note ${bId} not found.` }, { status: 404 })

    const toVersion = (s: string | null, lang: 'english' | 'urdu'): NoteVersion | undefined => {
      if (!s) return undefined
      try {
        const structured = JSON.parse(s) as StructuredNote
        structured.language = lang
        return { structured, markdown: structuredNoteToMarkdown(structured) }
      } catch {
        return undefined
      }
    }

    return NextResponse.json({
      a: {
        id: rowA.id,
        videoName: rowA.videoName,
        language: rowA.language,
        createdAt: rowA.createdAt,
        durationSec: rowA.durationSec,
        wordCount: rowA.wordCount,
        english: toVersion(rowA.notesEn, 'english'),
        urdu: toVersion(rowA.notesUr, 'urdu'),
        infographicEn: rowA.infographicEn ? { filename: rowA.infographicEn, url: `/generated/${rowA.infographicEn}` } : null,
        infographicUr: rowA.infographicUr ? { filename: rowA.infographicUr, url: `/generated/${rowA.infographicUr}` } : null,
      },
      b: {
        id: rowB.id,
        videoName: rowB.videoName,
        language: rowB.language,
        createdAt: rowB.createdAt,
        durationSec: rowB.durationSec,
        wordCount: rowB.wordCount,
        english: toVersion(rowB.notesEn, 'english'),
        urdu: toVersion(rowB.notesUr, 'urdu'),
        infographicEn: rowB.infographicEn ? { filename: rowB.infographicEn, url: `/generated/${rowB.infographicEn}` } : null,
        infographicUr: rowB.infographicUr ? { filename: rowB.infographicUr, url: `/generated/${rowB.infographicUr}` } : null,
      },
    })
  } catch (err) {
    console.error('[/api/notes/compare] error', err)
    return NextResponse.json({ error: 'Comparison failed' }, { status: 500 })
  }
}
