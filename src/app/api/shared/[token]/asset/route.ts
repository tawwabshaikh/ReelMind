import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readArtifact } from '@/lib/artifact-storage'

export const runtime = 'nodejs'

const fieldByLanguage = {
  english: 'infographicEn',
  urdu: 'infographicUr',
  hinglish: 'infographicHi',
} as const

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const language = new URL(request.url).searchParams.get('language') as keyof typeof fieldByLanguage
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token) || !(language in fieldByLanguage)) {
    return NextResponse.json({ error: 'Infographic not found.' }, { status: 404 })
  }
  const note = await db.note.findFirst({ where: { shareToken: token } })
  const key = note?.[fieldByLanguage[language]]
  if (!key) return NextResponse.json({ error: 'Infographic not found.' }, { status: 404 })
  const artifact = await readArtifact(key)
  if (!artifact) return NextResponse.json({ error: 'Infographic file is missing.' }, { status: 404 })
  return new Response(artifact.stream, {
    headers: {
      'Content-Type': artifact.contentType,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
