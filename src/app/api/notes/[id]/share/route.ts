import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { currentUserId, noteOwnerScope } from '@/lib/session'

export const runtime = 'nodejs'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { id } = await params
  const note = await db.note.findFirst({ where: { id, ...noteOwnerScope(userId) }, select: { id: true, shareToken: true } })
  if (!note) return NextResponse.json({ error: 'Note not found.' }, { status: 404 })

  const token = note.shareToken || randomBytes(32).toString('base64url')
  if (!note.shareToken) {
    await db.note.updateMany({ where: { id, ...noteOwnerScope(userId) }, data: { shareToken: token } })
  }
  const origin = process.env.NEXTAUTH_URL || new URL(_request.url).origin
  return NextResponse.json({ url: `${origin}/?share=${token}` })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { id } = await params
  await db.note.updateMany({ where: { id, ...noteOwnerScope(userId) }, data: { shareToken: null } })
  return NextResponse.json({ ok: true })
}
