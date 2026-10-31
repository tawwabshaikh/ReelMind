import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { extractAudio, cleanupDir, probeDuration, chunkAudio } from '@/lib/audio'
import { AIProviderError, transcribeAudioFile } from '@/lib/ai-provider'
import { downloadVideoUrl, VideoUrlError } from '@/lib/video-url'

export const runtime = 'nodejs'
// Video upload + ffmpeg + ASR can take a while (especially multi-chunk).
export const maxDuration = 300

const MAX_BYTES = 120 * 1024 * 1024 // 120 MB upload cap

export async function POST(req: NextRequest) {
  let tmpDir: string | null = null
  let chunkDir: string | null = null
  try {
    const form = await req.formData()
    const uploadedFile = form.get('video')
    const videoUrl = form.get('url')
    const file = uploadedFile instanceof File ? uploadedFile : null
    if (!file && (typeof videoUrl !== 'string' || !videoUrl.trim())) {
      return NextResponse.json({ error: 'Upload a video or provide a direct video URL.' }, { status: 400 })
    }

    if (file && file.size === 0) {
      return NextResponse.json({ error: 'The uploaded video is empty.' }, { status: 400 })
    }
    if (file && file.size > MAX_BYTES) {
      return NextResponse.json({ error: `Video too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_BYTES / 1024 / 1024} MB.` }, { status: 413 })
    }

    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reel-upload-'))
    let videoPath: string
    let videoName: string
    let sizeBytes: number
    if (file) {
      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4'
      videoPath = path.join(tmpDir, `input.${ext}`)
      await fs.writeFile(videoPath, Buffer.from(await file.arrayBuffer()))
      videoName = file.name
      sizeBytes = file.size
    } else {
      const downloaded = await downloadVideoUrl(videoUrl as string, path.join(tmpDir, 'linked-video.mp4'), MAX_BYTES)
      videoPath = downloaded.path
      videoName = downloaded.filename
      sizeBytes = downloaded.sizeBytes
    }

    const duration = await probeDuration(videoPath)

    // 1) Extract audio (mono 16kHz WAV) via ffmpeg
    const audioPath = await extractAudio(videoPath)

    try {
      // 2) Chunk into ≤28s segments (the ASR API has a 30s limit per request).
      //    Short audio skips chunking entirely.
      const { dir: cDir, segments } = await chunkAudio(audioPath, duration)
      chunkDir = cDir

      const parts: string[] = []
      let chunkErrors = 0

      // 3) Transcribe each segment sequentially and concatenate.
      //    Per-chunk try/catch: if one chunk fails (e.g. ASR hiccup), skip it
      //    and continue with the rest rather than failing the whole request.
      for (let i = 0; i < segments.length; i++) {
        const segPath = segments[i]
        try {
          const text = await transcribeAudioFile(segPath)
          if (text) {
            parts.push(text)
          }
        } catch (chunkErr) {
          if (chunkErr instanceof AIProviderError) throw chunkErr
          chunkErrors++
          console.error(`[/api/transcribe] chunk ${i + 1}/${segments.length} failed:`, chunkErr instanceof Error ? chunkErr.message : chunkErr)
        }
      }

      const transcript = parts.join(' ').replace(/\s+/g, ' ').trim()

      if (!transcript) {
        const msg = chunkErrors > 0
          ? `Transcription failed for all ${segments.length} segment(s). The ASR API may be temporarily unavailable or the audio format may be unsupported.`
          : 'Transcription returned empty text. The video may have no audible speech.'
        return NextResponse.json({ error: msg }, { status: 422 })
      }

      return NextResponse.json({
        transcript,
        meta: {
          filename: videoName,
          sizeBytes,
          durationSec: duration,
          wordCount: transcript.split(/\s+/).filter(Boolean).length,
          segments: segments.length,
          segmentErrors: chunkErrors > 0 ? chunkErrors : undefined,
        },
      })
    } finally {
      await cleanupDir(path.dirname(audioPath)).catch(() => {})
      if (chunkDir) await cleanupDir(chunkDir).catch(() => {})
    }
  } catch (err) {
    console.error('[/api/transcribe] error', err)
    if (err instanceof VideoUrlError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof AIProviderError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Unknown transcription error'
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    if (tmpDir) await cleanupDir(tmpDir).catch(() => {})
  }
}
