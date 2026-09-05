import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

/**
 * Extract audio from a video file using ffmpeg.
 * Converts to mono WAV at 16kHz (optimal for speech recognition / Whisper-style ASR),
 * which keeps the base64 payload small and transcription accurate.
 *
 * Returns the path to the temporary WAV file. Caller is responsible for cleanup.
 */
export async function extractAudio(videoPath: string): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reel-notes-'))
  const audioPath = path.join(tmpDir, 'audio.wav')

  await new Promise<void>((resolve, reject) => {
    // -y        overwrite output
    // -i        input
    // -vn       drop video stream
    // -ac 1     mono
    // -ar 16000 16kHz sample rate (Whisper-friendly)
    // -f wav    WAV container
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i', videoPath,
      '-vn',
      '-ac', '1',
      '-ar', '16000',
      '-f', 'wav',
      audioPath,
    ])

    let stderr = ''
    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    ffmpeg.on('error', (err) => reject(new Error(`ffmpeg failed to start: ${err.message}`)))
    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}. ${stderr.slice(-500)}`))
      } else {
        resolve()
      }
    })
  })

  return audioPath
}

/** Max duration (seconds) the ASR API accepts per request. We chunk with margin. */
const ASR_MAX_SEGMENT_SEC = 28

/**
 * Split an audio file into ≤28-second WAV segments using ffmpeg's segment
 * muxer. Returns the directory containing the segments + the list of segment
 * file paths (sorted). The caller owns cleanup of the directory.
 *
 * If the audio is shorter than ASR_MAX_SEGMENT_SEC, returns a single-element
 * list containing the original audio path (no chunking needed).
 */
export async function chunkAudio(audioPath: string, durationSec: number | null): Promise<{ dir: string; segments: string[] }> {
  const dir = path.dirname(audioPath)

  // Short audio — no chunking needed.
  if (durationSec != null && durationSec <= ASR_MAX_SEGMENT_SEC) {
    return { dir, segments: [audioPath] }
  }

  const segDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reel-chunks-'))
  const pattern = path.join(segDir, 'chunk-%03d.wav')

  await new Promise<void>((resolve, reject) => {
    // -f segment           segment muxer
    // -segment_time 28     split every 28s (under the 30s ASR limit)
    // -segment_format wav   each segment is a self-contained WAV file
    // -ac 1 -ar 16000       re-encode to mono 16kHz PCM (ensures valid WAV
    //                       headers per segment — -c copy produces broken headers)
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i', audioPath,
      '-f', 'segment',
      '-segment_time', String(ASR_MAX_SEGMENT_SEC),
      '-segment_format', 'wav',
      '-ac', '1',
      '-ar', '16000',
      pattern,
    ])

    let stderr = ''
    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    ffmpeg.on('error', (err) => reject(new Error(`ffmpeg segment failed to start: ${err.message}`)))
    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg segment exited with code ${code}. ${stderr.slice(-500)}`))
      } else {
        resolve()
      }
    })
  })

  // List + sort the generated chunks (chunk-000.wav, chunk-001.wav, …)
  // and filter out any segments shorter than 0.5s (ASR may reject tiny clips).
  const files = await fs.readdir(segDir)
  const allSegments = files
    .filter((f) => f.startsWith('chunk-') && f.endsWith('.wav'))
    .sort()
    .map((f) => path.join(segDir, f))

  // Filter out very short segments (< 0.5s) — they cause ASR 400 errors.
  const segments: string[] = []
  for (const seg of allSegments) {
    const dur = await probeDuration(seg)
    if (dur == null || dur >= 0.5) {
      segments.push(seg)
    }
  }

  if (segments.length === 0) {
    // Fallback: if all segments were too short, use the original.
    return { dir, segments: [audioPath] }
  }

  return { dir: segDir, segments }
}

/**
 * Probe basic media metadata (duration in seconds) using ffprobe.
 * Returns null if probing fails (non-fatal).
 */
export async function probeDuration(filePath: string): Promise<number | null> {
  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath,
      ])
      let out = ''
      ffprobe.stdout.on('data', (c) => (out += c.toString()))
      ffprobe.on('error', reject)
      ffprobe.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`ffprobe code ${code}`))))
    })
    const d = parseFloat(stdout)
    return Number.isFinite(d) ? d : null
  } catch {
    return null
  }
}

/**
 * Read a file as base64 (for sending to ASR).
 */
export async function fileToBase64(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath)
  return buf.toString('base64')
}

/**
 * Recursively delete a directory and its contents (for temp cleanup).
 */
export async function cleanupDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true })
  } catch {
    // ignore
  }
}
