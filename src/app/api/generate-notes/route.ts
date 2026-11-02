import { NextRequest, NextResponse } from 'next/server'
import {
  generateNotes,
  structuredNoteToMarkdown,
  StructuredNote,
} from '@/lib/notes'
import { db } from '@/lib/db'
import { AIProviderError } from '@/lib/ai-provider'
import type { NoteLanguage } from '@/lib/types'
import { currentUserId } from '@/lib/session'

export const runtime = 'nodejs'
export const maxDuration = 300

interface GenerateNotesBody {
  transcript: string
  language: NoteLanguage
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
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const body = (await req.json()) as GenerateNotesBody

    if (!body?.transcript || typeof body.transcript !== 'string' || !body.transcript.trim()) {
      return NextResponse.json({ error: 'Missing "transcript".' }, { status: 400 })
    }
    const language: NoteLanguage =
      body.language === 'urdu' || body.language === 'hinglish' || body.language === 'english'
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
    const hinglish: NoteVersionOutput | undefined = generated.hinglish
      ? { structured: generated.hinglish, markdown: structuredNoteToMarkdown(generated.hinglish) }
      : undefined

    // 2) Persist metadata to the database so each run is traceable.
    //    Notes are stored as JSON; infographic filenames are filled in later
    //    by /api/generate-infographic (or left null if not generated).
    let noteId: string
    try {
      const created = await db.note.create({
        data: {
          userId,
          videoName: body.videoName || 'untitled',
          language,
          transcript: body.transcript,
          durationSec: typeof body.durationSec === 'number' && Number.isFinite(body.durationSec) ? body.durationSec : null,
          sizeBytes: typeof body.sizeBytes === 'number' && Number.isFinite(body.sizeBytes) ? Math.round(body.sizeBytes) : null,
          wordCount: typeof body.wordCount === 'number' && Number.isFinite(body.wordCount) ? Math.round(body.wordCount) : null,
          notesEn: english ? JSON.stringify(english.structured) : null,
          notesUr: urdu ? JSON.stringify(urdu.structured) : null,
          notesHi: hinglish ? JSON.stringify(hinglish.structured) : null,
        },
      })
      noteId = created.id
    } catch (dbErr) {
      console.error('[/api/generate-notes] db error', dbErr)
      return NextResponse.json({ error: 'Could not save this note. Please retry.' }, { status: 503 })
    }

    return NextResponse.json({
      noteId,
      language,
      english,
      urdu,
      hinglish,
    })
  } catch (err) {
    console.error('[/api/generate-notes] error', err)
    const message = err instanceof Error ? err.message : 'Unknown notes generation error'
    const status = err instanceof AIProviderError ? err.status : 500
    return NextResponse.json({ error: message }, { status })
  }
}
