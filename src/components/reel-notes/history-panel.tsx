'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  History,
  FileText,
  ImageIcon,
  Loader2,
  ChevronRight,
  RotateCw,
  Search,
  X,
  Clock,
  Hash,
  Trash2,
  Share2,
  CheckSquare,
  Square,
  AlertTriangle,
  Loader2 as Spinner,
  FileDown,
  ArrowLeftRight,
  Trash,
  RotateCcw,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { HistoryItem, Language } from '@/lib/types'

interface Props {
  /** Called when a row is clicked; should load that note's full detail into the workspace. */
  onLoad: (id: string) => void | Promise<void>
  /** The currently-loaded note id (to highlight the active row). */
  activeId?: string | null
  /** Signal a reload is needed (e.g. after a new generation) — bump to refresh. */
  refreshKey?: number
  /** Called after a delete succeeds, with the deleted ids — so the page can clear the workspace if needed. */
  onDeleted?: (deletedIds: string[]) => void
  /** Called when the user wants to compare exactly 2 notes (ids). */
  onCompare?: (aId: string, bId: string) => void
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
  hinglish: 'HI',
  both: 'EN+UR',
}

export function HistoryPanel({ onLoad, activeId, refreshKey = 0, onDeleted, onCompare }: Props) {
  const [items, setItems] = useState<HistoryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  // Selection mode state
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; bulk: boolean; permanent?: boolean; emptyTrash?: boolean } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [exportingAll, setExportingAll] = useState(false)

  // Trash view toggle: when true, lists soft-deleted notes instead of active ones.
  const [trashMode, setTrashMode] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const load = async () => {
    try {
      setError(null)
      const url = trashMode ? '/api/notes?trash=1' : '/api/notes'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load history')
      const data = await res.json()
      setItems(data.notes || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
  }

  useEffect(() => {
    // This effect intentionally starts the async history refresh on prop changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [refreshKey, trashMode])

  // Exit selection mode + clear selection whenever the list reloads.
  useEffect(() => {
    // Selection belongs to the old list and must be cleared after a refresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(new Set())
    setSelectMode(false)
  }, [refreshKey])

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
    if (selectMode) {
      toggleSelect(id)
      return
    }
    setLoadingId(id)
    try {
      await onLoad(id)
    } finally {
      setLoadingId(null)
    }
  }

  const toggleSelect = (id: string) => {
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllVisible = () => setSelected(new Set(filtered.map((it) => it.id)))
  const clearSelection = () => setSelected(new Set())

  const copyShareLink = async (id: string, videoName: string) => {
    const url = `${window.location.origin}/?share=${id}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success(`Share link copied for “${videoName}”`)
    } catch {
      toast.error('Copy failed — select the URL manually')
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const ids = deleteTarget.ids
      const permanent = !!deleteTarget.permanent
      const res = await fetch('/api/notes/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, permanent }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Delete failed')
      const count = data.deleted ?? data.trashed ?? ids.length
      if (deleteTarget.emptyTrash) {
        toast.success(`Trash emptied — ${count} notes permanently deleted`)
      } else if (permanent) {
        toast.success(ids.length === 1 ? 'Note permanently deleted' : `${count} notes permanently deleted`)
      } else {
        toast.success(ids.length === 1 ? 'Note moved to trash' : `${count} notes moved to trash`)
      }
      onDeleted?.(ids)
      setDeleteTarget(null)
      setSelected(new Set())
      setSelectMode(false)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const restoreNote = async (id: string, videoName: string) => {
    setRestoringId(id)
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'PUT' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Restore failed')
      toast.success(`Restored “${videoName}”`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Restore failed')
    } finally {
      setRestoringId(null)
    }
  }

  const emptyTrash = async () => {
    if (!items || items.length === 0) return
    setDeleting(true)
    try {
      const ids = items.map((it) => it.id)
      const res = await fetch('/api/notes/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, permanent: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Empty trash failed')
      toast.success(`Trash emptied — ${data.deleted || ids.length} notes permanently deleted`)
      onDeleted?.(ids)
      setDeleteTarget(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Empty trash failed')
    } finally {
      setDeleting(false)
    }
  }

  const exportAll = async () => {
    setExportingAll(true)
    try {
      const res = await fetch('/api/export-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Export failed')
      // Trigger browser download
      const a = document.createElement('a')
      a.href = data.url
      a.download = data.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      toast.success(`Exported ${data.notes} notes (${data.pages} pages)`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportingAll(false)
    }
  }

  const selectedCount = selected.size
  const visibleSelectedCount = filtered.filter((it) => selected.has(it.id)).length

  return (
    <div className="rounded-2xl border bg-card p-3 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-col items-stretch gap-3 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {trashMode ? (
            <Trash className="h-4 w-4 text-amber-600" />
          ) : (
            <History className="h-4 w-4 text-emerald-600" />
          )}
          <h3 className="text-sm font-semibold">{trashMode ? 'Trash' : 'Recent generations'}</h3>
          {items && items.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
          )}
          {filtered.length !== items?.length && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              {filtered.length} shown
            </Badge>
          )}
          {selectMode && selectedCount > 0 && (
            <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700">
              {selectedCount} selected
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-start gap-1 sm:justify-end sm:gap-1.5">
          {items && items.length > 0 && !selectMode && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs"
                onClick={exportAll}
                disabled={exportingAll}
              >
                  {exportingAll ? <Spinner className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
                  Export all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs"
                onClick={() => setSelectMode(true)}
              >
                <CheckSquare className="h-3 w-3" /> Select
              </Button>
            </>
          )}
          {selectMode && (
            <>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={selectAllVisible}>
                All
              </Button>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={clearSelection} disabled={selectedCount === 0}>
                None
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => selectedCount > 0 && setDeleteTarget({ ids: Array.from(selected), bulk: true, permanent: trashMode })}
                disabled={selectedCount === 0}
              >
                <Trash2 className="h-3 w-3" /> {trashMode ? 'Delete' : 'Trash'}
              </Button>
              {onCompare && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700"
                  onClick={() => {
                    const ids = Array.from(selected)
                    if (ids.length === 2) onCompare(ids[0], ids[1])
                  }}
                  disabled={selectedCount !== 2}
                  title={selectedCount === 2 ? 'Compare these 2 notes' : 'Select exactly 2 notes to compare'}
                >
                  <ArrowLeftRight className="h-3 w-3" /> Compare
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs"
                onClick={() => {
                  setSelectMode(false)
                  clearSelection()
                }}
              >
                <X className="h-3 w-3" /> Exit
              </Button>
            </>
          )}
          {trashMode && !selectMode && items && items.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleteTarget({ ids: items.map((i) => i.id), bulk: true, permanent: true, emptyTrash: true })}
              title="Permanently delete all trashed notes"
            >
              <Trash2 className="h-3 w-3" /> Empty trash
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className={`h-7 gap-1 text-xs ${trashMode ? 'text-amber-700 hover:bg-amber-500/10' : 'text-muted-foreground'}`}
            onClick={() => setTrashMode((v) => !v)}
            title={trashMode ? 'Back to active notes' : 'View trash'}
          >
            {trashMode ? <History className="h-3 w-3" /> : <Trash className="h-3 w-3" />}
            {trashMode ? 'Active' : 'Trash'}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={load}>
            <RotateCw className="h-3 w-3" /> Refresh
          </Button>
        </div>
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
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30'
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
            const isSelected = selected.has(it.id)
            return (
              <li key={it.id} className="group relative">
                <button
                  type="button"
                  onClick={() => handleRow(it.id)}
                  disabled={busy}
                  className={cn(
                    'flex w-full flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all sm:flex-nowrap',
                    active && !selectMode
                      ? 'border-emerald-500/50 bg-emerald-50/70 dark:bg-emerald-950/20'
                      : isSelected
                        ? 'border-emerald-500/60 bg-emerald-50/50 dark:bg-emerald-950/20'
                        : 'border-border/60 bg-muted/20 hover:border-emerald-400/40 hover:bg-muted/40',
                    busy && 'opacity-60',
                  )}
                >
                  {selectMode ? (
                    isSelected ? (
                      <CheckSquare className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    ) : (
                      <Square className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )
                  ) : busy ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-emerald-600" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 max-w-[120px] flex-1 truncate text-sm font-medium sm:max-w-[150px] sm:flex-none">{it.videoName}</span>
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
                    {it.hasHinglishNotes && <span className="text-[10px] font-medium text-emerald-600" title="Hinglish notes">HI✓</span>}
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
                    {it.hasHinglishInfographic && (
                      <span className="inline-flex items-center text-[10px] text-amber-600" title="Hinglish infographic">
                        <ImageIcon className="h-3 w-3" />
                      </span>
                    )}
                  </span>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{timeAgo(it.createdAt)}</span>
                  {!selectMode && (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  )}
                </button>

                {/* Quick actions (hover, non-select mode) */}
                {!selectMode && !busy && (
                  <div className="absolute right-8 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    {trashMode ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            restoreNote(it.id, it.videoName)
                          }}
                          disabled={restoringId === it.id}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-muted-foreground shadow-sm backdrop-blur hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40"
                          aria-label="Restore note"
                          title="Restore note"
                        >
                          {restoringId === it.id ? <Spinner className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTarget({ ids: [it.id], bulk: false, permanent: true })
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-muted-foreground shadow-sm backdrop-blur hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Delete permanently"
                          title="Delete permanently"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            copyShareLink(it.id, it.videoName)
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-muted-foreground shadow-sm backdrop-blur hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40"
                          aria-label="Copy share link"
                          title="Copy share link"
                        >
                          <Share2 className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTarget({ ids: [it.id], bulk: false })
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-muted-foreground shadow-sm backdrop-blur hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Delete note"
                          title="Move to trash"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {items && items.length > 0 && (
        <p className="mt-3 text-center text-[10px] text-muted-foreground">
          {selectMode
            ? `Tap rows to select · ${visibleSelectedCount} of ${filtered.length} visible selected`
            : 'Click a row to reload · hover for quick actions'}
        </p>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${deleteTarget?.permanent ? 'text-destructive' : 'text-amber-600'}`} />
              {deleteTarget?.emptyTrash
                ? `Empty trash? (${deleteTarget.ids.length} notes)`
                : deleteTarget?.permanent
                  ? `Permanently delete ${deleteTarget?.bulk ? `${deleteTarget.ids.length} notes` : 'note'}?`
                  : `Move ${deleteTarget?.bulk ? `${deleteTarget.ids.length} notes` : 'note'} to trash?`}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.emptyTrash
                ? `This will permanently delete all ${deleteTarget.ids.length} trashed notes and their generated infographic PNGs. This cannot be undone.`
                : deleteTarget?.permanent
                  ? `This will permanently remove ${deleteTarget?.bulk ? 'these notes' : 'this note'} and their generated infographic PNGs. This cannot be undone.`
                  : `The note(s) will be moved to trash. You can restore them from the Trash view, or permanently delete them later.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant={deleteTarget?.permanent ? 'destructive' : 'default'}
              onClick={confirmDelete}
              disabled={deleting}
              className="gap-1.5"
            >
              {deleting ? <Spinner className="h-4 w-4 animate-spin" /> : deleteTarget?.permanent ? <Trash2 className="h-4 w-4" /> : <Trash className="h-4 w-4" />}
              {deleteTarget?.emptyTrash
                ? 'Empty trash'
                : deleteTarget?.permanent
                  ? `Delete ${deleteTarget?.bulk ? `${deleteTarget.ids.length}` : ''}`
                  : `Move to trash ${deleteTarget?.bulk ? `${deleteTarget.ids.length}` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
