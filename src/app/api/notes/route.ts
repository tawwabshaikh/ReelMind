import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/notes — list recent note-generation runs (metadata only),
 * demonstrating that the selected language(s) + generated artifacts are persisted.
 */
export async function GET() {
  try {
    const rows = await db.note.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        videoName: true,
        language: true,
        notesEn: true,
        notesUr: true,
        infographicEn: true,
        infographicUr: true,
        createdAt: true,
      },
    })
    const normalised = rows.map((r) => ({
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
    }))
    return NextResponse.json({ notes: normalised })
  } catch (err) {
    console.error('[/api/notes GET] error', err)
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 })
  }
}
