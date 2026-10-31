import { NextRequest, NextResponse } from 'next/server'
import { StructuredNote } from '@/lib/notes'
import type { NoteLanguage } from '@/lib/types'
import { renderInfographic, renderInfographics, INFOGRAPHIC_DIMENSIONS, isTheme } from '@/lib/infographic'
import { db } from '@/lib/db'

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
    const body = (await req.json()) as InfographicBody

    if (!body.english && !body.urdu && !body.hinglish) {
      return NextResponse.json({ error: 'Provide at least one set of structured notes.' }, { status: 400 })
    }

    const theme = isTheme(body.theme) ? body.theme : 'emerald'

    // Validate + normalise language field on each note (in case the client omitted it)
    const normalise = (n: StructuredNote | undefined, lang: NoteLanguage) => {
      if (!n) return undefined
      return { ...n, language: lang }
    }
    const en = normalise(body.english, 'english')
    const ur = normalise(body.urdu, 'urdu')
    const hi = normalise(body.hinglish, 'hinglish')

    const files = await renderInfographics({ english: en, urdu: ur, hinglish: hi }, theme)

    // Persist the generated filenames back onto the Note record (if we have an id).
    if (body.noteId) {
      try {
        await db.note.update({
          where: { id: body.noteId },
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
      english: files.english ? { filename: files.english, url: `/generated/${files.english}` } : null,
      urdu: files.urdu ? { filename: files.urdu, url: `/generated/${files.urdu}` } : null,
      hinglish: files.hinglish ? { filename: files.hinglish, url: `/generated/${files.hinglish}` } : null,
      dimensions: INFOGRAPHIC_DIMENSIONS,
      theme,
    })
  } catch (err) {
    console.error('[/api/generate-infographic] error', err)
    const message = err instanceof Error ? err.message : 'Unknown infographic generation error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Helper export for callers that want single-note rendering without the wrapper.
export { renderInfographic }
