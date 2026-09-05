import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * POST /api/notes/backfill — one-off maintenance: sets `wordCount` on existing
 * Note rows that have null metrics, derived from their stored transcript.
 * Also estimates `durationSec` from word count at ~150 wpm speaking rate when
 * the real duration is unavailable. Returns the number of rows updated.
 */
export async function POST() {
  try {
    const rows = await db.note.findMany({
      where: { wordCount: null },
      select: { id: true, transcript: true, durationSec: true },
    })

    let updated = 0
    for (const row of rows) {
      const words = row.transcript.split(/\s+/).filter(Boolean).length
      const estDuration = row.durationSec ?? Math.round((words / 150) * 60)
      await db.note.update({
        where: { id: row.id },
        data: { wordCount: words, durationSec: estDuration || null },
      })
      updated++
    }

    return NextResponse.json({ updated, total: rows.length })
  } catch (err) {
    console.error('[/api/notes/backfill] error', err)
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500 })
  }
}
