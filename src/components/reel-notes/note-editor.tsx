'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Pencil, X, Plus, Trash2, Loader2, Save, Tag, Hash, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { NoteVersion, StructuredNote, KeyPoint, NoteDetail } from '@/lib/types'
import { colorForTag, shade } from '@/lib/tag-colors'

const TAG_COLOR_PRESETS = [
  '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4',
  '#ef4444', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Current note detail (english + urdu versions). */
  english?: NoteVersion
  urdu?: NoteVersion
  noteId: string | null
  videoName: string
  /** Called after a successful save with the updated note detail. */
  onSaved: (updated: NoteDetail) => void
}

interface EditableNote {
  title: string
  summary: string
  keyPoints: KeyPoint[]
  tags: string[]
  tagColors: Record<string, string>
}

function toEditable(v: NoteVersion | undefined): EditableNote {
  if (!v) return { title: '', summary: '', keyPoints: [], tags: [], tagColors: {} }
  return {
    title: v.structured.title,
    summary: v.structured.summary,
    keyPoints: v.structured.keyPoints.map((kp) => ({ ...kp })),
    tags: [...v.structured.tags],
    tagColors: { ...(v.structured.tagColors || {}) },
  }
}

export function NoteEditor({ open, onOpenChange, english, urdu, noteId, videoName, onSaved }: Props) {
  const hasEn = !!english
  const hasUr = !!urdu
  const [activeLang, setActiveLang] = useState<'english' | 'urdu'>(hasEn ? 'english' : 'urdu')
  const [en, setEn] = useState<EditableNote>(toEditable(english))
  const [ur, setUr] = useState<EditableNote>(toEditable(urdu))
  const [saving, setSaving] = useState(false)
  const [tagInputEn, setTagInputEn] = useState('')
  const [tagInputUr, setTagInputUr] = useState('')

  // Re-sync local state when the modal opens or the source notes change.
  useEffect(() => {
    if (open) {
      setEn(toEditable(english))
      setUr(toEditable(urdu))
      setActiveLang(hasEn ? 'english' : 'urdu')
      setTagInputEn('')
      setTagInputUr('')
    }
  }, [open, english, urdu, hasEn])

  const current = activeLang === 'english' ? en : ur
  const setCurrent = activeLang === 'english' ? setEn : setUr
  const tagInput = activeLang === 'english' ? tagInputEn : tagInputUr
  const setTagInput = activeLang === 'english' ? setTagInputEn : setTagInputUr
  const isUrdu = activeLang === 'urdu'

  const addTag = () => {
    const t = tagInput.trim()
    if (!t) return
    if (current.tags.includes(t)) {
      setTagInput('')
      return
    }
    setCurrent({ ...current, tags: [...current.tags, t] })
    setTagInput('')
  }
  const removeTag = (t: string) => {
    const nextColors = { ...current.tagColors }
    delete nextColors[t]
    setCurrent({ ...current, tags: current.tags.filter((x) => x !== t), tagColors: nextColors })
  }
  const setTagColor = (t: string, color: string) => {
    setCurrent({ ...current, tagColors: { ...current.tagColors, [t]: color } })
  }
  const clearTagColor = (t: string) => {
    const nextColors = { ...current.tagColors }
    delete nextColors[t]
    setCurrent({ ...current, tagColors: nextColors })
  }
  const addPoint = () => {
    setCurrent({ ...current, keyPoints: [...current.keyPoints, { heading: '', detail: '' }] })
  }
  const updatePoint = (i: number, field: keyof KeyPoint, val: string) => {
    const next = current.keyPoints.map((kp, idx) => (idx === i ? { ...kp, [field]: val } : kp))
    setCurrent({ ...current, keyPoints: next })
  }
  const removePoint = (i: number) => {
    setCurrent({ ...current, keyPoints: current.keyPoints.filter((_, idx) => idx !== i) })
  }

  const handleSave = async () => {
    if (!noteId) {
      toast.error('No note id — generate notes first.')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {}
      if (hasEn) {
        payload.english = {
          title: en.title,
          summary: en.summary,
          keyPoints: en.keyPoints.filter((kp) => kp.detail.trim()),
          tags: en.tags,
          tagColors: en.tagColors,
        }
      }
      if (hasUr) {
        payload.urdu = {
          title: ur.title,
          summary: ur.summary,
          keyPoints: ur.keyPoints.filter((kp) => kp.detail.trim()),
          tags: ur.tags,
          tagColors: ur.tagColors,
        }
      }
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `Save failed (${res.status})`)
      onSaved(data.note as NoteDetail)
      toast.success('Notes updated')
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto scroll-thin sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-emerald-600" />
            Edit notes
          </DialogTitle>
          <DialogDescription>
            Tweak the title, summary, key points, or tags before regenerating the infographic. Changes are saved to the database.
          </DialogDescription>
        </DialogHeader>

        {hasEn && hasUr && (
          <div className="flex gap-2 rounded-lg bg-muted/50 p-1">
            {(['english', 'urdu'] as const).map((lng) => (
              <button
                key={lng}
                type="button"
                onClick={() => setActiveLang(lng)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeLang === lng ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {lng === 'english' ? 'English' : 'اردو'}
              </button>
            ))}
          </div>
        )}

        <div className={`space-y-4 ${isUrdu ? 'font-urdu' : ''}`} dir={isUrdu ? 'rtl' : 'ltr'}>
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="ed-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Title
            </Label>
            <Input
              id="ed-title"
              value={current.title}
              onChange={(e) => setCurrent({ ...current, title: e.target.value })}
              className={isUrdu ? 'text-right' : ''}
            />
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <Label htmlFor="ed-summary" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Summary
            </Label>
            <Textarea
              id="ed-summary"
              value={current.summary}
              onChange={(e) => setCurrent({ ...current, summary: e.target.value })}
              rows={2}
              className={isUrdu ? 'text-right' : ''}
            />
          </div>

          {/* Key points */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Key points ({current.keyPoints.length})
              </Label>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={addPoint} disabled={current.keyPoints.length >= 6}>
                <Plus className="h-3 w-3" /> Add point
              </Button>
            </div>
            <div className="space-y-2">
              {current.keyPoints.map((kp, i) => (
                <div key={i} className="rounded-lg border bg-muted/20 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500/15 text-xs font-bold text-emerald-700">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <Input
                      value={kp.heading}
                      onChange={(e) => updatePoint(i, 'heading', e.target.value)}
                      placeholder="Heading"
                      className={`h-8 text-sm ${isUrdu ? 'text-right' : ''}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removePoint(i)}
                      aria-label="Remove point"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    value={kp.detail}
                    onChange={(e) => updatePoint(i, 'detail', e.target.value)}
                    placeholder="Detail"
                    rows={2}
                    className={`text-sm ${isUrdu ? 'text-right' : ''}`}
                  />
                </div>
              ))}
              {current.keyPoints.length === 0 && (
                <p className="rounded-lg border border-dashed py-4 text-center text-xs text-muted-foreground">
                  No points. Click “Add point”.
                </p>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</Label>
            <div className={`flex gap-2 ${isUrdu ? 'flex-row-reverse' : ''}`}>
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
                placeholder="Type a tag, press Enter"
                className={isUrdu ? 'text-right' : ''}
              />
              <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={addTag}>
                <Tag className="h-3 w-3" /> Add
              </Button>
            </div>
            {current.tags.length > 0 && (
              <div className={`flex flex-wrap gap-1.5 ${isUrdu ? 'justify-end' : ''}`}>
                {current.tags.map((t) => {
                  const customColor = current.tagColors[t]
                  const dotColor = customColor || colorForTag(t)
                  return (
                    <div key={t} className="group/tag inline-flex items-center">
                      <Badge
                        variant="secondary"
                        className="gap-1 border pr-1"
                        style={{
                          backgroundColor: customColor ? shade(customColor, 0.85) : undefined,
                          color: customColor ? shade(customColor, -0.3) : undefined,
                          borderColor: customColor ? shade(customColor, 0.6) : undefined,
                        }}
                      >
                        <Hash className="h-3 w-3" />
                        {t}
                        {/* Color picker */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-black/10"
                              style={{ backgroundColor: dotColor }}
                              aria-label={`Color for ${t}`}
                              title={`Color for ${t}`}
                            >
                              <Palette className="h-2.5 w-2.5 text-white/0 opacity-0 transition-opacity group-hover/tag:opacity-100" style={{ color: 'rgba(255,255,255,0.9)' }} />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-3" align="center">
                            <div className="space-y-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Color for “{t}”
                              </p>
                              <div className="grid grid-cols-5 gap-1.5">
                                {TAG_COLOR_PRESETS.map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => setTagColor(t, c)}
                                    className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                                    style={{
                                      backgroundColor: c,
                                      borderColor: customColor === c ? '#0f172a' : 'transparent',
                                    }}
                                    aria-label={`Set ${c}`}
                                  />
                                ))}
                              </div>
                              <div className="flex items-center gap-1.5 pt-1">
                                <input
                                  type="color"
                                  value={customColor || dotColor}
                                  onChange={(e) => setTagColor(t, e.target.value)}
                                  className="h-7 w-9 cursor-pointer rounded border border-border bg-background"
                                  aria-label="Custom color"
                                />
                                <span className="text-[10px] text-muted-foreground">Custom</span>
                                {customColor && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="ml-auto h-6 px-2 text-[10px]"
                                    onClick={() => clearTagColor(t)}
                                  >
                                    Reset
                                  </Button>
                                )}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <button
                          type="button"
                          onClick={() => removeTag(t)}
                          className="ml-0.5 rounded-full p-0.5 hover:bg-black/10"
                          aria-label={`Remove ${t}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
