import { NextRequest, NextResponse } from 'next/server'
import { exportNotePdf } from '@/lib/pdf-export'
import type { StructuredNote } from '@/lib/types'
import { currentUserId, noteOwnerScope } from '@/lib/session'
import { db } from '@/lib/db'
import { makeArtifactKey, readArtifactBytes, storeArtifact } from '@/lib/artifact-storage'

export const runtime = 'nodejs'
export const maxDuration = 60

interface Body {
  note: StructuredNote
  noteId: string
  shareToken?: string | null
  videoName?: string
}

export async function POST(req: NextRequest) {
  try {
    const userId = await currentUserId()
    const body = (await req.json()) as Body
    if (!userId && !body?.shareToken) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    if (!body?.note || !body.note.title) {
      return NextResponse.json({ error: 'Missing "note" structured data.' }, { status: 400 })
    }
    if (!body.noteId) return NextResponse.json({ error: 'Missing note ID.' }, { status: 400 })
    const sourceNote = body.shareToken
      ? await db.note.findFirst({ where: { id: body.noteId, shareToken: body.shareToken } })
      : userId ? await db.note.findFirst({ where: { id: body.noteId, ...noteOwnerScope(userId) } }) : null
    if (!sourceNote) return NextResponse.json({ error: 'Note not found.' }, { status: 404 })
    // Normalise language field
    const structuredNote: StructuredNote = {
      ...body.note,
      language: body.note.language === 'urdu' ? 'urdu' : body.note.language === 'hinglish' ? 'hinglish' : 'english',
    }
    const infographicKey = structuredNote.language === 'urdu' ? sourceNote.infographicUr : structuredNote.language === 'hinglish' ? sourceNote.infographicHi : sourceNote.infographicEn
    const infographicBytes = infographicKey ? await readArtifactBytes(infographicKey) : null
    const bytes = await exportNotePdf({
      note: structuredNote,
      infographicBytes,
      videoName: body.videoName || 'untitled',
    })
    const filename = `pdf-${structuredNote.language}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`
    const ownerId = sourceNote.userId || userId
    if (!ownerId) throw new Error('Could not identify the note owner.')
    const storageKey = makeArtifactKey(ownerId, filename)
    await storeArtifact(storageKey, bytes, 'application/pdf')
    const artifact = await db.artifact.create({
      data: { userId: ownerId, noteId: sourceNote.id, storageKey, filename, contentType: 'application/pdf', shareToken: body.shareToken || null },
      select: { id: true },
    })
    return NextResponse.json({
      filename,
      url: `/api/files/${artifact.id}${body.shareToken ? `?share=${encodeURIComponent(body.shareToken)}` : ''}`,
    })
  } catch (err) {
    console.error('[/api/export-pdf] error', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PDF export failed' },
      { status: 500 },
    )
  }
}
