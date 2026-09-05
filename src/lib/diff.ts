import type { KeyPoint } from './types'

export type DiffStatus = 'added' | 'removed' | 'changed' | 'unchanged'

export interface DiffRow {
  status: DiffStatus
  heading: string
  /** Detail from note A (null if added). */
  detailA: string | null
  /** Detail from note B (null if removed). */
  detailB: string | null
}

/**
 * Compute a diff between two notes' key points, matched by heading
 * (case-insensitive, trimmed). Returns a flat list of DiffRows in a stable
 * order: unchanged first (boring), then changed, then removed (A-only), then
 * added (B-only) — so the interesting differences are at the top.
 */
export function diffKeyPoints(a: KeyPoint[], b: KeyPoint[]): DiffRow[] {
  const normalize = (s: string) => s.trim().toLowerCase()
  const aMap = new Map<string, KeyPoint>()
  for (const kp of a) aMap.set(normalize(kp.heading), kp)
  const bMap = new Map<string, KeyPoint>()
  for (const kp of b) bMap.set(normalize(kp.heading), kp)

  const allHeadings = new Set<string>([...aMap.keys(), ...bMap.keys()])
  const rows: DiffRow[] = []

  for (const h of allHeadings) {
    const ka = aMap.get(h)
    const kb = bMap.get(h)
    if (ka && kb) {
      const sameDetail = ka.detail.trim() === kb.detail.trim()
      rows.push({
        status: sameDetail ? 'unchanged' : 'changed',
        heading: ka.heading, // prefer A's original casing
        detailA: ka.detail,
        detailB: kb.detail,
      })
    } else if (ka) {
      rows.push({ status: 'removed', heading: ka.heading, detailA: ka.detail, detailB: null })
    } else if (kb) {
      rows.push({ status: 'added', heading: kb.heading, detailA: null, detailB: kb.detail })
    }
  }

  // Sort: changed > removed > added > unchanged (interesting first)
  const order: Record<DiffStatus, number> = { changed: 0, removed: 1, added: 2, unchanged: 3 }
  return rows.sort((x, y) => order[x.status] - order[y.status])
}

export interface DiffSummary {
  added: number
  removed: number
  changed: number
  unchanged: number
}

export function summarizeDiff(rows: DiffRow[]): DiffSummary {
  return rows.reduce(
    (acc, r) => {
      acc[r.status]++
      return acc
    },
    { added: 0, removed: 0, changed: 0, unchanged: 0 } as DiffSummary,
  )
}
