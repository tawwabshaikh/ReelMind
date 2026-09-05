'use client'

import { useState, useCallback } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { UploadZone } from '@/components/reel-notes/upload-zone'
import { LanguageSelector } from '@/components/reel-notes/language-selector'
import { NotesView } from '@/components/reel-notes/notes-view'
import { TranscriptView } from '@/components/reel-notes/transcript-view'
import { InfographicView } from '@/components/reel-notes/infographic-view'
import { HistoryPanel } from '@/components/reel-notes/history-panel'
import type {
  Language,
  TranscribeResponse,
  GenerateNotesResponse,
  GenerateInfographicResponse,
  InfographicFile,
} from '@/lib/types'

type Stage = 'idle' | 'transcribing' | 'generating-notes' | 'done'

const STEPS: { key: Stage | 'infographic'; label: string }[] = [
  { key: 'transcribing', label: 'Transcribe' },
  { key: 'generating-notes', label: 'Summarize' },
  { key: 'done', label: 'Notes' },
  { key: 'infographic', label: 'Infographic' },
]

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [language, setLanguage] = useState<Language>('english')

  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)

  const [transcript, setTranscript] = useState<TranscribeResponse | null>(null)
  const [notes, setNotes] = useState<GenerateNotesResponse | null>(null)

  const [infographicEn, setInfographicEn] = useState<InfographicFile | null>(null)
  const [infographicUr, setInfographicUr] = useState<InfographicFile | null>(null)
  const [infographicLoading, setInfographicLoading] = useState(false)

  const [activeTab, setActiveTab] = useState<string>('notes')

  const busy = stage === 'transcribing' || stage === 'generating-notes'

  const reset = useCallback(() => {
    setTranscript(null)
    setNotes(null)
    setInfographicEn(null)
    setInfographicUr(null)
    setError(null)
    setStage('idle')
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
    try {
      const res = await fetch('/api/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: tr.transcript,
          language,
          videoName: file.name,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `Notes generation failed (${res.status})`)
      const n = data as GenerateNotesResponse
      setNotes(n)
      setStage('done')
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
          noteId: notes.noteId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `Infographic failed (${res.status})`)
      const r = data as GenerateInfographicResponse
      setInfographicEn(r.english)
      setInfographicUr(r.urdu)
      setActiveTab('infographic')
      toast.success('Infographic rendered')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Infographic error'
      setError(msg)
      toast.error(msg)
    } finally {
      setInfographicLoading(false)
    }
  }, [notes])

  const stageIndex = (() => {
    if (stage === 'idle') return -1
    if (stage === 'transcribing') return 0
    if (stage === 'generating-notes') return 1
    if (stage === 'done') return 2
    return 2
  })()
  const infographicDone = !!(infographicEn || infographicUr)

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
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Source"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      {/* ---------------- Hero ---------------- */}
      <section className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
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
      </section>

      {/* ---------------- Main ---------------- */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left: config */}
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

                <Button
                  onClick={runPipeline}
                  disabled={!file || busy}
                  className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-sm hover:from-emerald-700 hover:to-emerald-800"
                  size="lg"
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {stage === 'transcribing' ? 'Transcribing…' : 'Generating notes…'}
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Transcribe &amp; generate notes
                    </>
                  )}
                </Button>
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
                    const done = (i < stageIndex) || (s.key === 'infographic' && infographicDone)
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

          {/* Right: results */}
          <div className="lg:col-span-3">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="text-base">Results</CardTitle>
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
                        <NotesView english={notes.english} urdu={notes.urdu} />
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

        {/* History */}
        <div className="mt-6">
          <HistoryPanel />
        </div>
      </main>

      {/* ---------------- Footer ---------------- */}
      <footer className="mt-auto border-t border-border/60 bg-background/60">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>
            Reel → Notes · Next.js 16 · Playwright + Noto Nastaliq Urdu · ffmpeg + z-ai ASR/LLM
          </p>
          <p className="inline-flex items-center gap-1">
            Built with <Heart className="h-3 w-3 fill-red-500 text-red-500" /> for bilingual creators
          </p>
        </div>
      </footer>
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
