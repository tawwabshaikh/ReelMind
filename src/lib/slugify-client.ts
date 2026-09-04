// Client-safe slugify (no server-only imports).
export function slugify(input: string, maxLen = 40): string {
  const ascii = input
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '') // strip non-ascii (urdu) for filename safety
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
  const out = ascii.slice(0, maxLen).replace(/-$/, '')
  return out || 'notes'
}
