import { NextRequest, NextResponse } from 'next/server'
import { AIProviderError, translateTranscriptToHinglish } from '@/lib/ai-provider'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { transcript?: unknown }
    if (typeof body.transcript !== 'string' || !body.transcript.trim()) {
      return NextResponse.json({ error: 'Missing transcript.' }, { status: 400 })
    }
    if (body.transcript.length > 500_000) {
      return NextResponse.json({ error: 'Transcript is too long to translate in one request.' }, { status: 413 })
    }

    const transcript = await translateTranscriptToHinglish(body.transcript)
    return NextResponse.json({ transcript })
  } catch (error) {
    console.error('[/api/translate-transcript] error', error)
    const message = error instanceof Error ? error.message : 'Unknown transcript translation error'
    const status = error instanceof AIProviderError ? error.status : 500
    return NextResponse.json({ error: message }, { status })
  }
}
