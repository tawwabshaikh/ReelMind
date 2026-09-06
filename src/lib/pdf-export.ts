import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib'
import { promises as fs } from 'fs'
import path from 'path'
import type { StructuredNote } from './types'
import { renderNotesSheetPng } from './infographic'

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'generated')

// A4 portrait in points (1pt = 1/72 inch). A4 = 595.28 × 841.89
const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 48

function hexToRgb(hex: string): rgb {
  const m = hex.replace('#', '')
  return rgb(
    parseInt(m.slice(0, 2), 16) / 255,
    parseInt(m.slice(2, 4), 16) / 255,
    parseInt(m.slice(4, 6), 16) / 255,
  )
}

const COLORS = {
  text: hexToRgb('#0f172a'),
  muted: hexToRgb('#64748b'),
  accent: hexToRgb('#047857'),
  amber: hexToRgb('#b45309'),
  badge: hexToRgb('#10b981'),
  rule: hexToRgb('#e2e8f0'),
  tagBg: hexToRgb('#fef3c7'),
  tagText: hexToRgb('#92400e'),
}

/**
 * pdf-lib's StandardFonts (Helvetica) only encode WinAnsi characters. Any
 * non-encodable char (e.g. "→", "·", Urdu Nastaliq) throws at draw time.
 * Sanitize text to the WinAnsi range so the PDF always builds. For Urdu
 * notes, the canonical artifact is the infographic PNG (rendered by Chromium
 * with full Nastaliq shaping); the PDF embeds that PNG as page 2.
 */
function sanitizeForPdf(s: string): string {
  if (!s) return ''
  // Replace common fancy punctuation with ASCII equivalents, then strip anything else outside WinAnsi.
  return s
    .replace(/[\u2010-\u2015]/g, '-') // dashes
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2026]/g, '...')
    .replace(/[·•]/g, '-')
    .replace(/[→]/g, '->')
    .replace(/[^\x20-\x7E]/g, '') // keep only printable ASCII
}

/**
 * Word-wrap a string to fit a given max width with a given font + size.
 * Returns an array of lines.
 */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const candidate = line ? line + ' ' + w : w
    const width = font.widthOfTextAtSize(candidate, size)
    if (width > maxWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

/**
 * Draw a wrapped paragraph. Returns the new Y cursor.
 */
function drawParagraph(
  page: PDFPage,
  font: PDFFont,
  text: string,
  opts: { x: number; y: number; size: number; maxWidth: number; color?: rgb; lineHeight?: number; align?: 'left' | 'right' },
): number {
  const { x, y, size, maxWidth } = opts
  const color = opts.color ?? COLORS.text
  const lineHeight = opts.lineHeight ?? size * 1.4
  const align = opts.align ?? 'left'
  const lines = wrap(sanitizeForPdf(text), font, size, maxWidth)
  let cursor = y
  for (const ln of lines) {
    const w = font.widthOfTextAtSize(ln, size)
    const drawX = align === 'right' ? x + (maxWidth - w) : x
    page.drawText(ln, { x: drawX, y: cursor, size, font, color })
    cursor -= lineHeight
  }
  return cursor
}

export interface ExportPdfInput {
  note: StructuredNote
  infographicUrl: string | null // local /generated/<file> path or null
  videoName: string
}

/**
 * Build a polished multi-page PDF: page 1 = the notes (title, summary, key
 * points, tags), page 2 = the infographic PNG (if provided) scaled to fit.
 * Returns the filename written to /public/generated/.
 */
export async function exportNotePdf(input: ExportPdfInput): Promise<string> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique)

  const { note, videoName } = input
  const isUrdu = note.language === 'urdu'

  // For Urdu notes, Helvetica can't shape Nastaliq. Instead of drawing Latin
  // text, render the notes as a clean HTML→PNG sheet via Chromium (which
  // shapes Urdu correctly) and embed it on page 1. English keeps the drawn-text
  // approach since Helvetica renders Latin fine.
  if (isUrdu) {
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
      console.error('[exportNotePdf] Urdu sheet render failed, falling back to infographic-only', err)
      // Fallback: blank page 1 (the infographic on page 2 still has the Urdu content)
      pdf.addPage([PAGE_W, PAGE_H])
    }
  } else {
  // -------- Page 1: Notes (English: drawn text) --------
  let page = pdf.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN
  const contentW = PAGE_W - MARGIN * 2

  // Header band
  page.drawRectangle({
    x: 0,
    y: PAGE_H - 90,
    width: PAGE_W,
    height: 90,
    color: COLORS.accent,
  })
  page.drawText('REELMIND', {
    x: MARGIN,
    y: PAGE_H - 42,
    size: 16,
    font: bold,
    color: rgb(1, 1, 1),
  })
  page.drawText(sanitizeForPdf(`${isUrdu ? 'URDU' : 'ENGLISH'} - ${videoName}`), {
    x: MARGIN,
    y: PAGE_H - 62,
    size: 9,
    font: regular,
    color: rgb(0.9, 0.95, 0.92),
  })
  // Lang pill (top-right)
  const pillText = isUrdu ? 'URDU' : 'EN'
  const pillW = bold.widthOfTextAtSize(pillText, 9) + 20
  page.drawRectangle({
    x: PAGE_W - MARGIN - pillW,
    y: PAGE_H - 50,
    width: pillW,
    height: 18,
    color: rgb(1, 1, 1),
    opacity: 0.18,
  })
  page.drawText(pillText, {
    x: PAGE_W - MARGIN - pillW + 10,
    y: PAGE_H - 44,
    size: 9,
    font: bold,
    color: rgb(1, 1, 1),
  })

  y = PAGE_H - 120

  // Title
  const titleLines = wrap(sanitizeForPdf(note.title), bold, 22, contentW)
  for (const ln of titleLines) {
    page.drawText(ln, { x: MARGIN, y, size: 22, font: bold, color: COLORS.text })
    y -= 28
  }
  y -= 8

  // Summary (italic, muted)
  if (note.summary) {
    y = drawParagraph(page, italic, note.summary, {
      x: MARGIN,
      y,
      size: 11,
      maxWidth: contentW,
      color: COLORS.muted,
      lineHeight: 16,
    })
    y -= 6
  }

  // Divider
  page.drawRectangle({ x: MARGIN, y, width: 48, height: 3, color: COLORS.amber })
  y -= 18

  // Key points
  for (let i = 0; i < note.keyPoints.length; i++) {
    const kp = note.keyPoints[i]
    // Page break if needed
    if (y < 140) {
      page = pdf.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - MARGIN
    }

    // Badge
    const num = String(i + 1).padStart(2, '0')
    const badgeSize = 22
    page.drawRectangle({
      x: MARGIN,
      y: y - badgeSize + 4,
      width: badgeSize,
      height: badgeSize,
      color: COLORS.badge,
    })
    page.drawText(num, {
      x: MARGIN + 5,
      y: y - badgeSize + 10,
      size: 10,
      font: bold,
      color: rgb(1, 1, 1),
    })

    // Heading
    const textX = MARGIN + badgeSize + 12
    const textW = contentW - badgeSize - 12
    const headingLines = wrap(sanitizeForPdf(kp.heading), bold, 13, textW)
    for (const ln of headingLines) {
      page.drawText(ln, { x: textX, y, size: 13, font: bold, color: COLORS.text })
      y -= 18
    }
    // Detail
    y = drawParagraph(page, regular, kp.detail, {
      x: textX,
      y,
      size: 10.5,
      maxWidth: textW,
      color: COLORS.muted,
      lineHeight: 15,
    })
    y -= 16
  }

  // Tags
  if (note.tags.length > 0) {
    if (y < 90) {
      page = pdf.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - MARGIN
    }
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 0.5,
      color: COLORS.rule,
    })
    y -= 18
    page.drawText('TAGS', { x: MARGIN, y, size: 8, font: bold, color: COLORS.muted })
    y -= 16
    let tx = MARGIN
    for (const tag of note.tags) {
      const safeTag = sanitizeForPdf(tag)
      if (!safeTag) continue
      const tw = regular.widthOfTextAtSize(safeTag, 9) + 16
      if (tx + tw > PAGE_W - MARGIN) {
        tx = MARGIN
        y -= 22
      }
      page.drawRectangle({ x: tx, y: y - 12, width: tw, height: 18, color: COLORS.tagBg })
      page.drawText(safeTag, { x: tx + 8, y: y - 7, size: 9, font: regular, color: COLORS.tagText })
      tx += tw + 6
    }
    y -= 28
  }

  // Footer
  page.drawText(sanitizeForPdf(`Generated by ReelMind - ${new Date().toISOString().slice(0, 10)}`), {
    x: MARGIN,
    y: 24,
    size: 8,
    font: regular,
    color: COLORS.muted,
  })
  } // end of English drawn-text branch

  // -------- Page 2: Infographic (if provided) --------
  if (input.infographicUrl) {
    const localPath = path.join(process.cwd(), 'public', input.infographicUrl.replace(/^\//, ''))
    try {
      const pngBytes = await fs.readFile(localPath)
      const png = await pdf.embedPng(pngBytes)
      const imgPage = pdf.addPage([PAGE_W, PAGE_H])
      // Scale to fit with margin
      const maxW = PAGE_W - MARGIN * 2
      const maxH = PAGE_H - MARGIN * 2 - 30
      const scale = Math.min(maxW / png.width, maxH / png.height)
      const drawW = png.width * scale
      const drawH = png.height * scale
      const drawX = (PAGE_W - drawW) / 2
      const drawY = (PAGE_H - drawH) / 2 + 10
      imgPage.drawRectangle({
        x: drawX - 4,
        y: drawY - 4,
        width: drawW + 8,
        height: drawH + 8,
        color: rgb(1, 1, 1),
      })
      imgPage.drawImage(png, { x: drawX, y: drawY, width: drawW, height: drawH })
      imgPage.drawText('Infographic', {
        x: MARGIN,
        y: 24,
        size: 8,
        font: regular,
        color: COLORS.muted,
      })
    } catch (err) {
      // If the image can't be embedded, skip page 2 silently — page 1 still has the notes.
      console.error('[exportNotePdf] image embed failed', err)
    }
  }

  const bytes = await pdf.save()
  const filename = `pdf-${note.language}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`
  await fs.writeFile(path.join(OUTPUT_DIR, filename), bytes)
  return filename
}
