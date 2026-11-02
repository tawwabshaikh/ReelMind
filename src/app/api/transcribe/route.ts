import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { extractAudio, cleanupDir, probeDuration } from '@/lib/audio'
import { AIProviderError, transcribeAudioFile } from '@/lib/ai-provider'
import { downloadVideoUrl, validateVideoUrl, VideoUrlError } from '@/lib/video-url'
import { currentUserId } from '@/lib/session'
import { callProcessingWorker, ProcessingWorkerError } from '@/lib/processing-worker'
import { db } from '@/lib/db'
import type { TranscribeResponse } from '@/lib/types'

export const runtime = 'nodejs'
// Video upload + ffmpeg + ASR can take a while (especially multi-chunk).
export const maxDuration = 300

const MAX_BYTES = 120 * 1024 * 1024 // 120 MB upload cap

export async function POST(req: NextRequest) {
  let tmpDir: string | null = null
  try {
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    await db.processingJob.deleteMany({ where: { userId, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
    const form = await req.formData()
    const uploadedFile = form.get('video')
    const videoUrl = form.get('url')
    const blobValue = form.get('blobPathname')
    const blobPathname = typeof blobValue === 'string' && blobValue.trim() ? blobValue.trim() : null
    const uploadedFilename = form.get('filename')
    const file = uploadedFile instanceof File ? uploadedFile : null
    const hasBlobPath = !!blobPathname
    if (!file && !hasBlobPath && (typeof videoUrl !== 'string' || !videoUrl.trim())) {
      return NextResponse.json({ error: 'Upload a video or provide a direct video URL.' }, { status: 400 })
    }

    if (process.env.VERCEL === '1') {
      if (file) return NextResponse.json({ error: 'Use the secure direct upload flow for video files on this deployment.' }, { status: 413 })
      if (blobPathname && (!blobPathname.startsWith(`uploads/${userId}/`) || !/^uploads\/[^/]+\/[A-Za-z0-9._-]+$/.test(blobPathname))) {
        return NextResponse.json({ error: 'Uploaded video is not owned by this account.' }, { status: 403 })
      }
      const safeUrl = typeof videoUrl === 'string' && videoUrl.trim()
        ? (await validateVideoUrl(videoUrl)).toString()
        : undefined
      const job = await db.processingJob.create({ data: { userId }, select: { id: true } })
      try {
        const result = await callProcessingWorker<{ jobId: string }>('transcribe', {
          userId,
          blobPathname: blobPathname || undefined,
          filename: typeof uploadedFilename === 'string' ? uploadedFilename.slice(0, 180) : undefined,
          videoUrl: safeUrl,
          maxBytes: MAX_BYTES,
        })
        await db.processingJob.update({ where: { id: job.id }, data: { workerJobId: result.jobId, status: 'processing' } })
        return NextResponse.json({ jobId: job.id, status: 'processing' }, { status: 202 })
      } catch (error) {
        await db.processingJob.deleteMany({ where: { id: job.id, userId } }).catch(() => {})
        if (blobPathname) {
          const { del } = await import('@vercel/blob')
          await del(blobPathname).catch(() => {})
        }
        throw error
      }
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
    } else if (typeof videoUrl === 'string' && videoUrl.trim()) {
      const downloaded = await downloadVideoUrl(videoUrl as string, path.join(tmpDir, 'linked-video.mp4'), MAX_BYTES)
      videoPath = downloaded.path
      videoName = downloaded.filename
      sizeBytes = downloaded.sizeBytes
    } else {
      return NextResponse.json({ error: 'Uploaded video data is missing.' }, { status: 400 })
    }

    const duration = await probeDuration(videoPath)

    // 1) Extract audio (mono 16kHz WAV) via ffmpeg
    const audioPath = await extractAudio(videoPath)

    try {
      // Local whisper.cpp handles long audio in one process, so don't split
      // it into 28-second jobs that each reload the model.
      const transcript = (await transcribeAudioFile(audioPath)).replace(/\s+/g, ' ').trim()

      if (!transcript) {
        return NextResponse.json({ error: 'Transcription returned empty text. The video may have no audible speech.' }, { status: 422 })
      }

      return NextResponse.json({
        transcript,
        meta: {
          filename: videoName,
          sizeBytes,
          durationSec: duration,
          wordCount: transcript.split(/\s+/).filter(Boolean).length,
          segments: 1,
        },
      })
    } finally {
      await cleanupDir(path.dirname(audioPath)).catch(() => {})
    }
  } catch (err) {
    console.error('[/api/transcribe] error', err)
    if (err instanceof VideoUrlError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof AIProviderError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof ProcessingWorkerError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Unknown transcription error'
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    if (tmpDir) await cleanupDir(tmpDir).catch(() => {})
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const jobId = request.nextUrl.searchParams.get('jobId')
    if (!jobId) return NextResponse.json({ error: 'Missing processing job ID.' }, { status: 400 })
    const job = await db.processingJob.findFirst({ where: { id: jobId, userId } })
    if (!job) return NextResponse.json({ error: 'Processing job not found.' }, { status: 404 })
    if (job.status === 'complete' && job.resultJson) {
      return NextResponse.json({ status: 'complete', result: JSON.parse(job.resultJson) })
    }
    if (job.status === 'failed') return NextResponse.json({ status: 'failed', error: job.errorMessage || 'Transcription failed.' })
    if (!job.workerJobId) return NextResponse.json({ status: job.status })

    const state = await callProcessingWorker<{ status: 'processing' | 'complete' | 'failed'; result?: TranscribeResponse; error?: string }>(
      'job-status', { jobId: job.workerJobId, userId },
    )
    if (state.status === 'complete') {
      if (!state.result) return NextResponse.json({ error: 'Worker returned no transcription result.' }, { status: 502 })
      await db.processingJob.update({ where: { id: job.id }, data: { status: 'complete', resultJson: JSON.stringify(state.result) } })
      return NextResponse.json({ status: 'complete', result: state.result })
    }
    if (state.status === 'failed') {
      await db.processingJob.update({ where: { id: job.id }, data: { status: 'failed', errorMessage: state.error || 'Transcription failed.' } })
      return NextResponse.json({ status: 'failed', error: state.error || 'Transcription failed.' })
    }
    return NextResponse.json({ status: 'processing' })
  } catch (err) {
    if (err instanceof ProcessingWorkerError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[/api/transcribe GET] error', err)
    return NextResponse.json({ error: 'Could not check transcription status.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const jobId = request.nextUrl.searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'Missing processing job ID.' }, { status: 400 })
  await db.processingJob.deleteMany({ where: { id: jobId, userId } })
  return NextResponse.json({ ok: true })
}
