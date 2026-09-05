import { NextRequest, NextResponse } from 'next/server'
import {
  generateNotes,
  structuredNoteToMarkdown,
  Language,
  StructuredNote,
} from '@/lib/notes'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const maxDuration = 300

interface GenerateNotesBody {
  transcript: string
  language: Language
  videoName?: string
  durationSec?: number | null
  sizeBytes?: number | null
  wordCount?: number | null
}

interface NoteVersionOutput {
  structured: StructuredNote
  markdown: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateNotesBody

    if (!body?.transcript || typeof body.transcript !== 'string' || !body.transcript.trim()) {
      return NextResponse.json({ error: 'Missing "transcript".' }, { status: 400 })
    }
    const language: Language =
      body.language === 'urdu' || body.language === 'both' || body.language === 'english'
        ? body.language
        : 'english'

    // 1) Generate structured notes via LLM (EN and/or UR)
    const generated = await generateNotes(body.transcript, language)

    const english: NoteVersionOutput | undefined = generated.english
      ? { structured: generated.english, markdown: structuredNoteToMarkdown(generated.english) }
      : undefined
    const urdu: NoteVersionOutput | undefined = generated.urdu
      ? { structured: generated.urdu, markdown: structuredNoteToMarkdown(generated.urdu) }
      : undefined

    // 2) Persist metadata to the database so each run is traceable.
    //    Notes are stored as JSON; infographic filenames are filled in later
    //    by /api/generate-infographic (or left null if not generated).
    let noteId: string | null = null
    try {
      const created = await db.note.create({
        data: {
          videoName: body.videoName || 'untitled',
          language,
          transcript: body.transcript,
          durationSec: typeof body.durationSec === 'number' && Number.isFinite(body.durationSec) ? body.durationSec : null,
          sizeBytes: typeof body.sizeBytes === 'number' && Number.isFinite(body.sizeBytes) ? Math.round(body.sizeBytes) : null,
          wordCount: typeof body.wordCount === 'number' && Number.isFinite(body.wordCount) ? Math.round(body.wordCount) : null,
          notesEn: english ? JSON.stringify(english.structured) : null,
          notesUr: urdu ? JSON.stringify(urdu.structured) : null,
        },
      })
      noteId = created.id
    } catch (dbErr) {
      // DB is best-effort metadata; don't fail the whole request if it hiccups.
      console.error('[/api/generate-notes] db error', dbErr)
    }

    return NextResponse.json({
      noteId,
      language,
      english,
      urdu,
    })
  } catch (err) {
    console.error('[/api/generate-notes] error', err)
    const message = err instanceof Error ? err.message : 'Unknown notes generation error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
