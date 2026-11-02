import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deleteArtifact } from '@/lib/artifact-storage'
import { currentUserId, noteOwnerScope } from '@/lib/session'

export const runtime = 'nodejs'

interface Body {
  ids?: string[]
  /** When true, permanently remove the rows + clean up PNGs. Default: soft-delete (set deletedAt). */
  permanent?: boolean
}

/**
 * POST /api/notes/bulk-delete — delete multiple notes. By default soft-deletes
 * (sets deletedAt so they go to the trash and can be restored). Pass
 * `{permanent: true}` to permanently remove rows + clean up PNGs. Returns counts.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const body = (await req.json()) as Body
    const permanent = !!body?.permanent
    const ids = Array.isArray(body?.ids) ? body.ids.filter((x) => typeof x === 'string' && x.trim()) : []
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Provide a non-empty "ids" array.' }, { status: 400 })
    }

    if (!permanent) {
      // Soft-delete: mark as trashed.
      const result = await db.note.updateMany({
        where: { id: { in: ids }, ...noteOwnerScope(userId), deletedAt: null },
        data: { deletedAt: new Date() },
      })
      return NextResponse.json({
        ok: true,
        soft: true,
        trashed: result.count,
        requested: ids.length,
      })
    }

    // Permanent delete: fetch files, clean up PNGs, then remove rows.
    const rows = await db.note.findMany({
      where: { id: { in: ids }, ...noteOwnerScope(userId) },
      select: { id: true, infographicEn: true, infographicUr: true, infographicHi: true },
    })
    const files: string[] = []
    for (const r of rows) {
      if (r.infographicEn) files.push(r.infographicEn)
      if (r.infographicUr) files.push(r.infographicUr)
      if (r.infographicHi) files.push(r.infographicHi)
    }
    const pdfArtifacts = await db.artifact.findMany({ where: { noteId: { in: rows.map((row) => row.id) }, userId }, select: { id: true, storageKey: true } })
    await Promise.all([...files, ...pdfArtifacts.map((artifact) => artifact.storageKey)].map((key) => deleteArtifact(key).catch(() => {})))
    await db.artifact.deleteMany({ where: { noteId: { in: rows.map((row) => row.id) }, userId } })

    const result = await db.note.deleteMany({ where: { id: { in: ids }, ...noteOwnerScope(userId) } })
    return NextResponse.json({
      ok: true,
      permanent: true,
      deleted: result.count,
      requested: ids.length,
      deletedFiles: files.length,
    })
  } catch (err) {
    console.error('[/api/notes/bulk-delete] error', err)
    return NextResponse.json({ error: 'Bulk delete failed' }, { status: 500 })
  }
}
