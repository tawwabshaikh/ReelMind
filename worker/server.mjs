import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable, Transform } from 'node:stream'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { timingSafeEqual, randomUUID } from 'node:crypto'
import { del, get } from '@vercel/blob'

const PORT = Number(process.env.PORT || 8080)
const API_TOKEN = process.env.PROCESSING_WORKER_TOKEN || ''
const MAX_VIDEO_BYTES = Number(process.env.MAX_VIDEO_BYTES || 125829120)
const WHISPER_MODEL_PATH = process.env.WHISPER_MODEL_PATH || '/models/ggml-small.bin'
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://ollama:11434').replace(/\/+$/, '')
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3:4b-instruct'
let activeJobs = 0
const MAX_ACTIVE_JOBS = Number(process.env.MAX_ACTIVE_JOBS || 2)
const jobs = new Map()

if (!API_TOKEN) throw new Error('PROCESSING_WORKER_TOKEN is required')

function authorized(request) {
  const header = request.headers.authorization || ''
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : ''
  const expectedBytes = Buffer.from(API_TOKEN)
  const suppliedBytes = Buffer.from(supplied)
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes)
}

function json(response, status, data) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(data))
}

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 1_000_000) throw new Error('Request body is too large.')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

function run(command, args, timeoutMs = 240_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(() => child.kill('SIGTERM'), timeoutMs)
    child.stdout.on('data', (chunk) => { stdout = (stdout + chunk.toString()).slice(-100_000) })
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-4000) })
    child.on('error', () => { clearTimeout(timeout); reject(new Error(`${command} is not installed.`)) })
    child.on('close', (code) => {
      clearTimeout(timeout)
      if (code !== 0) return reject(new Error(`${command} failed${stderr ? ` (${stderr.slice(-700)})` : ''}`))
      resolve({ stdout, stderr })
    })
  })
}

function isPrivateIp(address) {
  const version = isIP(address)
  if (version === 4) {
    const [a, b] = address.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  }
  if (version === 6) {
    const first = Number.parseInt(address.split(':')[0] || '0', 16)
    return address === '::1' || address.startsWith('fe80:') || address.startsWith('fc') || address.startsWith('fd') || first < 0x2000 || first > 0x3fff
  }
  return true
}

async function validatePublicUrl(value) {
  let url
  try { url = new URL(value) } catch { throw new Error('Video URL is invalid.') }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || isIP(url.hostname)) throw new Error('Only public HTTPS video URLs are supported.')
  const addresses = await lookup(url.hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) throw new Error('Video URL must resolve to a public host.')
  return url
}

async function downloadDirect(url, outputPath) {
  for (let redirects = 0; redirects <= 4; redirects++) {
    url = await validatePublicUrl(url.toString())
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(210_000), headers: { 'user-agent': 'ReelMind/1.0' } })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (!location || redirects === 4) throw new Error('Video link redirected too many times.')
      url = new URL(location, url)
      continue
    }
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (!response.ok || !response.body || (!contentType.startsWith('video/') && contentType !== 'application/octet-stream')) {
      await response.body?.cancel()
      throw new Error('The link did not return a downloadable video file.')
    }
    let total = 0
    const sizeGuard = new Transform({ transform(chunk, _encoding, callback) {
      total += chunk.length
      callback(total > MAX_VIDEO_BYTES ? new Error('Video exceeds the 120 MB limit.') : null, chunk)
    } })
    await pipeline(Readable.fromWeb(response.body), sizeGuard, (await import('node:fs')).createWriteStream(outputPath))
    return { sizeBytes: total, filename: path.basename(url.pathname) || 'video.mp4' }
  }
  throw new Error('Video could not be downloaded.')
}

async function downloadSocial(url, directory) {
  const output = path.join(directory, 'linked.%(ext)s')
  const { stdout } = await run('yt-dlp', [
    '--ignore-config', '--no-playlist', '--no-progress', '--no-warnings', '--quiet',
    '--max-filesize', String(MAX_VIDEO_BYTES), '--socket-timeout', '20', '--js-runtimes', 'node',
    '--format', 'best[ext=mp4]/best', '--output', output, '--print', 'after_move:filepath', '--', url,
  ], 220_000)
  const filename = stdout.split(/\r?\n/).map((v) => v.trim()).filter(Boolean).at(-1)
  if (!filename || !path.resolve(filename).startsWith(`${path.resolve(directory)}${path.sep}`)) throw new Error('The platform did not return a video file.')
  const stat = await fs.stat(filename)
  if (stat.size > MAX_VIDEO_BYTES) throw new Error('Video exceeds the 120 MB limit.')
  return { path: filename, filename: path.basename(filename), sizeBytes: stat.size }
}

async function fetchPrivateBlob(pathname, targetPath) {
  if (!/^uploads\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/.test(pathname)) throw new Error('Invalid uploaded video key.')
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) throw new Error('Worker is missing BLOB_READ_WRITE_TOKEN.')
  const blob = await get(pathname, { access: 'private', token })
  if (!blob || blob.statusCode !== 200) throw new Error('Uploaded video could not be read from private storage.')
  let total = 0
  const sizeGuard = new Transform({ transform(chunk, _encoding, callback) {
    total += chunk.length
    callback(total > MAX_VIDEO_BYTES ? new Error('Video exceeds the 120 MB limit.') : null, chunk)
  } })
  await pipeline(Readable.fromWeb(blob.stream), sizeGuard, (await import('node:fs')).createWriteStream(targetPath))
  return { path: targetPath, filename: path.basename(pathname), sizeBytes: total }
}

async function transcribe(body) {
  if (activeJobs >= MAX_ACTIVE_JOBS) throw Object.assign(new Error('The worker is busy. Please retry shortly.'), { status: 429 })
  activeJobs++
  let directory
  try {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'reelmind-worker-'))
    let media
    if (typeof body.blobPathname === 'string') {
      const target = path.join(directory, 'upload-video')
      media = await fetchPrivateBlob(body.blobPathname, target)
      if (typeof body.filename === 'string') media.filename = path.basename(body.filename).slice(0, 180) || media.filename
    } else if (typeof body.videoUrl === 'string') {
      const url = await validatePublicUrl(body.videoUrl)
      const social = /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com|instagram\.com|instagr\.am|tiktok\.com|facebook\.com|fb\.watch|fb\.com|x\.com|twitter\.com|vimeo\.com|dailymotion\.com|reddit\.com|twitch\.tv|linkedin\.com|snapchat\.com|threads\.net|tumblr\.com|kick\.com|odysee\.com|likee\.video|streamable\.com|rumble\.com|bilibili\.com)$/i.test(url.hostname)
      media = social ? await downloadSocial(url.toString(), directory) : { ...(await downloadDirect(url, path.join(directory, 'linked-video.mp4'))), path: path.join(directory, 'linked-video.mp4') }
    } else {
      throw new Error('Provide an uploaded video or a supported video URL.')
    }

    const durationResult = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', media.path], 30_000)
    const durationSecRaw = Number.parseFloat(durationResult.stdout.trim())
    const durationSec = Number.isFinite(durationSecRaw) ? durationSecRaw : null
    const audioPath = path.join(directory, 'audio.wav')
    await run('ffmpeg', ['-y', '-i', media.path, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', audioPath], 120_000)
    const outputPrefix = path.join(directory, 'transcript')
    await run('whisper-cli', ['-m', WHISPER_MODEL_PATH, '-f', audioPath, '-ng', '-nt', '-np', '-otxt', '-of', outputPrefix], 300_000)
    const transcript = (await fs.readFile(`${outputPrefix}.txt`, 'utf8')).replace(/\s+/g, ' ').trim()
    if (!transcript) throw new Error('Transcription returned empty text. The video may not contain speech.')
    return { transcript, meta: { filename: media.filename, sizeBytes: media.sizeBytes, durationSec, wordCount: transcript.split(/\s+/).filter(Boolean).length } }
  } finally {
    activeJobs--
    if (directory) await fs.rm(directory, { recursive: true, force: true }).catch(() => {})
    if (typeof body.blobPathname === 'string') {
      await del(body.blobPathname, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => {})
    }
  }
}

function enqueueTranscription(body) {
  if (typeof body.userId !== 'string' || !body.userId) throw Object.assign(new Error('Missing account scope.'), { status: 400 })
  if (activeJobs >= MAX_ACTIVE_JOBS) throw Object.assign(new Error('The worker is busy. Please retry shortly.'), { status: 429 })
  const jobId = randomUUID()
  jobs.set(jobId, { userId: body.userId, status: 'processing', createdAt: Date.now() })
  void transcribe(body).then((result) => {
    const job = jobs.get(jobId)
    if (job) jobs.set(jobId, { ...job, status: 'complete', result })
  }).catch((error) => {
    const job = jobs.get(jobId)
    if (job) jobs.set(jobId, { ...job, status: 'failed', error: error instanceof Error ? error.message.slice(0, 500) : 'Transcription failed.' })
  })
  const expiry = setTimeout(() => jobs.delete(jobId), 24 * 60 * 60 * 1000)
  expiry.unref?.()
  return { jobId }
}

async function handle(request, response) {
  const url = new URL(request.url || '/', 'http://localhost')
  if (request.method === 'GET' && url.pathname === '/health') return json(response, 200, { ok: true })
  if (!authorized(request)) return json(response, 401, { error: 'Unauthorized.' })
  if (request.method !== 'POST') return json(response, 405, { error: 'Method not allowed.' })
  try {
    const body = await readJson(request)
    if (url.pathname === '/transcribe') return json(response, 202, enqueueTranscription(body))
    if (url.pathname === '/job-status') {
      const job = jobs.get(body.jobId)
      if (!job || job.userId !== body.userId) return json(response, 404, { error: 'Processing job not found.' })
      return json(response, 200, { status: job.status, result: job.result, error: job.error })
    }
    if (url.pathname === '/chat') {
      if (!Array.isArray(body.messages) || body.messages.length > 80) return json(response, 400, { error: 'Invalid chat request.' })
      const result = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: OLLAMA_MODEL, messages: body.messages, format: 'json', stream: false, options: { temperature: 0.2 } }),
        signal: AbortSignal.timeout(300_000),
      })
      if (!result.ok) return json(response, 502, { error: `AI model returned ${result.status}.` })
      const output = await result.json()
      return json(response, 200, { message: { content: output?.message?.content || '' } })
    }
    return json(response, 404, { error: 'Unknown worker endpoint.' })
  } catch (error) {
    const status = error?.status || (error?.name === 'AbortError' ? 504 : 422)
    console.error('[worker] request failed:', error instanceof Error ? error.message : 'unknown error')
    return json(response, status, { error: error instanceof Error ? error.message.slice(0, 500) : 'Processing failed.' })
  }
}

createServer((request, response) => { void handle(request, response) }).listen(PORT, '0.0.0.0', () => {
  console.log(`ReelMind worker listening on ${PORT}`)
})
