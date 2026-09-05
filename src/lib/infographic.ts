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
// Themes
// ---------------------------------------------------------------------------

export type Theme = 'emerald' | 'midnight' | 'sunrise'

const THEME_SET: ReadonlySet<string> = new Set(['emerald', 'midnight', 'sunrise'])

/** Runtime type guard for a theme string coming from the client. */
export function isTheme(v: unknown): v is Theme {
  return typeof v === 'string' && THEME_SET.has(v)
}

export interface ThemeMeta {
  id: Theme
  label: string
  urdu: string
  swatch: string[] // for UI swatch preview
}

export const THEMES: ThemeMeta[] = [
  { id: 'emerald', label: 'Emerald', urdu: 'زمردی', swatch: ['#0f2e2a', '#10b981', '#f59e0b'] },
  { id: 'midnight', label: 'Midnight', urdu: 'نیلی رات', swatch: ['#0b1020', '#6366f1', '#22d3ee'] },
  { id: 'sunrise', label: 'Sunrise', urdu: 'طلوع آفتاب', swatch: ['#2a0f1f', '#f97316', '#fbbf24'] },
]

interface Palette {
  bgGradientTop: string
  bgGradientBottom: string
  cardBg: string
  cardBorder: string
  titleColor: string
  summaryColor: string
  accent: string
  accentDark: string
  amber: string
  pointHeading: string
  pointDetail: string
  tagBg: string
  tagText: string
  tagBorder: string
  footerColor: string
  badgeText: string
  badgeShadow: string
  pointBorderAlpha: string
  glow: string
}

const PALETTES: Record<Theme, Palette> = {
  // Emerald — warm emerald + amber on deep slate (original, refined)
  emerald: {
    bgGradientTop: '#0f2e2a',
    bgGradientBottom: '#1a3c36',
    cardBg: '#ffffff',
    cardBorder: '#e2e8f0',
    titleColor: '#ffffff',
    summaryColor: '#cbd5d1',
    accent: '#10b981',
    accentDark: '#047857',
    amber: '#f59e0b',
    pointHeading: '#0f2e2a',
    pointDetail: '#475569',
    tagBg: '#fef3c7',
    tagText: '#92400e',
    tagBorder: 'rgba(245,158,11,0.35)',
    footerColor: '#94a3a0',
    badgeText: '#ffffff',
    badgeShadow: 'rgba(16,185,129,0.35)',
    pointBorderAlpha: '#10b981',
    glow: 'rgba(16,185,129,0.15)',
  },
  // Midnight — indigo + cyan on a deep night sky
  midnight: {
    bgGradientTop: '#0b1020',
    bgGradientBottom: '#161b35',
    cardBg: '#ffffff',
    cardBorder: '#e2e8f0',
    titleColor: '#ffffff',
    summaryColor: '#c7d2fe',
    accent: '#6366f1',
    accentDark: '#4338ca',
    amber: '#22d3ee',
    pointHeading: '#1e1b4b',
    pointDetail: '#475569',
    tagBg: '#e0e7ff',
    tagText: '#3730a3',
    tagBorder: 'rgba(99,102,241,0.35)',
    footerColor: '#94a3b8',
    badgeText: '#ffffff',
    badgeShadow: 'rgba(99,102,241,0.4)',
    pointBorderAlpha: '#6366f1',
    glow: 'rgba(99,102,241,0.18)',
  },
  // Sunrise — warm orange + amber on a deep plum
  sunrise: {
    bgGradientTop: '#2a0f1f',
    bgGradientBottom: '#3d1410',
    cardBg: '#fffaf5',
    cardBorder: '#fde2c4',
    titleColor: '#fff7ed',
    summaryColor: '#fed7aa',
    accent: '#f97316',
    accentDark: '#c2410c',
    amber: '#fbbf24',
    pointHeading: '#431407',
    pointDetail: '#7c2d12',
    tagBg: '#ffedd5',
    tagText: '#9a3412',
    tagBorder: 'rgba(249,115,22,0.35)',
    footerColor: '#fbbf24',
    badgeText: '#ffffff',
    badgeShadow: 'rgba(249,115,22,0.4)',
    pointBorderAlpha: '#f97316',
    glow: 'rgba(249,115,22,0.18)',
  },
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace('#', '')
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  }
}
function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function buildInfographicHtml(note: StructuredNote, theme: Theme): string {
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
  const P = PALETTES[theme]

  // Number badges: 01, 02, ... — universal, no semantic-icon guessing needed.
  const pointCards = note.keyPoints
    .map((kp, i) => {
      const num = String(i + 1).padStart(2, '0')
      const badgeAlign = isUrdu ? 'right' : 'left'
      return `
      <div class="point" style="border-${badgeAlign}: 5px solid ${P.accent};">
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

  // Decorative top-corner glow blobs — give each theme depth without busy detail.
  const glowColor = P.glow

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
    background:
      radial-gradient(700px 420px at 88% -8%, ${glowColor}, transparent 62%),
      radial-gradient(560px 360px at -6% 104%, ${rgba(P.amber, 0.10)}, transparent 60%),
      linear-gradient(160deg, ${P.bgGradientTop} 0%, ${P.bgGradientBottom} 100%);
    color: ${P.titleColor};
    padding: 56px 52px;
    display: flex;
    flex-direction: column;
    line-height: ${lineHeight};
    -webkit-font-smoothing: antialiased;
    position: relative;
    overflow: hidden;
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
    background: ${P.amber};
    box-shadow: 0 0 0 4px ${rgba(P.amber, 0.25)};
    flex-shrink: 0;
  }
  .brand {
    font-size: 18px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: ${P.accent};
    font-weight: 700;
  }
  .lang-pill {
    margin-inline-start: auto;
    background: ${rgba(P.accent, 0.18)};
    color: ${P.accent};
    border: 1px solid ${rgba(P.accent, 0.4)};
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
    color: ${P.titleColor};
    text-shadow: 0 2px 16px ${rgba(P.accent, 0.25)};
  }
  .summary {
    margin-top: 14px;
    font-size: ${summarySize};
    color: ${P.summaryColor};
    line-height: ${isUrdu ? '2.0' : '1.5'};
  }

  .divider {
    height: 3px;
    width: 64px;
    background: linear-gradient(90deg, ${P.amber}, ${P.accent});
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
    background: ${P.cardBg};
    border-radius: 16px;
    padding: 22px 24px;
    display: flex;
    align-items: flex-start;
    gap: 18px;
    box-shadow: 0 10px 28px rgba(0,0,0,0.20), 0 1px 0 ${rgba(P.accent, 0.08)} inset;
  }
  .badge {
    flex-shrink: 0;
    width: 46px; height: 46px;
    border-radius: 12px;
    background: linear-gradient(135deg, ${P.accent}, ${P.accentDark});
    color: ${P.badgeText};
    display: flex; align-items: center; justify-content: center;
    font-weight: 700;
    font-size: 20px;
    font-family: 'Inter', Arial, sans-serif;
    box-shadow: 0 4px 12px ${P.badgeShadow};
  }
  .point-body { flex: 1; min-width: 0; }
  .point-heading {
    font-size: ${headingSize};
    font-weight: 700;
    color: ${P.pointHeading};
    margin-bottom: 6px;
    line-height: ${isUrdu ? '1.9' : '1.3'};
  }
  .point-detail {
    font-size: ${detailSize};
    color: ${P.pointDetail};
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
    background: ${P.tagBg};
    color: ${P.tagText};
    border: 1px solid ${P.tagBorder};
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
    color: ${P.footerColor};
    font-size: 13px;
    letter-spacing: 1px;
  }
  .footer .gen {
    text-transform: uppercase;
    font-weight: 600;
  }
  .theme-tag {
    color: ${P.accent};
    font-weight: 600;
    text-transform: capitalize;
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
    <span><span class="theme-tag">${theme}</span> · ${new Date().toISOString().slice(0, 10)}</span>
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
export async function renderInfographic(note: StructuredNote, theme: Theme = 'emerald'): Promise<string> {
  await ensureOutputDir()
  const html = buildInfographicHtml(note, theme)

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
    const filename = `infographic-${theme}-${note.language}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
    await fs.writeFile(path.join(OUTPUT_DIR, filename), buf)
    return filename
  } finally {
    await browser.close()
  }
}

/**
 * Render two infographics (one per language) for "both" mode.
 */
export async function renderInfographics(
  notes: { english?: StructuredNote; urdu?: StructuredNote },
  theme: Theme = 'emerald',
): Promise<{ english?: string; urdu?: string }> {
  const out: { english?: string; urdu?: string } = {}
  if (notes.english) out.english = await renderInfographic(notes.english, theme)
  if (notes.urdu) out.urdu = await renderInfographic(notes.urdu, theme)
  return out
}

export const INFOGRAPHIC_DIMENSIONS = { width: INFOGRAPHIC_WIDTH, height: INFOGRAPHIC_HEIGHT }
