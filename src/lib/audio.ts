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
