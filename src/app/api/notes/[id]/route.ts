import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deleteArtifact } from '@/lib/artifact-storage'
import { structuredNoteToMarkdown } from '@/lib/notes'
import type { StructuredNote, NoteVersion, KeyPoint, NoteLanguage } from '@/lib/types'
import { currentUserId, noteOwnerScope } from '@/lib/session'

export const runtime = 'nodejs'

/**
 * GET /api/notes/[id] — full detail of a single note-generation run, so a
 * history row can be clicked to reload notes + transcript + infographics
 * back into the workspace without re-uploading the video.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Missing note id' }, { status: 400 })
  }
  try {
    const row = await db.note.findFirst({ where: { id, ...noteOwnerScope(userId) } })
    if (!row) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const parse = (s: string | null, lang: NoteLanguage): NoteVersion | undefined => {
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
    const hinglish = parse(row.notesHi, 'hinglish')

    return NextResponse.json({
      note: {
        id: row.id,
        videoName: row.videoName,
        language: row.language,
        createdAt: row.createdAt,
        transcript: row.transcript,
        durationSec: row.durationSec,
        sizeBytes: row.sizeBytes,
        wordCount: row.wordCount,
        english,
        urdu,
        hinglish,
        infographicEn: row.infographicEn ? { filename: row.infographicEn.split('/').pop()!, url: `/api/notes/${row.id}/asset?language=english` } : null,
        infographicUr: row.infographicUr ? { filename: row.infographicUr.split('/').pop()!, url: `/api/notes/${row.id}/asset?language=urdu` } : null,
        infographicHi: row.infographicHi ? { filename: row.infographicHi.split('/').pop()!, url: `/api/notes/${row.id}/asset?language=hinglish` } : null,
      },
    })
  } catch (err) {
    console.error('[/api/notes/[id]] GET error', err)
    return NextResponse.json({ error: 'Failed to load note' }, { status: 500 })
  }
}

interface PatchBody {
  english?: {
    title?: string
    summary?: string
    keyPoints?: KeyPoint[]
    tags?: string[]
    tagColors?: Record<string, string>
  }
  urdu?: {
    title?: string
    summary?: string
    keyPoints?: KeyPoint[]
    tags?: string[]
    tagColors?: Record<string, string>
  }
  hinglish?: {
    title?: string
    summary?: string
    keyPoints?: KeyPoint[]
    tags?: string[]
    tagColors?: Record<string, string>
  }
}

/**
 * PATCH /api/notes/[id] — inline-edit the structured notes (title/summary/
 * keyPoints/tags) for one or both languages. Used by the "Edit notes" UI
 * before regenerating an infographic. Returns the updated full note detail.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Missing note id' }, { status: 400 })
  }
  try {
    const body = (await req.json()) as PatchBody
    const row = await db.note.findFirst({ where: { id, ...noteOwnerScope(userId) } })
    if (!row) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const merge = (
      existingJson: string | null,
      lang: NoteLanguage,
      patch: PatchBody['english'],
    ): string | null => {
      let existing: StructuredNote | null = null
      if (existingJson) {
        try {
          existing = JSON.parse(existingJson) as StructuredNote
        } catch {
          existing = null
        }
      }
      if (!existing) {
        existing = { title: 'Untitled', summary: '', keyPoints: [], tags: [], language: lang }
      }
      existing.language = lang
      if (!patch) return JSON.stringify(existing)
      if (typeof patch.title === 'string') existing.title = patch.title.trim() || existing.title
      if (typeof patch.summary === 'string') existing.summary = patch.summary
      if (Array.isArray(patch.keyPoints)) {
        existing.keyPoints = patch.keyPoints
          .filter((kp) => kp && typeof kp === 'object')
          .slice(0, 6)
          .map((kp) => ({
            heading: String(kp.heading ?? '').trim() || 'Point',
            detail: String(kp.detail ?? '').trim(),
          }))
      }
      if (Array.isArray(patch.tags)) {
        existing.tags = patch.tags
          .filter((t) => typeof t === 'string' && t.trim())
          .map((t) => String(t).trim())
          .slice(0, 8)
      }
      if (patch.tagColors && typeof patch.tagColors === 'object') {
        // Persist the tagColors map; prune entries for tags no longer present.
        const validTags = new Set(existing.tags)
        const cleaned: Record<string, string> = {}
        for (const [tag, color] of Object.entries(patch.tagColors)) {
          if (validTags.has(tag) && typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) {
            cleaned[tag] = color
          }
        }
        existing.tagColors = Object.keys(cleaned).length > 0 ? cleaned : undefined
      }
      return JSON.stringify(existing)
    }

    const data: { notesEn?: string | null; notesUr?: string | null; notesHi?: string | null } = {}
    if (body.english) data.notesEn = merge(row.notesEn, 'english', body.english)
    if (body.urdu) data.notesUr = merge(row.notesUr, 'urdu', body.urdu)
    if (body.hinglish) data.notesHi = merge(row.notesHi, 'hinglish', body.hinglish)

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No editable fields provided.' }, { status: 400 })
    }

    const updated = await db.note.update({ where: { id }, data })

    const parse = (s: string | null, lang: NoteLanguage): NoteVersion | undefined => {
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
      note: {
        id: updated.id,
        videoName: updated.videoName,
        language: updated.language,
        createdAt: updated.createdAt,
        transcript: updated.transcript,
        durationSec: updated.durationSec,
        sizeBytes: updated.sizeBytes,
        wordCount: updated.wordCount,
        english: parse(updated.notesEn, 'english'),
        urdu: parse(updated.notesUr, 'urdu'),
        hinglish: parse(updated.notesHi, 'hinglish'),
        infographicEn: updated.infographicEn ? { filename: updated.infographicEn.split('/').pop()!, url: `/api/notes/${updated.id}/asset?language=english` } : null,
        infographicUr: updated.infographicUr ? { filename: updated.infographicUr.split('/').pop()!, url: `/api/notes/${updated.id}/asset?language=urdu` } : null,
        infographicHi: updated.infographicHi ? { filename: updated.infographicHi.split('/').pop()!, url: `/api/notes/${updated.id}/asset?language=hinglish` } : null,
      },
    })
  } catch (err) {
    console.error('[/api/notes/[id]] PATCH error', err)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

/**
 * DELETE /api/notes/[id] — soft-delete by default (sets deletedAt). Use
 * `?permanent=1` to permanently remove the row + clean up its PNGs.
 * Returns 200 on success (or 404 if the note didn't exist — idempotent-safe).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Missing note id' }, { status: 400 })
  }
  try {
    const permanent = new URL(req.url).searchParams.get('permanent') === '1'
    const row = await db.note.findFirst({ where: { id, ...noteOwnerScope(userId) } })
    if (!row) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    if (!permanent) {
      // Soft-delete: mark as trashed. The row + PNGs stay so it can be restored.
      await db.note.update({ where: { id }, data: { deletedAt: new Date() } })
      return NextResponse.json({ ok: true, id, soft: true })
    }

    // Permanent delete: clean up PNGs, then remove the row.
    const filesToDelete = [row.infographicEn, row.infographicUr, row.infographicHi].filter(Boolean) as string[]
    const pdfArtifacts = await db.artifact.findMany({ where: { noteId: id, userId }, select: { id: true, storageKey: true } })
    await Promise.all([...filesToDelete, ...pdfArtifacts.map((artifact) => artifact.storageKey)].map((key) => deleteArtifact(key).catch(() => {})))
    await db.artifact.deleteMany({ where: { noteId: id, userId } })

    await db.note.delete({ where: { id } })
    return NextResponse.json({ ok: true, id, permanent: true, deletedFiles: filesToDelete.length })
  } catch (err) {
    console.error('[/api/notes/[id]] DELETE error', err)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}

/**
 * PATCH /api/notes/[id]/restore — un-delete a soft-deleted note (clears
 * deletedAt). Reached via the trash view.
 */
export async function PUT(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Missing note id' }, { status: 400 })
  }
  try {
    const row = await db.note.findFirst({ where: { id, ...noteOwnerScope(userId) } })
    if (!row) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }
    if (!row.deletedAt) {
      return NextResponse.json({ ok: true, id, alreadyActive: true })
    }
    await db.note.update({ where: { id }, data: { deletedAt: null } })
    return NextResponse.json({ ok: true, id, restored: true })
  } catch (err) {
    console.error('[/api/notes/[id]] PUT (restore) error', err)
    return NextResponse.json({ error: 'Failed to restore note' }, { status: 500 })
  }
}
