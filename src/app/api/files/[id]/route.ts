import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readArtifact } from '@/lib/artifact-storage'
import { currentUserId } from '@/lib/session'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const shareToken = request.nextUrl.searchParams.get('share')
  const userId = await currentUserId()
  const artifact = shareToken && /^[A-Za-z0-9_-]{40,50}$/.test(shareToken)
    ? await db.artifact.findFirst({ where: { id, shareToken } })
    : userId
      ? await db.artifact.findFirst({ where: { id, userId } })
      : null
  if (!artifact) return NextResponse.json({ error: 'File not found.' }, { status: 404 })
  if (shareToken && artifact.noteId) {
    const sharedNote = await db.note.findFirst({ where: { id: artifact.noteId, shareToken } })
    if (!sharedNote) return NextResponse.json({ error: 'File not found.' }, { status: 404 })
  }

  const stored = await readArtifact(artifact.storageKey)
  if (!stored) return NextResponse.json({ error: 'File is no longer available.' }, { status: 404 })
  return new Response(stored.stream, {
    headers: {
      'Content-Type': artifact.contentType,
      'Content-Disposition': `attachment; filename="${artifact.filename.replace(/[^A-Za-z0-9._-]/g, '_')}"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
