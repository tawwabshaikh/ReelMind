// Deterministic tag → hex color mapping with a curated palette.
// Shared by the notes view, infographic, and notes sheet so tag colors are
// consistent everywhere. If a user has set a custom color, that takes priority.

const PALETTE = [
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ef4444', // red
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
  '#84cc16', // lime
]

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

/** Deterministic palette color for a tag (stable across reloads). */
export function paletteColorForTag(tag: string): string {
  return PALETTE[hashString(tag) % PALETTE.length]
}

/**
 * Resolve the effective color for a tag: user-set custom color wins, else the
 * deterministic palette color.
 */
export function colorForTag(tag: string, tagColors?: Record<string, string> | null): string {
  if (tagColors && tagColors[tag] && /^#[0-9a-fA-F]{6}$/.test(tagColors[tag])) {
    return tagColors[tag]
  }
  return paletteColorForTag(tag)
}

/** Lighten/darken a hex color by a factor (-1..1) → returns an rgb() string. */
export function shade(hex: string, factor: number): string {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  const apply = (c: number) => {
    if (factor >= 0) return Math.round(c + (255 - c) * factor)
    return Math.round(c * (1 + factor))
  }
  return `rgb(${apply(r)}, ${apply(g)}, ${apply(b)})`
}

/** Convert a hex color to an `r, g, b` triplet string (for rgba()). */
export function hexToRgbTriplet(hex: string): string {
  const m = hex.replace('#', '')
  return `${parseInt(m.slice(0, 2), 16)}, ${parseInt(m.slice(2, 4), 16)}, ${parseInt(m.slice(4, 6), 16)}`
}
