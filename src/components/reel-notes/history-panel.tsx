'use client'

import { useEffect, useMemo, useState } from 'react'
import { History, FileText, ImageIcon, Loader2, ChevronRight, RotateCw, Search, X, Clock, Hash } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

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

  // Collect all unique tags across items for the filter chips.
  const allTags = useMemo(() => {
    if (!items) return []
    const set = new Set<string>()
    for (const it of items) for (const t of it.tags || []) set.add(t)
    return Array.from(set).sort().slice(0, 24)
  }, [items])

  const filtered = useMemo(() => {
    if (!items) return []
    const q = query.trim().toLowerCase()
    return items.filter((it) => {
      if (activeTag && !(it.tags || []).includes(activeTag)) return false
      if (!q) return true
      return (
        it.videoName.toLowerCase().includes(q) ||
        (it.tags || []).some((t) => t.includes(q)) ||
        it.language.toLowerCase().includes(q)
      )
    })
  }, [items, query, activeTag])

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
          {filtered.length !== items?.length && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              {filtered.length} shown
            </Badge>
          )}
        </div>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={load}>
          <RotateCw className="h-3 w-3" /> Refresh
        </Button>
      </div>

      {/* Search + tag filters */}
      {items && items.length > 0 && (
        <div className="mb-3 space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, tag, or language…"
              className="h-8 pl-8 pr-8 text-xs"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveTag((cur) => (cur === t ? null : t))}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                    activeTag === t
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted',
                  )}
                >
                  <Hash className="h-2.5 w-2.5" />
                  {t}
                </button>
              ))}
              {activeTag && (
                <button
                  type="button"
                  onClick={() => setActiveTag(null)}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                >
                  <X className="h-2.5 w-2.5" /> Clear
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {items === null && !error && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {error && <p className="py-6 text-center text-sm text-destructive">{error}</p>}
      {items && items.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No generations yet.</p>
      )}
      {items && items.length > 0 && filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No matches for your filter.</p>
      )}

      {filtered.length > 0 && (
        <ul className="space-y-2">
          {filtered.map((it) => {
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
                  {it.wordCount != null && (
                    <span className="hidden shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground sm:inline-flex" title="words">
                      <FileText className="h-2.5 w-2.5" /> {it.wordCount}
                    </span>
                  )}
                  {it.durationSec != null && (
                    <span className="hidden shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground sm:inline-flex" title="duration">
                      <Clock className="h-2.5 w-2.5" /> {Math.round(it.durationSec)}s
                    </span>
                  )}
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
