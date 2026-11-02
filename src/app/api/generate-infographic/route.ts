import { NextRequest, NextResponse } from 'next/server'
import { StructuredNote } from '@/lib/notes'
import type { NoteLanguage } from '@/lib/types'
import { renderInfographics, INFOGRAPHIC_DIMENSIONS, isTheme } from '@/lib/infographic'
import { db } from '@/lib/db'
import { currentUserId, noteOwnerScope } from '@/lib/session'

export const runtime = 'nodejs'
// Playwright chromium launch + screenshot.
export const maxDuration = 120

interface InfographicBody {
  english?: StructuredNote
  urdu?: StructuredNote
  hinglish?: StructuredNote
  noteId?: string | null
  theme?: string
}

export async function POST(req: NextRequest) {
  try {
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const body = (await req.json()) as InfographicBody

    if (!body.english && !body.urdu && !body.hinglish) {
      return NextResponse.json({ error: 'Provide at least one set of structured notes.' }, { status: 400 })
    }

    const theme = isTheme(body.theme) ? body.theme : 'emerald'
    if (!body.noteId) return NextResponse.json({ error: 'Save the note before generating its infographic.' }, { status: 400 })
    const ownedNote = await db.note.findFirst({ where: { id: body.noteId, ...noteOwnerScope(userId) }, select: { id: true } })
    if (!ownedNote) return NextResponse.json({ error: 'Note not found in your account.' }, { status: 404 })

    // Validate + normalise language field on each note (in case the client omitted it)
    const normalise = (n: StructuredNote | undefined, lang: NoteLanguage) => {
      if (!n) return undefined
      return { ...n, language: lang }
    }
    const en = normalise(body.english, 'english')
    const ur = normalise(body.urdu, 'urdu')
    const hi = normalise(body.hinglish, 'hinglish')

    const files = await renderInfographics({ english: en, urdu: ur, hinglish: hi }, userId, theme)

    // Persist the generated filenames back onto the Note record (if we have an id).
    if (body.noteId) {
      try {
        await db.note.updateMany({
          where: { id: body.noteId, ...noteOwnerScope(userId) },
          data: {
            infographicEn: files.english ?? undefined,
            infographicUr: files.urdu ?? undefined,
            infographicHi: files.hinglish ?? undefined,
          },
        })
      } catch (dbErr) {
        console.error('[/api/generate-infographic] db update error', dbErr)
      }
    }

    return NextResponse.json({
      english: files.english ? { filename: files.english.split('/').pop()!, url: `/api/notes/${body.noteId}/asset?language=english` } : null,
      urdu: files.urdu ? { filename: files.urdu.split('/').pop()!, url: `/api/notes/${body.noteId}/asset?language=urdu` } : null,
      hinglish: files.hinglish ? { filename: files.hinglish.split('/').pop()!, url: `/api/notes/${body.noteId}/asset?language=hinglish` } : null,
      dimensions: INFOGRAPHIC_DIMENSIONS,
      theme,
    })
  } catch (err) {
    console.error('[/api/generate-infographic] error', err)
    const message = err instanceof Error ? err.message : 'Unknown infographic generation error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
