import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { StructuredNote } from '@/lib/types'

export const runtime = 'nodejs'

/** Extract + dedupe tags from a stored notes JSON string. */
function extractTags(json: string | null): string[] {
  if (!json) return []
  try {
    const n = JSON.parse(json) as StructuredNote
    if (!Array.isArray(n.tags)) return []
    return n.tags
      .filter((t) => typeof t === 'string' && t.trim())
      .map((t) => t.trim().toLowerCase())
  } catch {
    return []
  }
}

/**
 * GET /api/notes — list recent note-generation runs (metadata only),
 * with aggregated tags + media metrics for filtering/search in the history panel.
 */
export async function GET() {
  try {
    const rows = await db.note.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        videoName: true,
        language: true,
        notesEn: true,
        notesUr: true,
        infographicEn: true,
        infographicUr: true,
        durationSec: true,
        wordCount: true,
        createdAt: true,
      },
    })
    const normalised = rows.map((r) => {
      const enTags = extractTags(r.notesEn)
      const urTags = extractTags(r.notesUr)
      const tags = Array.from(new Set([...enTags, ...urTags])).slice(0, 12)
      return {
        id: r.id,
        videoName: r.videoName,
        language: r.language,
        createdAt: r.createdAt,
        hasEnglishNotes: !!r.notesEn,
        hasUrduNotes: !!r.notesUr,
        hasEnglishInfographic: !!r.infographicEn,
        hasUrduInfographic: !!r.infographicUr,
        infographicEnUrl: r.infographicEn ? `/generated/${r.infographicEn}` : null,
        infographicUrUrl: r.infographicUr ? `/generated/${r.infographicUr}` : null,
        tags,
        durationSec: r.durationSec,
        wordCount: r.wordCount,
      }
    })
    return NextResponse.json({ notes: normalised })
  } catch (err) {
    console.error('[/api/notes GET] error', err)
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 })
  }
}
