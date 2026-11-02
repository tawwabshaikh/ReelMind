import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { db } from '@/lib/db'
import { currentUserId, noteOwnerScope } from '@/lib/session'
import { renderNotesSheetPng } from '@/lib/infographic'
import { structuredNoteToMarkdown } from '@/lib/notes'
import type { StructuredNote } from '@/lib/types'
import { makeArtifactKey, readArtifactBytes, storeArtifact } from '@/lib/artifact-storage'

export const runtime = 'nodejs'
export const maxDuration = 300

// A4 portrait in points
const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 48

function hexToRgb(hex: string) {
  const m = hex.replace('#', '')
  return rgb(parseInt(m.slice(0, 2), 16) / 255, parseInt(m.slice(2, 4), 16) / 255, parseInt(m.slice(4, 6), 16) / 255)
}
const ACCENT = hexToRgb('#047857')
const MUTED = hexToRgb('#64748b')

/**
 * POST /api/export-all — build a single combined PDF containing every note
 * in the database. For each note: a cover divider page, then the notes sheet
 * (rendered via Chromium for correct Urdu shaping), then the infographic PNG
 * (if it exists). Returns the filename + URL.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const body = (await req.json().catch(() => ({}))) as { language?: string }
    const langFilter = body?.language // 'english' | 'urdu' | 'hinglish' | undefined (all)

    const rows = await db.note.findMany({
      where: noteOwnerScope(userId),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        videoName: true,
        language: true,
        notesEn: true,
        notesUr: true,
        notesHi: true,
        infographicEn: true,
        infographicUr: true,
        infographicHi: true,
        createdAt: true,
      },
    })

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No notes to export.' }, { status: 400 })
    }

    const pdf = await PDFDocument.create()
    const regular = await pdf.embedFont(StandardFonts.Helvetica)
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

    const parseNote = (s: string | null, lang: 'english' | 'urdu' | 'hinglish'): StructuredNote | null => {
      if (!s) return null
      try {
        const n = JSON.parse(s) as StructuredNote
        n.language = lang
        return n
      } catch {
        return null
      }
    }

    let noteIndex = 0

    for (const row of rows) {
      const en = !langFilter || langFilter === 'english' ? parseNote(row.notesEn, 'english') : null
      const ur = !langFilter || langFilter === 'urdu' ? parseNote(row.notesUr, 'urdu') : null
      const hi = !langFilter || langFilter === 'hinglish' ? parseNote(row.notesHi, 'hinglish') : null
      if (!en && !ur && !hi) continue

      noteIndex++
      const isMultiple = rows.length > 1 || [en, ur, hi].filter(Boolean).length > 1

      // ---- Cover / divider page (only when there are multiple sections) ----
      if (isMultiple) {
        const cover = pdf.addPage([PAGE_W, PAGE_H])
        cover.drawRectangle({ x: 0, y: PAGE_H - 120, width: PAGE_W, height: 120, color: ACCENT })
        cover.drawText('REELMIND', {
          x: MARGIN,
          y: PAGE_H - 60,
          size: 18,
          font: bold,
          color: rgb(1, 1, 1),
        })
        cover.drawText(`Note ${noteIndex} of ${rows.length}`, {
          x: MARGIN,
          y: PAGE_H - 80,
          size: 10,
          font: regular,
          color: rgb(0.9, 0.95, 0.92),
        })
        const titleText = (en || ur)?.title || row.videoName
        // Sanitize for Helvetica (WinAnsi) — strip non-ASCII
        const safeTitle = titleText.replace(/[^\x20-\x7E]/g, '').slice(0, 60) || row.videoName.replace(/[^\x20-\x7E]/g, '')
        cover.drawText(safeTitle, { x: MARGIN, y: PAGE_H - 160, size: 20, font: bold, color: hexToRgb('#0f172a') })
        cover.drawText(`Source: ${row.videoName.replace(/[^\x20-\x7E]/g, '')}`, {
          x: MARGIN,
          y: PAGE_H - 180,
          size: 10,
          font: regular,
          color: MUTED,
        })
        cover.drawText(`Language: ${row.language}`, {
          x: MARGIN,
          y: PAGE_H - 196,
          size: 10,
          font: regular,
          color: MUTED,
        })
        cover.drawText(`Created: ${new Date(row.createdAt).toLocaleDateString()}`, {
          x: MARGIN,
          y: PAGE_H - 212,
          size: 10,
          font: regular,
          color: MUTED,
        })
      }

      // ---- Notes sheet pages (via Chromium for Urdu shaping) ----
      const addSheet = async (note: StructuredNote, infographicFilename: string | null) => {
        try {
          const sheetPng = await renderNotesSheetPng(note)
          const embedded = await pdf.embedPng(sheetPng)
          const p = pdf.addPage([PAGE_W, PAGE_H])
          const maxW = PAGE_W - MARGIN * 2
          const maxH = PAGE_H - MARGIN * 2
          const scale = Math.min(maxW / embedded.width, maxH / embedded.height)
          const drawW = embedded.width * scale
          const drawH = embedded.height * scale
          p.drawImage(embedded, {
            x: (PAGE_W - drawW) / 2,
            y: (PAGE_H - drawH) / 2,
            width: drawW,
            height: drawH,
          })
        } catch (err) {
          console.error('[export-all] sheet render failed for', note.language, err)
        }

        // Infographic page
        if (infographicFilename) {
          try {
            const pngBytes = await readArtifactBytes(infographicFilename)
            if (!pngBytes) return
            const png = await pdf.embedPng(pngBytes)
            const p = pdf.addPage([PAGE_W, PAGE_H])
            const maxW = PAGE_W - MARGIN * 2
            const maxH = PAGE_H - MARGIN * 2 - 30
            const scale = Math.min(maxW / png.width, maxH / png.height)
            const drawW = png.width * scale
            const drawH = png.height * scale
            p.drawImage(png, {
              x: (PAGE_W - drawW) / 2,
              y: (PAGE_H - drawH) / 2 + 10,
              width: drawW,
              height: drawH,
            })
          } catch {
            // skip if file missing
          }
        }
      }

      if (en) await addSheet(en, row.infographicEn)
      if (ur) await addSheet(ur, row.infographicUr)
      if (hi) await addSheet(hi, row.infographicHi)
    }

    if (pdf.getPageCount() === 0) {
      return NextResponse.json({ error: 'No notes matched the filter.' }, { status: 400 })
    }

    const bytes = await pdf.save()
    const filename = `pdf-all-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`
    const storageKey = makeArtifactKey(userId, filename)
    await storeArtifact(storageKey, bytes, 'application/pdf')
    const artifact = await db.artifact.create({ data: { userId, storageKey, filename, contentType: 'application/pdf' }, select: { id: true } })

    return NextResponse.json({
      filename,
      url: `/api/files/${artifact.id}`,
      notes: noteIndex,
      pages: pdf.getPageCount(),
    })
  } catch (err) {
    console.error('[/api/export-all] error', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Export-all failed' }, { status: 500 })
  }
}

// Keep structuredNoteToMarkdown import referenced (used by callers)
void structuredNoteToMarkdown
