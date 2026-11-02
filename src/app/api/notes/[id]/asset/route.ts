import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readArtifact } from '@/lib/artifact-storage'
import { currentUserId, noteOwnerScope } from '@/lib/session'

export const runtime = 'nodejs'

const fieldByLanguage = {
  english: 'infographicEn',
  urdu: 'infographicUr',
  hinglish: 'infographicHi',
} as const

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const language = request.nextUrl.searchParams.get('language') as keyof typeof fieldByLanguage
  if (!(language in fieldByLanguage)) return NextResponse.json({ error: 'Unknown infographic language.' }, { status: 400 })

  const shareToken = request.nextUrl.searchParams.get('share')
  const userId = await currentUserId()
  const note = shareToken
    ? await db.note.findFirst({ where: { id, shareToken } })
    : userId
      ? await db.note.findFirst({ where: { id, ...noteOwnerScope(userId) } })
      : null
  if (!note) return NextResponse.json({ error: 'Infographic not found.' }, { status: 404 })

  const key = note[fieldByLanguage[language]]
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
