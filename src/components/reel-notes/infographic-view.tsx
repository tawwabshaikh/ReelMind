'use client'

import { Download, ImageIcon, Sparkles, Loader2, Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ThemeSelector } from '@/components/reel-notes/theme-selector'
import type { InfographicFile, Theme } from '@/lib/types'

interface Props {
  english: InfographicFile | null
  urdu: InfographicFile | null
  loading: boolean
  canGenerate: boolean
  onGenerate: () => void
  theme: Theme
  onThemeChange: (t: Theme) => void
}

function InfographicCard({ file, lang }: { file: InfographicFile; lang: 'english' | 'urdu' }) {
  const isUrdu = lang === 'urdu'
  return (
    <div className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-50 text-emerald-700">
            <Languages className="mr-1 h-3 w-3" />
            {isUrdu ? 'اردو' : 'EN'}
          </Badge>
          <span className="text-xs text-muted-foreground">1080 × 1350 · PNG</span>
        </div>
        <Button asChild size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700">
          <a href={file.url} download={file.filename}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            PNG
          </a>
        </Button>
      </div>
      <div className="bg-muted/20 p-3">
        <div className="overflow-hidden rounded-lg ring-1 ring-border">
          <img
            src={file.url}
            alt={`Infographic (${lang})`}
            className="mx-auto w-full max-w-[420px] shadow-md transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>
      </div>
    </div>
  )
}

export function InfographicView({ english, urdu, loading, canGenerate, onGenerate, theme, onThemeChange }: Props) {
  const hasAny = english || urdu

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold">Visual infographic</span>
          <Badge variant="secondary" className="bg-amber-100/70 text-amber-800">Instagram-ready</Badge>
        </div>
        <Button
          onClick={onGenerate}
          disabled={!canGenerate || loading}
          className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Rendering…
            </>
          ) : hasAny ? (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Regenerate
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate infographic
            </>
          )}
        </Button>
      </div>

      <div className="rounded-xl border border-dashed border-amber-300/50 bg-amber-50/40 p-3.5 dark:bg-amber-950/10">
        <ThemeSelector value={theme} onChange={onThemeChange} disabled={loading} />
      </div>

      {!hasAny && !loading && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
            <ImageIcon className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">No infographic yet</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Generate a clean card-style PNG from your notes — with correct RTL + Nastaliq shaping for Urdu.
            </p>
          </div>
        </div>
      )}

      {loading && !hasAny && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-sm text-muted-foreground">Launching headless Chromium & rendering…</p>
        </div>
      )}

      {hasAny && (
        <div className="grid gap-5 md:grid-cols-2">
          {english && <InfographicCard file={english} lang="english" />}
          {urdu && <InfographicCard file={urdu} lang="urdu" />}
        </div>
      )}
    </div>
  )
}
