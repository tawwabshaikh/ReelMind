import { NextRequest, NextResponse } from 'next/server'
import { exportNotePdf } from '@/lib/pdf-export'
import type { StructuredNote } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

interface Body {
  note: StructuredNote
  infographicUrl?: string | null
  videoName?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body
    if (!body?.note || !body.note.title) {
      return NextResponse.json({ error: 'Missing "note" structured data.' }, { status: 400 })
    }
    if (
      body.infographicUrl != null &&
      (typeof body.infographicUrl !== 'string' ||
        !/^\/?generated\/[A-Za-z0-9][A-Za-z0-9._-]*\.png$/.test(body.infographicUrl))
    ) {
      return NextResponse.json({ error: 'Infographic must be a generated PNG from this workspace.' }, { status: 400 })
    }
    // Normalise language field
    const note: StructuredNote = {
      ...body.note,
      language: body.note.language === 'urdu' ? 'urdu' : body.note.language === 'hinglish' ? 'hinglish' : 'english',
    }
    const filename = await exportNotePdf({
      note,
      infographicUrl: body.infographicUrl ?? null,
      videoName: body.videoName || 'untitled',
    })
    return NextResponse.json({
      filename,
      url: `/generated/${filename}`,
    })
  } catch (err) {
    console.error('[/api/export-pdf] error', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PDF export failed' },
      { status: 500 },
    )
  }
}
