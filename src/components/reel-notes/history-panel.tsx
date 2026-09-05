'use client'

import { useEffect, useState } from 'react'
import { History, FileText, ImageIcon, Loader2, ExternalLink, ChevronRight, RotateCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { HistoryItem, Language } from '@/lib/types'

interface Props {
  /** Called when a row is clicked; should load that note's full detail into the workspace. */
  onLoad: (id: string) => void | Promise<void>
  /** The currently-loaded note id (to highlight the active row). */
  activeId?: string | null
  /** Signal a reload is needed (e.g. after a new generation) — bump to refresh. */
  refreshKey?: number
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime()
  const diff = Date.now() - d
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString()
}

const LANG_LABEL: Record<Language, string> = {
  english: 'EN',
  urdu: 'UR',
  both: 'EN+UR',
}

export function HistoryPanel({ onLoad, activeId, refreshKey = 0 }: Props) {
  const [items, setItems] = useState<HistoryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const load = async () => {
    try {
      setError(null)
      const res = await fetch('/api/notes')
      if (!res.ok) throw new Error('Failed to load history')
      const data = await res.json()
      setItems(data.notes || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
  }

  useEffect(() => {
    load()
  }, [refreshKey])

  const handleRow = async (id: string) => {
    setLoadingId(id)
    try {
      await onLoad(id)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold">Recent generations</h3>
          {items && items.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
          )}
        </div>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={load}>
          <RotateCw className="h-3 w-3" /> Refresh
        </Button>
      </div>

      {items === null && !error && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {error && <p className="py-6 text-center text-sm text-destructive">{error}</p>}
      {items && items.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No generations yet.</p>
      )}

      {items && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((it) => {
            const active = activeId === it.id
            const busy = loadingId === it.id
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => handleRow(it.id)}
                  disabled={busy}
                  className={cn(
                    'group flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all',
                    active
                      ? 'border-emerald-500/50 bg-emerald-50/70 dark:bg-emerald-950/20'
                      : 'border-border/60 bg-muted/20 hover:border-emerald-400/40 hover:bg-muted/40',
                    busy && 'opacity-60',
                  )}
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-emerald-600" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="max-w-[150px] truncate text-sm font-medium">{it.videoName}</span>
                  <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
                    {LANG_LABEL[it.language]}
                  </Badge>
                  <span className="flex shrink-0 items-center gap-1">
                    {it.hasEnglishNotes && <span className="text-[10px] font-medium text-emerald-600" title="English notes">EN✓</span>}
                    {it.hasUrduNotes && <span className="text-[10px] font-medium text-emerald-600" title="Urdu notes">UR✓</span>}
                    {it.hasEnglishInfographic && (
                      <span className="inline-flex items-center text-[10px] text-amber-600" title="English infographic">
                        <ImageIcon className="h-3 w-3" />
                      </span>
                    )}
                    {it.hasUrduInfographic && (
                      <span className="inline-flex items-center text-[10px] text-amber-600" title="Urdu infographic">
                        <ImageIcon className="h-3 w-3" />
                      </span>
                    )}
                  </span>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{timeAgo(it.createdAt)}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {items && items.length > 0 && (
        <p className="mt-3 text-center text-[10px] text-muted-foreground">
          Click any row to reload it into the workspace
        </p>
      )}
    </div>
  )
}
