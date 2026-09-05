'use client'

import { useEffect, useState } from 'react'
import { History, FileText, ImageIcon, Loader2, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { HistoryItem } from '@/lib/types'

export function HistoryPanel() {
  const [items, setItems] = useState<HistoryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

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
  }, [])

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold">Recent generations</h3>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={load}>
          Refresh
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
          {items.map((it) => (
            <li
              key={it.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="max-w-[180px] truncate text-sm font-medium">{it.videoName}</span>
              <Badge variant="outline" className="text-[10px] uppercase">
                {it.language}
              </Badge>
              {it.hasEnglishNotes && <span className="text-[10px] text-emerald-600">EN✓</span>}
              {it.hasUrduNotes && <span className="text-[10px] text-emerald-600">UR✓</span>}
              {it.hasEnglishInfographic && (
                <a
                  href={it.infographicEnUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-amber-600 hover:underline"
                >
                  <ImageIcon className="h-3 w-3" /> EN img
                </a>
              )}
              {it.hasUrduInfographic && (
                <a
                  href={it.infographicUrUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-amber-600 hover:underline"
                >
                  <ImageIcon className="h-3 w-3" /> UR img
                </a>
              )}
              <span className="ml-auto text-[10px] text-muted-foreground">
                {new Date(it.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
