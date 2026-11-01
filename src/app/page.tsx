'use client'

import { useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  Loader2,
  ArrowRight,
  FileText,
  ScrollText,
  Image as ImageIcon,
  CheckCircle2,
  Circle,
  AlertCircle,
  RotateCw,
  Share2,
  Keyboard,
  Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { UploadZone, type VideoSourceMode } from '@/components/reel-notes/upload-zone'
import { LanguageSelector } from '@/components/reel-notes/language-selector'
import { NotesView } from '@/components/reel-notes/notes-view'
import { TranscriptView } from '@/components/reel-notes/transcript-view'
import { InfographicView } from '@/components/reel-notes/infographic-view'
import { HistoryPanel } from '@/components/reel-notes/history-panel'
import { NoteEditor } from '@/components/reel-notes/note-editor'
import { CompareDialog } from '@/components/reel-notes/compare-dialog'
import { ThemeToggle } from '@/components/reel-notes/theme-toggle'
import { ShareButton } from '@/components/reel-notes/share-button'
import { ReelMindLogo } from '@/components/reel-notes/reelmind-logo'
import { safeJsonFetch } from '@/lib/safe-fetch'
import { isLikelyHinglish, isLikelyUrdu } from '@/lib/hinglish'
import type {
  NoteLanguage,
  Theme,
  TranscribeResponse,
  GenerateNotesResponse,
  GenerateInfographicResponse,
  NoteDetailResponse,
  NoteDetail,
  InfographicFile,
} from '@/lib/types'

type Stage = 'idle' | 'transcribing' | 'translating-transcript' | 'generating-notes' | 'done'

const STEPS: { key: Stage | 'infographic'; label: string }[] = [
  { key: 'transcribing', label: 'Transcribe' },
  { key: 'generating-notes', label: 'Summarize' },
  { key: 'done', label: 'Create notes' },
  { key: 'infographic', label: 'Create infographic' },
]

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [sourceMode, setSourceMode] = useState<VideoSourceMode>('file')
  const [videoUrl, setVideoUrl] = useState('')
  const [language, setLanguage] = useState<NoteLanguage>('english')
  const [theme, setTheme] = useState<Theme>('emerald')

  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)

  const [transcript, setTranscript] = useState<TranscribeResponse | null>(null)
  const [notes, setNotes] = useState<GenerateNotesResponse | null>(null)

  const [infographicEn, setInfographicEn] = useState<InfographicFile | null>(null)
  const [infographicUr, setInfographicUr] = useState<InfographicFile | null>(null)
  const [infographicHi, setInfographicHi] = useState<InfographicFile | null>(null)
  const [infographicLoading, setInfographicLoading] = useState(false)

  const [activeTab, setActiveTab] = useState<string>('notes')
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [loadedNoteId, setLoadedNoteId] = useState<string | null>(null)
  const [regeneratingNotes, setRegeneratingNotes] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [videoName, setVideoName] = useState<string>('')
  const [sharedMode, setSharedMode] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareIds, setCompareIds] = useState<{ a: string | null; b: string | null }>({ a: null, b: null })

  const busy = stage === 'transcribing' || stage === 'translating-transcript' || stage === 'generating-notes' || regeneratingNotes

  const translateTranscriptIfNeeded = useCallback(async (text: string, outputLanguage: NoteLanguage) => {
    const alreadyInLanguage = outputLanguage === 'hinglish'
      ? isLikelyHinglish(text)
      : outputLanguage === 'urdu'
        ? isLikelyUrdu(text)
        : true
    if (alreadyInLanguage) return text
    const { data, error } = await safeJsonFetch<{ transcript: string }>('/api/translate-transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: text, language: outputLanguage }),
    })
    if (error) throw new Error(error)
    if (!data?.transcript) throw new Error(`${outputLanguage === 'urdu' ? 'Urdu' : 'Hinglish'} transcript translation returned no text.`)
    return data.transcript
  }, [])

  // ---- Share-link detection: ?share=<id> loads a read-only note ----
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shareId = params.get('share')
    if (!shareId) return
    ;(async () => {
      try {
        const { data, error } = await safeJsonFetch<NoteDetailResponse>(`/api/notes/${shareId}`)
        if (error) throw new Error(error)
        if (!data) throw new Error('Shared note not found')
        const d = data
        const n = d.note
        setSharedMode(true)
        const noteLanguage = n.language === 'urdu' || n.language === 'hinglish' ? n.language : 'english'
        const transcriptText = await translateTranscriptIfNeeded(n.transcript, noteLanguage)
        const wordCount = transcriptText.split(/\s+/).filter(Boolean).length
        setTranscript({
          transcript: transcriptText,
          meta: {
            filename: n.videoName,
            sizeBytes: n.sizeBytes ?? 0,
            durationSec: n.durationSec,
            wordCount,
          },
        })
        setNotes({
          noteId: n.id,
          language: n.language === 'urdu' || n.language === 'hinglish' ? n.language : 'english',
          english: n.english,
          urdu: n.urdu,
          hinglish: n.hinglish,
        })
        setInfographicEn(n.infographicEn)
        setInfographicUr(n.infographicUr)
        setInfographicHi(n.infographicHi)
        setLoadedNoteId(n.id)
        setVideoName(n.videoName)
        setStage('done')
        setActiveTab('notes')
        toast.success(`Viewing shared note: ${n.videoName}`)
      } catch (e) {
        setSharedMode(true)
        toast.error(e instanceof Error ? e.message : 'Failed to load shared note')
      }
    })()
  }, [translateTranscriptIfNeeded])

  const reset = useCallback(() => {
    setTranscript(null)
    setNotes(null)
    setInfographicEn(null)
    setInfographicUr(null)
    setInfographicHi(null)
    setError(null)
    setStage('idle')
    setLoadedNoteId(null)
    setVideoName('')
  }, [])

  const handleFile = useCallback(
    (f: File | null) => {
      setFile(f)
      setSourceMode('file')
      reset()
    },
    [reset],
  )

  const runPipeline = useCallback(async () => {
    if (sourceMode === 'file' && !file) {
      toast.error('Choose a video file first.')
      return
    }
    if (sourceMode === 'link' && !videoUrl.trim()) {
      toast.error('Paste a direct video link first.')
      return
    }
    setError(null)
    setTranscript(null)
    setNotes(null)
    setInfographicEn(null)
    setInfographicUr(null)
    setInfographicHi(null)
    setLoadedNoteId(null)
    setActiveTab('transcript')

    // ---- Stage 1: transcribe ----
    setStage('transcribing')
    let tr: TranscribeResponse
    try {
      const fd = new FormData()
      if (sourceMode === 'file' && file) fd.append('video', file)
      else fd.append('url', videoUrl.trim())
      const { data, error } = await safeJsonFetch<TranscribeResponse>('/api/transcribe', { method: 'POST', body: fd })
      if (error) throw new Error(error)
      if (!data) throw new Error('Transcription returned no data')
      tr = data
      if ((language === 'hinglish' && !isLikelyHinglish(tr.transcript)) || (language === 'urdu' && !isLikelyUrdu(tr.transcript))) {
        setStage('translating-transcript')
        const translated = await translateTranscriptIfNeeded(tr.transcript, language)
        tr = {
          ...tr,
          transcript: translated,
          meta: { ...tr.meta, wordCount: translated.split(/\s+/).filter(Boolean).length },
        }
      }
      setTranscript(tr)
      toast.success(language === 'english' ? `Transcribed · ${tr.meta.wordCount} words` : `${language === 'urdu' ? 'Urdu' : 'Hinglish'} transcript ready · ${tr.meta.wordCount} words`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transcription/translation error'
      setError(msg)
      setStage('idle')
      toast.error(msg)
      return
    }

    // ---- Stage 2: generate notes ----
    setStage('generating-notes')
    setActiveTab('notes')
    setVideoName(tr.meta.filename)
    try {
      const { data, error } = await safeJsonFetch<GenerateNotesResponse>('/api/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: tr.transcript,
          language,
          videoName: tr.meta.filename,
          durationSec: tr.meta.durationSec,
          sizeBytes: tr.meta.sizeBytes,
          wordCount: tr.meta.wordCount,
        }),
      })
      if (error) throw new Error(error)
      if (!data) throw new Error('Notes generation returned no data')
      const n = data
      setNotes(n)
      setLoadedNoteId(n.noteId)
      setStage('done')
      setHistoryRefreshKey((k) => k + 1)
      toast.success(
        language === 'urdu'
            ? 'Urdu notes ready (Nastaliq)'
            : language === 'hinglish'
              ? 'Hinglish notes ready'
              : 'English notes ready',
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Notes generation error'
      setError(msg)
      setStage('idle')
      toast.error(msg)
    }
  }, [file, language, sourceMode, videoUrl, translateTranscriptIfNeeded])

  const regenerateNotes = useCallback(async () => {
    if (!transcript) return
    setRegeneratingNotes(true)
    setError(null)
    setInfographicEn(null)
    setInfographicUr(null)
    setInfographicHi(null)
    setActiveTab('notes')
    setVideoName(transcript.meta.filename)
    try {
      let transcriptText = transcript.transcript
      if ((language === 'hinglish' && !isLikelyHinglish(transcriptText)) || (language === 'urdu' && !isLikelyUrdu(transcriptText))) {
        setStage('translating-transcript')
        transcriptText = await translateTranscriptIfNeeded(transcriptText, language)
        const updatedTranscript = {
          ...transcript,
          transcript: transcriptText,
          meta: { ...transcript.meta, wordCount: transcriptText.split(/\s+/).filter(Boolean).length },
        }
        setTranscript(updatedTranscript)
      }
      setStage('generating-notes')
      const { data, error } = await safeJsonFetch<GenerateNotesResponse>('/api/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcriptText,
          language,
          videoName: transcript.meta.filename,
          durationSec: transcript.meta.durationSec,
          sizeBytes: transcript.meta.sizeBytes,
          wordCount: transcriptText.split(/\s+/).filter(Boolean).length,
        }),
      })
      if (error) throw new Error(error)
      if (!data) throw new Error('Notes generation returned no data')
      const n = data
      setNotes(n)
      setLoadedNoteId(n.noteId)
      setHistoryRefreshKey((k) => k + 1)
      toast.success('Notes regenerated')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Notes regeneration error'
      setError(msg)
      toast.error(msg)
    } finally {
      setRegeneratingNotes(false)
      setStage('done')
    }
  }, [transcript, language, translateTranscriptIfNeeded])

  const generateInfographic = useCallback(async () => {
    if (!notes) return
    setInfographicLoading(true)
    setError(null)
    try {
      const { data, error } = await safeJsonFetch<GenerateInfographicResponse>('/api/generate-infographic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          english: notes.english?.structured,
          urdu: notes.urdu?.structured,
          hinglish: notes.hinglish?.structured,
          noteId: notes.noteId ?? loadedNoteId,
          theme,
        }),
      })
      if (error) throw new Error(error)
      if (!data) throw new Error('Infographic generation returned no data')
      const r = data
      setInfographicEn(r.english)
      setInfographicUr(r.urdu)
      setInfographicHi(r.hinglish)
      setHistoryRefreshKey((k) => k + 1)
      setActiveTab('infographic')
      toast.success('Infographic rendered')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Infographic error'
      setError(msg)
      toast.error(msg)
    } finally {
      setInfographicLoading(false)
    }
  }, [notes, theme, loadedNoteId])

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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
  }, [notes, transcript, infographicLoading, sharedMode, generateInfographic])

  const loadHistoryNote = useCallback(async (id: string) => {
    setError(null)
    try {
      const { data, error } = await safeJsonFetch<NoteDetailResponse>(`/api/notes/${id}`)
      if (error) throw new Error(error)
      if (!data) throw new Error('Note not found')
      const d = data
      const n = d.note
      const noteLanguage = n.language === 'urdu' || n.language === 'hinglish' ? n.language : 'english'
      const transcriptText = await translateTranscriptIfNeeded(n.transcript, noteLanguage)
      const wordCount = transcriptText.split(/\s+/).filter(Boolean).length
      setTranscript({
        transcript: transcriptText,
        meta: {
          filename: n.videoName,
          sizeBytes: n.sizeBytes ?? 0,
          durationSec: n.durationSec,
          wordCount,
        },
      })
      setNotes({
        noteId: n.id,
        language: n.language === 'urdu' || n.language === 'hinglish' ? n.language : 'english',
        english: n.english,
        urdu: n.urdu,
        hinglish: n.hinglish,
      })
      setInfographicEn(n.infographicEn)
      setInfographicUr(n.infographicUr)
      setInfographicHi(n.infographicHi)
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
  }, [translateTranscriptIfNeeded])

  const stageIndex = (() => {
    if (stage === 'idle') return -1
    if (stage === 'transcribing' || stage === 'translating-transcript') return 0
    if (stage === 'generating-notes') return 1
    if (stage === 'done') return 2
    return 2
  })()
  const infographicDone = !!(infographicEn || infographicUr || infographicHi)

  const handleNotesSaved = useCallback((updated: NoteDetail) => {
    setNotes({
      noteId: updated.id,
      language: updated.language === 'urdu' || updated.language === 'hinglish' ? updated.language : 'english',
      english: updated.english,
      urdu: updated.urdu,
      hinglish: updated.hinglish,
    })
    setInfographicEn(null)
    setInfographicUr(null)
    setInfographicHi(null)
    setHistoryRefreshKey((k) => k + 1)
    toast.success('Notes saved — regenerate the infographic to reflect edits.')
  }, [])

  const handleNotesDeleted = useCallback((deletedIds: string[]) => {
    if (loadedNoteId && deletedIds.includes(loadedNoteId)) {
      reset()
      toast.info('Cleared the workspace — the loaded note was deleted.')
    }
  }, [loadedNoteId, reset])

  // ---- Progress label ----
  const progressLabel = busy
    ? stage === 'transcribing'
      ? 'Transcribing…'
      : stage === 'translating-transcript'
        ? `Translating transcript to ${language === 'urdu' ? 'Urdu' : 'Hinglish'}…`
      : stage === 'generating-notes'
        ? 'Summarizing…'
        : regeneratingNotes
          ? 'Regenerating…'
          : 'Working…'
    : null

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ===================== Header ===================== */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Image
            src="/reelmind-wabsar-badge.png"
            alt="ReelMind by Wabsar"
            width={1720}
            height={430}
            priority
            className="h-auto w-[min(132px,36vw)] shrink-0 drop-shadow-[0_0_1px_rgba(51,65,85,0.8)] dark:drop-shadow-[0_0_1px_rgba(248,250,252,0.8)] sm:w-[190px]"
          />
          <div className="flex items-baseline gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">Video → Knowledge</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {sharedMode && (
              <Badge variant="outline" className="mr-1 gap-1 border-amber-500/40 text-amber-700">
                <Eye className="h-3 w-3" /> Shared
              </Badge>
            )}
            {notes && (
              <ShareButton noteId={notes.noteId ?? loadedNoteId} videoName={videoName} variant="labeled" />
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShortcutsOpen(true)}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (⌘K)"
            >
              <Keyboard className="h-4 w-4" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ===================== Hero (compact, hidden in shared view) ===================== */}
      {!sharedMode && (
        <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Turn every video into <span className="text-accent">knowledge.</span>
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
              Transcribe videos, generate structured notes, and create shareable visual summaries — in English. Urdu. Hinglish.
            </p>
            <p className="mt-2 text-xs font-semibold tracking-wide text-accent">
              Learn faster. Remember more.
            </p>
          </div>
          {/* Compact feature strip */}
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-accent" /> Transcribe
            </span>
            <span className="text-border">·</span>
            <span className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-accent" /> Understand
            </span>
            <span className="text-border">·</span>
            <span className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-accent" /> Create
            </span>
          </div>
        </section>
      )}

      {/* ===================== Shared-view banner ===================== */}
      {sharedMode && (
        <section className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-50/60 px-4 py-2.5 dark:bg-amber-950/20">
            <div className="flex items-center gap-2 text-sm">
              <Eye className="h-4 w-4 text-amber-600" />
              <span className="font-medium">You're viewing a shared note</span>
              <span className="text-muted-foreground">— read-only. Downloads still work.</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => {
                window.location.href = window.location.origin
              }}
            >
              Back to app
            </Button>
          </div>
        </section>
      )}

      {/* ===================== Main workspace ===================== */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <div className="grid gap-5 lg:grid-cols-12">
          {/* -------- LEFT: Create (40%) -------- */}
          {!sharedMode && (
            <div className="space-y-4 lg:col-span-5">
              {/* Create panel */}
              <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Create your study guide</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">Choose a video source to get started.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <UploadZone
                    file={file}
                    onFile={handleFile}
                    mode={sourceMode}
                    onModeChange={setSourceMode}
                    url={videoUrl}
                    onUrlChange={setVideoUrl}
                    disabled={busy}
                  />
                  <LanguageSelector value={language} onChange={setLanguage} disabled={busy} />

                  <Button
                    onClick={runPipeline}
                    disabled={(sourceMode === 'file' ? !file : !videoUrl.trim()) || busy}
                    className="h-11 w-full rounded-xl bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                    size="lg"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {progressLabel}
                      </>
                    ) : (
                      <>
                        Generate knowledge
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>

                  {transcript && !busy && (
                    <Button
                      onClick={regenerateNotes}
                      variant="outline"
                      className="w-full text-xs"
                      size="sm"
                    >
                      <RotateCw className="mr-1.5 h-3 w-3" />
                      Regenerate notes
                    </Button>
                  )}
                </div>
              </div>

              {/* Compact contextual progress — only visible during generation */}
              {busy && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-2.5 flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                    <span className="text-xs font-medium text-foreground">{progressLabel}</span>
                  </div>
                  <div className="space-y-1.5">
                    {STEPS.map((s, i) => {
                      const done = i < stageIndex
                      const activeNow = i === stageIndex
                      return (
                        <div key={s.key} className="flex items-center gap-2 text-xs">
                          {done ? (
                            <CheckCircle2 className="h-3 w-3 shrink-0 text-accent" />
                          ) : activeNow ? (
                            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-accent" />
                          ) : (
                            <Circle className="h-3 w-3 shrink-0 text-muted-foreground/30" />
                          )}
                          <span className={done || activeNow ? 'text-foreground' : 'text-muted-foreground/60'}>
                            {s.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Something went wrong</AlertTitle>
                  <AlertDescription className="break-words">{error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* -------- RIGHT: Results (60%) -------- */}
          <div className={sharedMode ? 'lg:col-span-12' : 'lg:col-span-7'}>
            <div className="min-h-[440px] rounded-2xl border border-border/80 bg-card shadow-sm">
              {/* Results header */}
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Results</h3>
                  {loadedNoteId && (
                    <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                      from history
                    </Badge>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="p-5">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-4 border-b border-transparent">
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

                  <TabsContent value="notes" className="mt-0">
                    {notes ? (
                      <div className="animate-rm-fade-up">
                        <NotesView
                          english={notes.english}
                          urdu={notes.urdu}
                          hinglish={notes.hinglish}
                          infographicEn={infographicEn}
                          infographicUr={infographicUr}
                          infographicHi={infographicHi}
                          videoName={videoName}
                          noteId={notes.noteId ?? loadedNoteId}
                          onEdit={() => setEditorOpen(true)}
                          readOnly={sharedMode}
                        />
                      </div>
                    ) : (
                      <EmptyState />
                    )}
                  </TabsContent>

                  <TabsContent value="transcript" className="mt-0">
                    {transcript ? (
                      <div className="animate-rm-fade-up">
                        <TranscriptView transcript={transcript.transcript} meta={transcript.meta} />
                      </div>
                    ) : (
                      <EmptyState />
                    )}
                  </TabsContent>

                  <TabsContent value="infographic" className="mt-0">
                    {notes ? (
                      <div className="animate-rm-fade-up">
                        <InfographicView
                          english={infographicEn}
                          urdu={infographicUr}
                          hinglish={infographicHi}
                          loading={infographicLoading}
                          canGenerate={!!notes}
                          onGenerate={generateInfographic}
                          theme={theme}
                          onThemeChange={setTheme}
                        />
                      </div>
                    ) : (
                      <EmptyState />
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>

        {/* History (hidden in shared view) */}
        {!sharedMode && (
          <div className="mt-5">
            <HistoryPanel
              onLoad={loadHistoryNote}
              activeId={loadedNoteId}
              refreshKey={historyRefreshKey}
              onDeleted={handleNotesDeleted}
              onCompare={(aId, bId) => {
                setCompareIds({ a: aId, b: bId })
                setCompareOpen(true)
              }}
            />
          </div>
        )}
      </main>

      {/* ===================== Footer ===================== */}
      <footer className="mt-auto border-t border-border/60">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-3 px-4 py-4 text-xs text-muted-foreground sm:grid-cols-[1fr_auto_1fr] sm:px-6">
          <p className="flex items-center justify-self-center gap-1.5 sm:justify-self-start">
            <ReelMindLogo size={14} />
            ReelMind · AI Learning · Video → Knowledge
          </p>
          <Image
            src="/built-by-wabsar.png"
            alt="Built by Wabsar"
            width={2172}
            height={724}
            className="mx-auto h-10 w-[min(360px,78vw)] object-cover"
            style={{ objectPosition: 'center 45%' }}
          />
          <p className="justify-self-center sm:justify-self-end">Watch less. Learn more.</p>
        </div>
      </footer>

      {/* Inline note editor modal */}
      <NoteEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        english={notes?.english}
        urdu={notes?.urdu}
        hinglish={notes?.hinglish}
        noteId={notes?.noteId ?? loadedNoteId}
        videoName={videoName}
        onSaved={handleNotesSaved}
      />

      {/* Multi-note comparison dialog */}
      <CompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        aId={compareIds.a}
        bId={compareIds.b}
      />

      {/* Keyboard shortcuts dialog */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-accent" />
              Keyboard shortcuts
            </DialogTitle>
            <DialogDescription>Press these anywhere outside of text fields.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {[
              { keys: ['⌘', 'G'], action: 'Generate / regenerate infographic' },
              { keys: ['⌘', 'E'], action: 'Edit notes' },
              { keys: ['⌘', '1'], action: 'Switch to Notes tab' },
              { keys: ['⌘', '2'], action: 'Switch to Transcript tab' },
              { keys: ['⌘', '3'], action: 'Switch to Infographic tab' },
              { keys: ['⌘', 'K'], action: 'Toggle this dialog' },
            ].map((s) => (
              <div key={s.action} className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2">
                <span className="text-sm">{s.action}</span>
                <span className="flex shrink-0 gap-1">
                  {s.keys.map((k) => (
                    <kbd
                      key={k}
                      className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-card px-1.5 font-mono text-xs font-medium"
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

/** Premium empty state for the Results panel. */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <FileText className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Your workspace is ready</p>
        <p className="text-xs text-muted-foreground">
          Upload a video to generate: Notes · Transcript · Infographic
        </p>
      </div>
    </div>
  )
}
