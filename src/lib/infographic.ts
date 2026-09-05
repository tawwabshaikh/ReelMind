import { chromium } from 'playwright'
import { promises as fs } from 'fs'
import path from 'path'
import { StructuredNote } from './notes'

const FONT_DIR = path.join(process.cwd(), 'public', 'fonts')
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'generated')

const NASTALIQ_REGULAR = path.join(FONT_DIR, 'NotoNastaliqUrdu-Regular.ttf')
const NASTALIQ_BOLD = path.join(FONT_DIR, 'NotoNastaliqUrdu-Bold.ttf')

// Instagram-friendly portrait dimensions
const INFOGRAPHIC_WIDTH = 1080
const INFOGRAPHIC_HEIGHT = 1350

function fileUrl(p: string): string {
  return 'file://' + p.replace(/ /g, '%20')
}

// ---------------------------------------------------------------------------
// HTML template
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const PALETTE = {
  // Warm emerald + amber on a deep slate canvas — distinctive, not the default blue.
  bgGradientTop: '#0f2e2a',
  bgGradientBottom: '#1a3c36',
  cardBg: '#ffffff',
  cardBorder: '#e2e8f0',
  titleColor: '#ffffff',
  summaryColor: '#cbd5d1',
  accent: '#10b981', // emerald-500
  accentDark: '#047857', // emerald-700
  amber: '#f59e0b', // amber-500
  pointHeading: '#0f2e2a',
  pointDetail: '#475569',
  tagBg: '#fef3c7', // amber-100
  tagText: '#92400e', // amber-800
  footerColor: '#94a3a0',
  badgeBg: '#10b981',
  badgeText: '#ffffff',
}

function buildInfographicHtml(note: StructuredNote): string {
  const isUrdu = note.language === 'urdu'
  const dir = isUrdu ? 'rtl' : 'ltr'
  const lang = isUrdu ? 'ur' : 'en'
  const fontFamily = isUrdu
    ? "'Noto Nastaliq Urdu', 'NotoNastaliq', serif"
    : "'Inter', 'Helvetica Neue', Arial, sans-serif"
  // Nastaliq needs more vertical room and larger line height
  const lineHeight = isUrdu ? '2.2' : '1.6'
  const titleSize = isUrdu ? '54px' : '46px'
  const headingSize = isUrdu ? '30px' : '22px'
  const detailSize = isUrdu ? '24px' : '18px'
  const summarySize = isUrdu ? '26px' : '19px'

  // Number badges: 01, 02, ... — universal, no semantic-icon guessing needed.
  const pointCards = note.keyPoints
    .map((kp, i) => {
      const num = String(i + 1).padStart(2, '0')
      const badgeAlign = isUrdu ? 'right' : 'left'
      return `
      <div class="point" style="border-${badgeAlign}: 5px solid ${PALETTE.accent};">
        <div class="badge">${num}</div>
        <div class="point-body">
          <div class="point-heading">${escapeHtml(kp.heading)}</div>
          <div class="point-detail">${escapeHtml(kp.detail)}</div>
        </div>
      </div>`
    })
    .join('\n')

  const tagPills = note.tags
    .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
    .join('')

  const fontFaces = isUrdu
    ? `
    @font-face {
      font-family: 'Noto Nastaliq Urdu';
      src: url('${fileUrl(NASTALIQ_REGULAR)}') format('truetype');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'Noto Nastaliq Urdu';
      src: url('${fileUrl(NASTALIQ_BOLD)}') format('truetype');
      font-weight: 700;
      font-style: normal;
    }`
    : ''

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<style>
  ${fontFaces}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${INFOGRAPHIC_WIDTH}px;
    height: ${INFOGRAPHIC_HEIGHT}px;
  }
  body {
    font-family: ${fontFamily};
    background: linear-gradient(160deg, ${PALETTE.bgGradientTop} 0%, ${PALETTE.bgGradientBottom} 100%);
    color: ${PALETTE.titleColor};
    padding: 56px 52px;
    display: flex;
    flex-direction: column;
    line-height: ${lineHeight};
    -webkit-font-smoothing: antialiased;
  }

  /* ---- Header ---- */
  .header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 22px;
  }
  .logo-dot {
    width: 14px; height: 14px; border-radius: 50%;
    background: ${PALETTE.amber};
    box-shadow: 0 0 0 4px rgba(245,158,11,0.25);
    flex-shrink: 0;
  }
  .brand {
    font-size: 18px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: ${PALETTE.accent};
    font-weight: 700;
  }
  .lang-pill {
    margin-inline-start: auto;
    background: rgba(16,185,129,0.18);
    color: ${PALETTE.accent};
    border: 1px solid rgba(16,185,129,0.4);
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 1px;
  }

  /* ---- Title block ---- */
  .title-wrap {
    margin-bottom: 18px;
  }
  .title {
    font-size: ${titleSize};
    font-weight: 700;
    line-height: ${isUrdu ? '1.7' : '1.2'};
    color: ${PALETTE.titleColor};
  }
  .summary {
    margin-top: 14px;
    font-size: ${summarySize};
    color: ${PALETTE.summaryColor};
    line-height: ${isUrdu ? '2.0' : '1.5'};
  }

  .divider {
    height: 3px;
    width: 64px;
    background: ${PALETTE.amber};
    border-radius: 2px;
    margin: 20px 0;
  }

  /* ---- Points ---- */
  .points {
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex: 1;
  }
  .point {
    background: ${PALETTE.cardBg};
    border-radius: 16px;
    padding: 22px 24px;
    display: flex;
    align-items: flex-start;
    gap: 18px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
  }
  .badge {
    flex-shrink: 0;
    width: 46px; height: 46px;
    border-radius: 12px;
    background: linear-gradient(135deg, ${PALETTE.accent}, ${PALETTE.accentDark});
    color: ${PALETTE.badgeText};
    display: flex; align-items: center; justify-content: center;
    font-weight: 700;
    font-size: 20px;
    font-family: 'Inter', Arial, sans-serif;
    box-shadow: 0 4px 10px rgba(16,185,129,0.35);
  }
  .point-body { flex: 1; min-width: 0; }
  .point-heading {
    font-size: ${headingSize};
    font-weight: 700;
    color: ${PALETTE.pointHeading};
    margin-bottom: 6px;
    line-height: ${isUrdu ? '1.9' : '1.3'};
  }
  .point-detail {
    font-size: ${detailSize};
    color: ${PALETTE.pointDetail};
    line-height: ${isUrdu ? '2.0' : '1.5'};
  }

  /* ---- Tags ---- */
  .tags-wrap {
    margin-top: 22px;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .tag {
    background: ${PALETTE.tagBg};
    color: ${PALETTE.tagText};
    border: 1px solid rgba(245,158,11,0.35);
    padding: 7px 16px;
    border-radius: 999px;
    font-size: 15px;
    font-weight: 600;
  }

  /* ---- Footer ---- */
  .footer {
    margin-top: 26px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: ${PALETTE.footerColor};
    font-size: 13px;
    letter-spacing: 1px;
  }
  .footer .gen {
    text-transform: uppercase;
    font-weight: 600;
  }
</style>
</head>
<body>
  <div class="header">
    <span class="logo-dot"></span>
    <span class="brand">Reel → Notes</span>
    <span class="lang-pill">${isUrdu ? 'اردو' : 'ENGLISH'}</span>
  </div>

  <div class="title-wrap">
    <div class="title">${escapeHtml(note.title)}</div>
    ${note.summary ? `<div class="summary">${escapeHtml(note.summary)}</div>` : ''}
  </div>

  <div class="divider"></div>

  <div class="points">
    ${pointCards}
  </div>

  ${tagPills ? `<div class="tags-wrap">${tagPills}</div>` : ''}

  <div class="footer">
    <span class="gen">Generated by Reel → Notes</span>
    <span>${new Date().toISOString().slice(0, 10)}</span>
  </div>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

async function ensureOutputDir(): Promise<void> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
}

/**
 * Render a structured note into a PNG infographic (1080×1350).
 * Returns the filename (served from /generated/<filename>).
 */
export async function renderInfographic(note: StructuredNote): Promise<string> {
  await ensureOutputDir()
  const html = buildInfographicHtml(note)

  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  try {
    const page = await browser.newPage({
      viewport: { width: INFOGRAPHIC_WIDTH, height: INFOGRAPHIC_HEIGHT },
      deviceScaleFactor: 2, // crisp 2x for high-DPI quality
    })
    await page.setContent(html, { waitUntil: 'networkidle' })
    // Give web fonts a beat to settle (local file:// fonts load fast).
    await page.waitForTimeout(250)
    const buf = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: INFOGRAPHIC_WIDTH, height: INFOGRAPHIC_HEIGHT },
      omitBackground: false,
    })
    const filename = `infographic-${note.language}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
    await fs.writeFile(path.join(OUTPUT_DIR, filename), buf)
    return filename
  } finally {
    await browser.close()
  }
}

/**
 * Render two infographics (one per language) for "both" mode.
 */
export async function renderInfographics(notes: {
  english?: StructuredNote
  urdu?: StructuredNote
}): Promise<{ english?: string; urdu?: string }> {
  const out: { english?: string; urdu?: string } = {}
  if (notes.english) out.english = await renderInfographic(notes.english)
  if (notes.urdu) out.urdu = await renderInfographic(notes.urdu)
  return out
}

export const INFOGRAPHIC_DIMENSIONS = { width: INFOGRAPHIC_WIDTH, height: INFOGRAPHIC_HEIGHT }
