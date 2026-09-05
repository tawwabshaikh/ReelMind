'use client'

import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Film,
  Loader2,
  Play,
  Sparkles,
  FileText,
  ScrollText,
  Image as ImageIcon,
  CheckCircle2,
  Circle,
  AlertCircle,
  Github,
  Heart,
  RotateCw,
  Languages,
  Wand2,
  Zap,
  ShieldCheck,
  Download,
  Share2,
  Keyboard,
  Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { UploadZone } from '@/components/reel-notes/upload-zone'
import { LanguageSelector } from '@/components/reel-notes/language-selector'
import { NotesView } from '@/components/reel-notes/notes-view'
import { TranscriptView } from '@/components/reel-notes/transcript-view'
import { InfographicView } from '@/components/reel-notes/infographic-view'
import { HistoryPanel } from '@/components/reel-notes/history-panel'
import { NoteEditor } from '@/components/reel-notes/note-editor'
import { ThemeToggle } from '@/components/reel-notes/theme-toggle'
import { ShareButton } from '@/components/reel-notes/share-button'
import type {
  Language,
  Theme,
  TranscribeResponse,
  GenerateNotesResponse,
  GenerateInfographicResponse,
  NoteDetailResponse,
  NoteDetail,
  InfographicFile,
} from '@/lib/types'

type Stage = 'idle' | 'transcribing' | 'generating-notes' | 'done'

const STEPS: { key: Stage | 'infographic'; label: string; urdu: string }[] = [
  { key: 'transcribing', label: 'Transcribe', urdu: 'ٹرانسکرائب' },
  { key: 'generating-notes', label: 'Summarize', urdu: 'خلاصہ' },
  { key: 'done', label: 'Notes', urdu: 'نوٹس' },
  { key: 'infographic', label: 'Infographic', urdu: 'انفوگرافک' },
]

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [language, setLanguage] = useState<Language>('english')
  const [theme, setTheme] = useState<Theme>('emerald')

  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)

  const [transcript, setTranscript] = useState<TranscribeResponse | null>(null)
  const [notes, setNotes] = useState<GenerateNotesResponse | null>(null)

  const [infographicEn, setInfographicEn] = useState<InfographicFile | null>(null)
  const [infographicUr, setInfographicUr] = useState<InfographicFile | null>(null)
  const [infographicLoading, setInfographicLoading] = useState(false)

  const [activeTab, setActiveTab] = useState<string>('notes')
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [loadedNoteId, setLoadedNoteId] = useState<string | null>(null)
  const [regeneratingNotes, setRegeneratingNotes] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [videoName, setVideoName] = useState<string>('')
  const [sharedMode, setSharedMode] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const busy = stage === 'transcribing' || stage === 'generating-notes' || regeneratingNotes

  // ---- Share-link detection: ?share=<id> loads a read-only note ----
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shareId = params.get('share')
    if (!shareId) return
    setSharedMode(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/notes/${shareId}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Shared note not found')
        const d = data as NoteDetailResponse
        const n = d.note
        const wordCount = n.wordCount ?? n.transcript.split(/\s+/).filter(Boolean).length
        setTranscript({
          transcript: n.transcript,
          meta: {
            filename: n.videoName,
            sizeBytes: n.sizeBytes ?? 0,
            durationSec: n.durationSec,
            wordCount,
          },
        })
        setNotes({
          noteId: n.id,
          language: n.language,
          english: n.english,
          urdu: n.urdu,
        })
        setInfographicEn(n.infographicEn)
        setInfographicUr(n.infographicUr)
        setLoadedNoteId(n.id)
        setVideoName(n.videoName)
        setStage('done')
        setActiveTab('notes')
        toast.success(`Viewing shared note: ${n.videoName}`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load shared note')
      }
    })()
  }, [])

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs/textareas or when a modal is open.
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'g' && notes && !infographicLoading) {
        e.preventDefault()
        generateInfographic()
      } else if (mod && e.key === 'e' && notes && !sharedMode) {
        e.preventDefault()
        setEditorOpen(true)
      } else if (mod && e.key === '1' && (transcript || notes)) {
        e.preventDefault()
        setActiveTab('notes')
      } else if (mod && e.key === '2' && transcript) {
        e.preventDefault()
        setActiveTab('transcript')
      } else if (mod && e.key === '3' && notes) {
        e.preventDefault()
        setActiveTab('infographic')
      } else if (mod && e.key === 'k') {
        e.preventDefault()
        setShortcutsOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [notes, transcript, infographicLoading, sharedMode])

  const reset = useCallback(() => {
    setTranscript(null)
    setNotes(null)
    setInfographicEn(null)
    setInfographicUr(null)
    setError(null)
    setStage('idle')
    setLoadedNoteId(null)
    setVideoName('')
  }, [])

  const handleFile = useCallback(
    (f: File | null) => {
      setFile(f)
      reset()
    },
    [reset],
  )

  const runPipeline = useCallback(async () => {
    if (!file) {
      toast.error('Please choose a video file first.')
      return
    }
    setError(null)
    setTranscript(null)
    setNotes(null)
    setInfographicEn(null)
    setInfographicUr(null)
    setLoadedNoteId(null)
    setActiveTab('transcript')

    // ---- Stage 1: transcribe ----
    setStage('transcribing')
    let tr: TranscribeResponse
    try {
      const fd = new FormData()
      fd.append('video', file)
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `Transcription failed (${res.status})`)
      tr = data as TranscribeResponse
      setTranscript(tr)
      toast.success(`Transcribed · ${tr.meta.wordCount} words`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transcription error'
      setError(msg)
      setStage('idle')
      toast.error(msg)
      return
    }

    // ---- Stage 2: generate notes ----
    setStage('generating-notes')
    setActiveTab('notes')
    setVideoName(file.name)
    try {
      const res = await fetch('/api/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: tr.transcript,
          language,
          videoName: file.name,
          durationSec: tr.meta.durationSec,
          sizeBytes: tr.meta.sizeBytes,
          wordCount: tr.meta.wordCount,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `Notes generation failed (${res.status})`)
      const n = data as GenerateNotesResponse
      setNotes(n)
      setLoadedNoteId(n.noteId)
      setStage('done')
      setHistoryRefreshKey((k) => k + 1)
      toast.success(
        language === 'both'
          ? 'Bilingual notes ready (EN + UR)'
          : language === 'urdu'
            ? 'Urdu notes ready (Nastaliq)'
            : 'English notes ready',
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Notes generation error'
      setError(msg)
      setStage('idle')
      toast.error(msg)
    }
  }, [file, language])

  /** Regenerate just the notes from the existing transcript (no re-upload). */
  const regenerateNotes = useCallback(async () => {
    if (!transcript) return
    setRegeneratingNotes(true)
    setError(null)
    setInfographicEn(null)
    setInfographicUr(null)
    setActiveTab('notes')
    try {
      const res = await fetch('/api/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcript.transcript,
          language,
          videoName: transcript.meta.filename,
          durationSec: transcript.meta.durationSec,
          sizeBytes: transcript.meta.sizeBytes,
          wordCount: transcript.meta.wordCount,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `Notes generation failed (${res.status})`)
      const n = data as GenerateNotesResponse
      setNotes(n)
      setLoadedNoteId(n.noteId)
      setVideoName(transcript.meta.filename)
      setHistoryRefreshKey((k) => k + 1)
      toast.success('Notes regenerated')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Notes regeneration error'
      setError(msg)
      toast.error(msg)
    } finally {
      setRegeneratingNotes(false)
    }
  }, [transcript, language])

  const generateInfographic = useCallback(async () => {
    if (!notes) return
    setInfographicLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-infographic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          english: notes.english?.structured,
          urdu: notes.urdu?.structured,
          noteId: notes.noteId ?? loadedNoteId,
          theme,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `Infographic failed (${res.status})`)
      const r = data as GenerateInfographicResponse
      setInfographicEn(r.english)
      setInfographicUr(r.urdu)
      setHistoryRefreshKey((k) => k + 1)
      setActiveTab('infographic')
      toast.success(`Infographic rendered · ${theme}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Infographic error'
      setError(msg)
      toast.error(msg)
    } finally {
      setInfographicLoading(false)
    }
  }, [notes, theme, loadedNoteId])

  /** Load a historical note's full detail back into the workspace. */
  const loadHistoryNote = useCallback(async (id: string) => {
    setError(null)
    try {
      const res = await fetch(`/api/notes/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `Load failed (${res.status})`)
      const d = data as NoteDetailResponse
      const n = d.note
      const wordCount = n.wordCount ?? n.transcript.split(/\s+/).filter(Boolean).length
      setTranscript({
        transcript: n.transcript,
        meta: {
          filename: n.videoName,
          sizeBytes: n.sizeBytes ?? 0,
          durationSec: n.durationSec,
          wordCount,
        },
      })
      setNotes({
        noteId: n.id,
        language: n.language,
        english: n.english,
        urdu: n.urdu,
      })
      setInfographicEn(n.infographicEn)
      setInfographicUr(n.infographicUr)
      setLoadedNoteId(n.id)
      setVideoName(n.videoName)
      setStage('done')
      setFile(null)
      setActiveTab('notes')
      toast.success(`Loaded: ${n.videoName}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Load error'
      setError(msg)
      toast.error(msg)
    }
  }, [])

  const stageIndex = (() => {
    if (stage === 'idle') return -1
    if (stage === 'transcribing') return 0
    if (stage === 'generating-notes') return 1
    if (stage === 'done') return 2
    return 2
  })()
  const infographicDone = !!(infographicEn || infographicUr)

  /** After inline-edit save: update notes state + clear stale infographics. */
  const handleNotesSaved = useCallback((updated: NoteDetail) => {
    setNotes({
      noteId: updated.id,
      language: updated.language,
      english: updated.english,
      urdu: updated.urdu,
    })
    // Edited notes no longer match the previously-rendered infographic, so clear it.
    setInfographicEn(null)
    setInfographicUr(null)
    setHistoryRefreshKey((k) => k + 1)
    toast.success('Notes saved — regenerate the infographic to reflect edits.')
  }, [])

  /** After delete: if the currently-loaded note was among the deleted, reset the workspace. */
  const handleNotesDeleted = useCallback((deletedIds: string[]) => {
    if (loadedNoteId && deletedIds.includes(loadedNoteId)) {
      reset()
      toast.info('Cleared the workspace — the loaded note was deleted.')
    }
  }, [loadedNoteId, reset])

  return (
    <div className="flex min-h-screen flex-col bg-background bg-brand-hero">
      {/* ---------------- Header ---------------- */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-sm">
            <Film className="h-5 w-5" />
          </div>
          <div className="leading-none">
            <h1 className="text-lg font-bold tracking-tight">
              Reel <span className="text-muted-foreground">→</span>{' '}
              <span className="text-gradient-brand">Notes</span>
            </h1>
            <p className="text-[11px] text-muted-foreground">Bilingual video notes + infographic generator</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {sharedMode && (
              <Badge variant="outline" className="mr-1 gap-1 border-amber-500/40 text-amber-700">
                <Eye className="h-3 w-3" /> Shared view
              </Badge>
            )}
            {notes && !sharedMode && (
              <ShareButton noteId={notes.noteId ?? loadedNoteId} videoName={videoName} variant="labeled" />
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setShortcutsOpen(true)}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (⌘K)"
            >
              <Keyboard className="h-4 w-4" />
            </Button>
            <ThemeToggle />
            <Badge variant="outline" className="hidden gap-1 border-emerald-500/30 text-emerald-700 sm:flex">
              <Sparkles className="h-3 w-3" /> v3
            </Badge>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="hidden h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
              aria-label="Source"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      {/* ---------------- Hero (hidden in shared view) ---------------- */}
      {!sharedMode && (
      <section className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30">
            <Sparkles className="h-3 w-3" /> Whisper transcription · Claude-style summarization
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Turn any video into <span className="text-gradient-brand">bilingual notes</span> & a shareable infographic.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Upload a reel, pick English, Urdu (proper Nastaliq script), or both — get clean Markdown notes and an
            Instagram-friendly PNG infographic with correct RTL text shaping.
          </p>
        </div>

        {/* Feature strip */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FeatureChip icon={<Languages className="h-4 w-4" />} title="Bilingual" sub="EN · UR · Both" />
          <FeatureChip icon={<Wand2 className="h-4 w-4" />} title="3 themes" sub="Emerald · Midnight · Sunrise" />
          <FeatureChip icon={<ImageIcon className="h-4 w-4" />} title="PNG 1080×1350" sub="Instagram-ready" />
          <FeatureChip icon={<ShieldCheck className="h-4 w-4" />} title="History + Share" sub="Reload · Public links" />
        </div>
      </section>
      )}

      {/* Shared-view banner */}
      {sharedMode && (
        <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-50/60 px-4 py-3 dark:bg-amber-950/20">
            <div className="flex items-center gap-2 text-sm">
              <Eye className="h-4 w-4 text-amber-600" />
              <span className="font-semibold">You're viewing a shared note</span>
              <span className="text-muted-foreground">— read-only. Download buttons still work.</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                window.location.href = window.location.origin
              }}
            >
              <Film className="h-3.5 w-3.5" />
              Back to app
            </Button>
          </div>
        </section>
      )}

      {/* ---------------- Main ---------------- */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left: config (hidden in shared view) */}
          {!sharedMode && (
          <div className="space-y-5 lg:col-span-2">
            <Card className="shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Film className="h-4 w-4 text-emerald-600" /> 1 · Upload video
                </CardTitle>
                <CardDescription className="text-xs">
                  Drop a short clip, talk, or reel. Audio is extracted with ffmpeg and transcribed via ASR.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <UploadZone file={file} onFile={handleFile} disabled={busy} />
                <LanguageSelector value={language} onChange={setLanguage} disabled={busy} />

                <div className="flex flex-col gap-2">
                  <Button
                    onClick={runPipeline}
                    disabled={!file || busy}
                    className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-sm hover:from-emerald-700 hover:to-emerald-800"
                    size="lg"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {stage === 'transcribing'
                          ? 'Transcribing…'
                          : stage === 'generating-notes'
                            ? 'Generating notes…'
                            : regeneratingNotes
                              ? 'Regenerating…'
                              : 'Working…'}
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Transcribe &amp; generate notes
                      </>
                    )}
                  </Button>

                  {transcript && !busy && (
                    <Button
                      onClick={regenerateNotes}
                      variant="outline"
                      className="w-full border-emerald-500/40 text-emerald-700 hover:bg-emerald-50"
                    >
                      <RotateCw className="mr-2 h-3.5 w-3.5" />
                      Regenerate notes only
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Pipeline progress */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Pipeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2.5">
                  {STEPS.map((s, i) => {
                    const done = i < stageIndex || (s.key === 'infographic' && infographicDone)
                    const activeNow = i === stageIndex || (s.key === 'infographic' && infographicLoading)
                    return (
                      <li key={s.key} className="flex items-center gap-2.5 text-sm">
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        ) : activeNow ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-600" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                        )}
                        <span className={done || activeNow ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                          {s.label}
                        </span>
                        <span className="font-urdu text-xs text-muted-foreground" dir="rtl">
                          {s.urdu}
                        </span>
                        {s.key === 'infographic' && !done && !activeNow && notes && (
                          <span className="ml-auto text-[10px] text-muted-foreground">optional</span>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </CardContent>
            </Card>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription className="break-words">{error}</AlertDescription>
              </Alert>
            )}
          </div>
          )}

          {/* Right: results (full-width in shared view) */}
          <div className={sharedMode ? 'lg:col-span-5' : 'lg:col-span-3'}>
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      Results
                      {loadedNoteId && (
                        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                          from history
                        </Badge>
                      )}
                    </CardTitle>
                    <TabsList>
                      <TabsTrigger value="notes" disabled={!notes}>
                        <FileText className="mr-1.5 h-3.5 w-3.5" /> Notes
                      </TabsTrigger>
                      <TabsTrigger value="transcript" disabled={!transcript}>
                        <ScrollText className="mr-1.5 h-3.5 w-3.5" /> Transcript
                      </TabsTrigger>
                      <TabsTrigger value="infographic" disabled={!notes}>
                        <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Infographic
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="notes" className="mt-4">
                    {notes ? (
                      <div className="animate-rn-fade-up">
                        <NotesView
                          english={notes.english}
                          urdu={notes.urdu}
                          infographicEn={infographicEn}
                          infographicUr={infographicUr}
                          videoName={videoName}
                          noteId={notes.noteId ?? loadedNoteId}
                          onEdit={() => setEditorOpen(true)}
                          readOnly={sharedMode}
                        />
                      </div>
                    ) : (
                      <EmptyState
                        icon={<FileText className="h-8 w-8" />}
                        title="No notes yet"
                        desc="Upload a video and run the pipeline to generate structured notes."
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="transcript" className="mt-4">
                    {transcript ? (
                      <div className="animate-rn-fade-up">
                        <TranscriptView transcript={transcript.transcript} meta={transcript.meta} />
                      </div>
                    ) : (
                      <EmptyState
                        icon={<ScrollText className="h-8 w-8" />}
                        title="No transcript yet"
                        desc="The transcribed text will appear here after processing."
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="infographic" className="mt-4">
                    {notes ? (
                      <div className="animate-rn-fade-up">
                        <InfographicView
                          english={infographicEn}
                          urdu={infographicUr}
                          loading={infographicLoading}
                          canGenerate={!!notes}
                          onGenerate={generateInfographic}
                          theme={theme}
                          onThemeChange={setTheme}
                        />
                      </div>
                    ) : (
                      <EmptyState
                        icon={<ImageIcon className="h-8 w-8" />}
                        title="No notes to visualize"
                        desc="Generate notes first, then turn them into a PNG infographic."
                      />
                    )}
                  </TabsContent>
                </Tabs>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* History (hidden in shared view) */}
        {!sharedMode && (
          <div className="mt-6">
            <HistoryPanel
              onLoad={loadHistoryNote}
              activeId={loadedNoteId}
              refreshKey={historyRefreshKey}
              onDeleted={handleNotesDeleted}
            />
          </div>
        )}
      </main>

      {/* ---------------- Footer ---------------- */}
      <footer className="mt-auto border-t border-border/60 bg-background/60">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p className="flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-amber-500" />
            Reel → Notes · Next.js 16 · Playwright + Noto Nastaliq Urdu · ffmpeg + z-ai ASR/LLM
          </p>
          <p className="inline-flex items-center gap-1">
            Built with <Heart className="h-3 w-3 fill-red-500 text-red-500" /> for bilingual creators
          </p>
        </div>
      </footer>

      {/* Inline note editor modal */}
      <NoteEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        english={notes?.english}
        urdu={notes?.urdu}
        noteId={notes?.noteId ?? loadedNoteId}
        videoName={videoName}
        onSaved={handleNotesSaved}
      />

      {/* Keyboard shortcuts dialog */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-emerald-600" />
              Keyboard shortcuts
            </DialogTitle>
            <DialogDescription>Press these anywhere outside of text fields.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            {[
              { keys: ['⌘', 'G'], action: 'Generate / regenerate infographic' },
              { keys: ['⌘', 'E'], action: 'Edit notes' },
              { keys: ['⌘', '1'], action: 'Switch to Notes tab' },
              { keys: ['⌘', '2'], action: 'Switch to Transcript tab' },
              { keys: ['⌘', '3'], action: 'Switch to Infographic tab' },
              { keys: ['⌘', 'K'], action: 'Toggle this shortcuts dialog' },
            ].map((s) => (
              <div key={s.action} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <span className="text-sm">{s.action}</span>
                <span className="flex shrink-0 gap-1">
                  {s.keys.map((k) => (
                    <kbd
                      key={k}
                      className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-background px-1.5 font-mono text-xs font-semibold shadow-sm"
                    >
                      {k}
                    </kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setShortcutsOpen(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FeatureChip({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/60 px-3 py-2.5 backdrop-blur-sm">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
        {icon}
      </div>
      <div className="min-w-0 leading-tight">
        <div className="text-xs font-semibold">{title}</div>
        <div className="truncate text-[10px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  )
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{desc}</p>
    </div>
  )
}

// Keep the Download import referenced (used by child components via re-export pattern)
void Download
