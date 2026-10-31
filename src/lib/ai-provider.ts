import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'

export class AIProviderError extends Error {
  constructor(message: string, readonly status = 503) {
    super(message)
    this.name = 'AIProviderError'
  }
}

function getWhisperModelPath(): string {
  const configured = process.env.WHISPER_MODEL_PATH?.trim()
  return path.resolve(configured || path.join(process.cwd(), 'models', 'ggml-small.bin'))
}

function runWhisper(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string; missing: boolean; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(process.env.WHISPER_CLI_PATH || 'whisper-cli', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let missing = false
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, 300_000)

    child.stdout.on('data', (chunk) => { stdout = (stdout + chunk.toString()).slice(-100_000) })
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-20_000) })
    child.on('error', (error: NodeJS.ErrnoException) => { missing = error.code === 'ENOENT' })
    child.on('close', (code) => {
      clearTimeout(timeout)
      resolve({ code, stdout, stderr, missing, timedOut })
    })
  })
}

export async function transcribeAudioFile(filePath: string): Promise<string> {
  const modelPath = getWhisperModelPath()
  try {
    await fs.access(modelPath)
  } catch {
    throw new AIProviderError('Local speech model is missing. Run "npm run setup:local-ai" to install the free local models.')
  }

  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reelmind-whisper-'))
  const outputPrefix = path.join(outputDir, 'transcript')
  try {
    const result = await runWhisper([
      '-m', modelPath,
      '-f', filePath,
      '-ng',
      '-nt',
      '-np',
      '-otxt',
      '-of', outputPrefix,
    ])
    if (result.missing) {
      throw new AIProviderError('whisper.cpp is not installed. Run "npm run setup:local-ai" to set up free local AI.')
    }
    if (result.timedOut) {
      throw new AIProviderError('Local transcription took too long. Try a shorter video.', 504)
    }
    if (result.code !== 0) {
      throw new AIProviderError(`Local transcription failed: ${result.stderr.slice(-700) || 'whisper.cpp returned an error.'}`, 502)
    }

    const transcript = await fs.readFile(`${outputPrefix}.txt`, 'utf8').catch(() => result.stdout)
    return transcript.trim()
  } finally {
    await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {})
  }
}

export async function createChatCompletion(messages: Array<{ role: 'system' | 'user'; content: string }>): Promise<string> {
  const baseUrl = (process.env.OLLAMA_BASE_URL?.trim() || 'http://127.0.0.1:11434').replace(/\/+$/, '')
  const model = process.env.OLLAMA_MODEL?.trim() || 'qwen2.5:3b'
  let response: Response
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, format: 'json', stream: false, options: { temperature: 0.2 } }),
      signal: AbortSignal.timeout(300_000),
    })
  } catch {
    throw new AIProviderError('Ollama is not running. Open Ollama or run "ollama serve", then try again.')
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    const hint = response.status === 404
      ? `Local model "${model}" is not installed. Run "ollama pull ${model}".`
      : `Ollama returned ${response.status}: ${detail.slice(0, 500) || response.statusText}`
    throw new AIProviderError(hint, response.status === 404 ? 503 : 502)
  }

  const data = await response.json() as { message?: { content?: unknown } }
  const content = data.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new AIProviderError('Local notes model returned an empty response.')
  }
  return content.trim()
}
