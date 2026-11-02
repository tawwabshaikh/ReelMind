import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { structuredNoteToMarkdown } from '@/lib/notes'
import type { StructuredNote, NoteVersion, NoteLanguage } from '@/lib/types'
import { currentUserId, noteOwnerScope } from '@/lib/session'

export const runtime = 'nodejs'

/**
 * GET /api/notes/compare?a=<id>&b=<id> — fetch two notes for side-by-side
 * comparison. Returns both notes' full detail (structured + markdown) so the
 * frontend can render a comparison view without two separate round-trips.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
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
      db.note.findFirst({ where: { id: aId, ...noteOwnerScope(userId) } }),
      db.note.findFirst({ where: { id: bId, ...noteOwnerScope(userId) } }),
    ])
    if (!rowA) return NextResponse.json({ error: `Note ${aId} not found.` }, { status: 404 })
    if (!rowB) return NextResponse.json({ error: `Note ${bId} not found.` }, { status: 404 })

    const toVersion = (s: string | null, lang: NoteLanguage): NoteVersion | undefined => {
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
        hinglish: toVersion(rowA.notesHi, 'hinglish'),
        infographicEn: rowA.infographicEn ? { filename: rowA.infographicEn.split('/').pop()!, url: `/api/notes/${rowA.id}/asset?language=english` } : null,
        infographicUr: rowA.infographicUr ? { filename: rowA.infographicUr.split('/').pop()!, url: `/api/notes/${rowA.id}/asset?language=urdu` } : null,
        infographicHi: rowA.infographicHi ? { filename: rowA.infographicHi.split('/').pop()!, url: `/api/notes/${rowA.id}/asset?language=hinglish` } : null,
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
        hinglish: toVersion(rowB.notesHi, 'hinglish'),
        infographicEn: rowB.infographicEn ? { filename: rowB.infographicEn.split('/').pop()!, url: `/api/notes/${rowB.id}/asset?language=english` } : null,
        infographicUr: rowB.infographicUr ? { filename: rowB.infographicUr.split('/').pop()!, url: `/api/notes/${rowB.id}/asset?language=urdu` } : null,
        infographicHi: rowB.infographicHi ? { filename: rowB.infographicHi.split('/').pop()!, url: `/api/notes/${rowB.id}/asset?language=hinglish` } : null,
      },
    })
  } catch (err) {
    console.error('[/api/notes/compare] error', err)
    return NextResponse.json({ error: 'Comparison failed' }, { status: 500 })
  }
}
