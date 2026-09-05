import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import ZAI from 'z-ai-web-dev-sdk'
import { extractAudio, fileToBase64, cleanupDir, probeDuration } from '@/lib/audio'

export const runtime = 'nodejs'
// Video upload + ffmpeg + ASR can take a while.
export const maxDuration = 300

const MAX_BYTES = 120 * 1024 * 1024 // 120 MB upload cap

export async function POST(req: NextRequest) {
  let tmpDir: string | null = null
  try {
    const form = await req.formData()
    const file = form.get('video')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No video file provided. Upload a file under the "video" field.' }, { status: 400 })
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'The uploaded video is empty.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `Video too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_BYTES / 1024 / 1024} MB.` }, { status: 413 })
    }

    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase()
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reel-upload-'))
    const videoPath = path.join(tmpDir, `input.${ext}`)
    const buf = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(videoPath, buf)

    const duration = await probeDuration(videoPath)

    // 1) Extract audio (mono 16kHz WAV) via ffmpeg
    const audioPath = await extractAudio(videoPath)

    try {
      // 2) Transcribe via ASR
      const base64 = await fileToBase64(audioPath)
      const zai = await ZAI.create()
      const resp = await zai.audio.asr.create({ file_base64: base64 })
      const transcript = (resp.text || '').trim()

      if (!transcript) {
        return NextResponse.json({ error: 'Transcription returned empty text. The video may have no audible speech.' }, { status: 422 })
      }

      return NextResponse.json({
        transcript,
        meta: {
          filename: file.name,
          sizeBytes: file.size,
          durationSec: duration,
          wordCount: transcript.split(/\s+/).filter(Boolean).length,
        },
      })
    } finally {
      await cleanupDir(path.dirname(audioPath)).catch(() => {})
    }
  } catch (err) {
    console.error('[/api/transcribe] error', err)
    const message = err instanceof Error ? err.message : 'Unknown transcription error'
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    if (tmpDir) await cleanupDir(tmpDir).catch(() => {})
  }
}
