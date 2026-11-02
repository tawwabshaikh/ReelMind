import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { createWriteStream } from 'node:fs'
import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'

const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'mkv', 'mpeg', 'mpg', 'ogv', 'avi'])
const SOCIAL_VIDEO_DOMAINS: Array<{ domain: string; label: string }> = [
  { domain: 'youtube.com', label: 'YouTube' },
  { domain: 'youtu.be', label: 'YouTube' },
  { domain: 'youtube-nocookie.com', label: 'YouTube' },
  { domain: 'instagram.com', label: 'Instagram' },
  { domain: 'instagr.am', label: 'Instagram' },
  { domain: 'tiktok.com', label: 'TikTok' },
  { domain: 'facebook.com', label: 'Facebook' },
  { domain: 'fb.watch', label: 'Facebook' },
  { domain: 'fb.com', label: 'Facebook' },
  { domain: 'x.com', label: 'X' },
  { domain: 'twitter.com', label: 'X' },
  { domain: 't.co', label: 'X' },
  { domain: 'vimeo.com', label: 'Vimeo' },
  { domain: 'dailymotion.com', label: 'Dailymotion' },
  { domain: 'dai.ly', label: 'Dailymotion' },
  { domain: 'reddit.com', label: 'Reddit' },
  { domain: 'redd.it', label: 'Reddit' },
  { domain: 'twitch.tv', label: 'Twitch' },
  { domain: 'clips.twitch.tv', label: 'Twitch' },
  { domain: 'linkedin.com', label: 'LinkedIn' },
  { domain: 'pinterest.com', label: 'Pinterest' },
  { domain: 'pin.it', label: 'Pinterest' },
  { domain: 'snapchat.com', label: 'Snapchat' },
  { domain: 'streamable.com', label: 'Streamable' },
  { domain: 'rumble.com', label: 'Rumble' },
  { domain: 'bilibili.com', label: 'Bilibili' },
  { domain: 'b23.tv', label: 'Bilibili' },
  { domain: 'threads.net', label: 'Threads' },
  { domain: 'tumblr.com', label: 'Tumblr' },
  { domain: 'kick.com', label: 'Kick' },
  { domain: 'odysee.com', label: 'Odysee' },
  { domain: 'likee.video', label: 'Likee' },
]

export class VideoUrlError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
    this.name = 'VideoUrlError'
  }
}

function isPublicAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) {
    const octets = address.split('.').map(Number)
    const [a, b, c] = octets
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false
    if (a === 100 && b >= 64 && b <= 127) return false
    if (a === 169 && b === 254) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && (b === 168 || (b === 0 && c === 0) || (b === 0 && c === 2))) return false
    if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false
    if (a === 203 && b === 0 && c === 113) return false
    return true
  }
  if (version === 6) {
    const normalized = address.toLowerCase()
    if (normalized.startsWith('::ffff:')) return false
    const firstGroup = parseInt(normalized.split(':')[0] || '0', 16)
    // Accept global unicast (2000::/3); reject loopback, link-local, unique-local,
    // multicast, and other special-use IPv6 ranges.
    return firstGroup >= 0x2000 && firstGroup <= 0x3fff && !normalized.startsWith('2001:db8:')
  }
  return false
}

async function validatePublicHttpsUrl(value: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new VideoUrlError('Enter a valid video URL.')
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new VideoUrlError('Use a public HTTPS link to a direct video file.')
  }
  if (!url.hostname || isIP(url.hostname)) {
    throw new VideoUrlError('This video link host is not supported.')
  }

  let addresses: Array<{ address: string; family: number }>
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true })
  } catch {
    throw new VideoUrlError('The video link host could not be reached.', 502)
  }
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new VideoUrlError('This link must point to a public internet host.')
  }
  return url
}

function platformForUrl(url: URL): string | null {
  const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '')
  return SOCIAL_VIDEO_DOMAINS.find(({ domain }) => host === domain || host.endsWith(`.${domain}`))?.label ?? null
}

/** Validates an input URL before handing it to an external processing worker. */
export async function validateVideoUrl(input: string): Promise<URL> {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(input.trim())
  } catch {
    throw new VideoUrlError('Enter a valid video URL.')
  }
  if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password || parsedUrl.port) {
    throw new VideoUrlError('Use a public HTTPS video link.')
  }
  return platformForUrl(parsedUrl) ? parsedUrl : validatePublicHttpsUrl(parsedUrl.toString())
}

interface ProcessResult {
  code: number | null
  stdout: string
  stderr: string
  missing: boolean
  timedOut: boolean
}

function runDownloader(command: string, args: string[], cwd: string): Promise<ProcessResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let missing = false
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, 210_000)

    child.stdout.on('data', (chunk) => {
      stdout = (stdout + chunk.toString()).slice(-20_000)
    })
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-20_000)
    })
    child.on('error', (error: NodeJS.ErrnoException) => {
      missing = error.code === 'ENOENT'
    })
    child.on('close', (code) => {
      clearTimeout(timeout)
      resolve({ code, stdout, stderr, missing, timedOut })
    })
  })
}

async function runYtDlp(url: URL, outputDir: string, maxBytes: number): Promise<{ filename: string; sizeBytes: number; path: string }> {
  const outputTemplate = path.join(outputDir, 'linked-video.%(ext)s')
  const args = [
    '--ignore-config',
    '--no-playlist',
    '--no-progress',
    '--no-warnings',
    '--quiet',
    '--max-filesize', String(maxBytes),
    '--socket-timeout', '20',
    '--js-runtimes', 'node',
    '--format', 'bestaudio/best',
    '--concurrent-fragments', '4',
    '--output', outputTemplate,
    '--print', 'after_move:filepath',
    '--',
    url.toString(),
  ]

  const candidates: Array<{ command: string; prefix: string[] }> = [
    { command: process.env.YT_DLP_PATH || 'yt-dlp', prefix: [] },
    { command: path.join(process.cwd(), '.venv', 'bin', 'python'), prefix: ['-m', 'yt_dlp'] },
    { command: 'python3.12', prefix: ['-m', 'yt_dlp'] },
    { command: 'python3', prefix: ['-m', 'yt_dlp'] },
  ]

  let result: ProcessResult | null = null
  for (const candidate of candidates) {
    const attempt = await runDownloader(candidate.command, [...candidate.prefix, ...args], outputDir)
    if (attempt.missing || attempt.stderr.includes('No module named yt_dlp')) continue
    result = attempt
    break
  }

  if (!result) {
    throw new VideoUrlError(
      'YouTube and Instagram links need the video-link setup. Run "npm run setup:video-links" and restart ReelMind.',
      503,
    )
  }
  if (result.timedOut) {
    throw new VideoUrlError('The platform took too long to download this video. Try a shorter video or upload the file.', 504)
  }
  if (result.code !== 0) {
    const platform = platformForUrl(url) || 'social platform'
    const message = /login|private|sign in|authentication|not available/i.test(result.stderr)
      ? 'This video is private or requires a login. ReelMind can process public posts only.'
      : `Could not download this ${platform} video. It may be unavailable, or the platform may require a newer downloader.`
    throw new VideoUrlError(message, 422)
  }

  const printedPath = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).at(-1)
  const outputPath = printedPath && path.resolve(printedPath)
  const safeDir = path.resolve(outputDir) + path.sep
  if (!outputPath || !outputPath.startsWith(safeDir)) {
    throw new VideoUrlError('The platform did not return a video file.', 422)
  }

  const stat = await fs.stat(outputPath).catch(() => null)
  if (!stat?.isFile()) throw new VideoUrlError('The platform did not return a video file.', 422)
  if (stat.size > maxBytes) {
    await fs.unlink(outputPath).catch(() => {})
    throw new VideoUrlError(`Video too large (${(stat.size / 1024 / 1024).toFixed(1)} MB). Max ${maxBytes / 1024 / 1024} MB.`, 413)
  }
  return { filename: path.basename(outputPath), sizeBytes: stat.size, path: outputPath }
}

function safeFilename(url: URL): { filename: string; extension: string } {
  const raw = url.pathname.split('/').pop() || ''
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    // Keep the escaped path segment when it contains invalid encoding.
  }
  const cleaned = decoded.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(-100)
  const ext = cleaned.includes('.') ? cleaned.split('.').pop()!.toLowerCase() : ''
  const extension = VIDEO_EXTENSIONS.has(ext) ? ext : 'mp4'
  const filename = cleaned && cleaned !== extension ? cleaned : `linked-video.${extension}`
  return { filename, extension }
}

/** Downloads a public social video URL or a direct HTTPS video file with a size limit. */
export async function downloadVideoUrl(
  input: string,
  destination: string,
  maxBytes: number,
): Promise<{ filename: string; sizeBytes: number; path: string }> {
  const parsedUrl = await validateVideoUrl(input)
  if (platformForUrl(parsedUrl)) {
    return runYtDlp(parsedUrl, path.dirname(destination), maxBytes)
  }

  let url = await validatePublicHttpsUrl(parsedUrl.toString())
  let response: Response | null = null

  for (let redirects = 0; redirects <= 4; redirects++) {
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(240_000),
        headers: { 'user-agent': 'ReelMind/1.0 video-import' },
      })
    } catch {
      throw new VideoUrlError('The video link could not be downloaded. Check the URL and try again.', 502)
    }
    if (![301, 302, 303, 307, 308].includes(response.status)) break
    const location = response.headers.get('location')
    await response.body?.cancel()
    if (!location || redirects === 4) throw new VideoUrlError('The video link redirected too many times.')
    url = await validatePublicHttpsUrl(new URL(location, url).toString())
  }

  if (!response?.ok || !response.body) {
    throw new VideoUrlError(`Could not download the video link (HTTP ${response?.status ?? 'unknown'}).`, 502)
  }

  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (!contentType.startsWith('video/') && contentType !== 'application/octet-stream') {
    await response.body.cancel()
    throw new VideoUrlError('That URL did not return a video file. Paste a direct MP4, MOV, WebM, or similar video link.', 422)
  }
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    await response.body.cancel()
    throw new VideoUrlError(`Video too large (${(contentLength / 1024 / 1024).toFixed(1)} MB). Max ${maxBytes / 1024 / 1024} MB.`, 413)
  }

  let sizeBytes = 0
  const sizeGuard = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      sizeBytes += chunk.length
      if (sizeBytes > maxBytes) callback(new Error(`Video exceeds the ${maxBytes / 1024 / 1024} MB limit.`))
      else callback(null, chunk)
    },
  })

  try {
    await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream), sizeGuard, createWriteStream(destination, { flags: 'wx' }))
  } catch (error) {
    await response.body.cancel().catch(() => {})
    if (sizeBytes > maxBytes) {
      throw new VideoUrlError(`Video exceeds the ${maxBytes / 1024 / 1024} MB limit.`, 413)
    }
    if (error instanceof VideoUrlError) throw error
    throw new VideoUrlError('The video download was interrupted. Check the link and try again.', 502)
  }

  if (sizeBytes === 0) throw new VideoUrlError('The linked video file is empty.', 422)
  return { ...safeFilename(url), sizeBytes, path: destination }
}
