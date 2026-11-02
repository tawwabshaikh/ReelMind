import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { isLikelyUrdu } from './hinglish'
import { callProcessingWorker, ProcessingWorkerError } from './processing-worker'

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
  if (process.env.VERCEL === '1') {
    try {
      const data = await callProcessingWorker<{ message?: { content?: unknown } }>('chat', { messages })
      const content = data.message?.content
      if (typeof content !== 'string' || !content.trim()) throw new AIProviderError('The processing worker returned an empty AI response.')
      return content.trim()
    } catch (error) {
      if (error instanceof ProcessingWorkerError) throw new AIProviderError(error.message, error.status)
      throw error
    }
  }

  const baseUrl = (process.env.OLLAMA_BASE_URL?.trim() || 'http://127.0.0.1:11434').replace(/\/+$/, '')
  const model = process.env.OLLAMA_MODEL?.trim() || 'qwen3:4b-instruct'
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

const HINGLISH_TRANSCRIPT_PROMPT = `Translate this video transcript into natural Pakistani Hinglish / Roman Urdu.
Use Latin letters only. Keep English technical terms when natural, but write the sentence grammar in Roman Urdu.
Translate every sentence faithfully. Do not summarize, skip, or add information.
Return only valid JSON in this exact shape: {"translation":"..."}
Examples:
- "Water regulates body temperature and supports digestion." => "Pani body temperature ko control karta hai aur digestion mein madad deta hai."
- "It supports digestion." => "Yeh digestion mein madad deta hai."
- "People should drink water regularly." => "Logon ko rozana pani peena chahiye."
- "Dehydration can cause headaches." => "Pani ki kami se sar dard ho sakta hai."`

const URDU_TRANSCRIPT_PROMPT = `Translate this full video transcript into natural Pakistani Urdu, written in Urdu Nastaliq/Arabic-Persian script.
Use Urdu script throughout. Do not write Roman Urdu, Devanagari, or English sentences. Translate every sentence faithfully; do not summarize, skip, or add facts.
Return only valid JSON in this exact shape: {"translation":"..."}
Examples:
- "Water supports digestion." => "پانی ہاضمے میں مدد دیتا ہے۔"
- "People should drink water regularly." => "لوگوں کو باقاعدگی سے پانی پینا چاہیے۔"
- "Dehydration can cause headaches." => "پانی کی کمی سے سر درد ہو سکتا ہے۔"`

function splitTranscript(text: string, maxWords = 650): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(' '))
  }
  return chunks
}

export async function translateTranscript(transcript: string, language: 'urdu' | 'hinglish'): Promise<string> {
  const chunks = splitTranscript(transcript)
  if (chunks.length === 0) throw new AIProviderError('Transcript is empty; nothing to translate.', 400)

  const translated: string[] = []
  for (let index = 0; index < chunks.length; index++) {
    let lastError: unknown
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const raw = await createChatCompletion([
          {
            role: 'system',
            content: (language === 'urdu' ? URDU_TRANSCRIPT_PROMPT : HINGLISH_TRANSCRIPT_PROMPT) + (attempt > 1
              ? language === 'urdu'
                ? '\nThe last answer used the wrong language or script. Rewrite the entire transcript in Urdu script. Example: "People should drink water regularly." => "لوگوں کو باقاعدگی سے پانی پینا چاہیے۔"'
                : '\nThe last answer was too English-heavy. Rewrite it in Roman Urdu/Hinglish, with words like hai, hain, ka, ko, se, aur, mein, and chahiye in each sentence.'
              : ''),
          },
          { role: 'user', content: `Translate this transcript chunk without shortening it:\n\n${chunks[index]}` },
        ])
        const firstBrace = raw.indexOf('{')
        const lastBrace = raw.lastIndexOf('}')
        const parsed = JSON.parse(firstBrace >= 0 && lastBrace > firstBrace ? raw.slice(firstBrace, lastBrace + 1) : raw) as { translation?: unknown }
        const result = typeof parsed.translation === 'string' ? parsed.translation.trim() : ''
        if (!result) throw new Error('The Hinglish translator returned empty text.')
        if (language === 'hinglish' && /[\u0600-\u06ff\u0750-\u077f\u0900-\u097f]/u.test(result)) {
          throw new Error('The Hinglish translator used a non-Latin script.')
        }
        if (language === 'urdu' && !isLikelyUrdu(result)) {
          throw new Error('The Urdu translator did not use Urdu script.')
        }
        translated.push(result)
        lastError = null
        break
      } catch (error) {
        lastError = error
      }
    }
    if (lastError) {
      const detail = lastError instanceof Error ? lastError.message : String(lastError)
      const languageName = language === 'urdu' ? 'Urdu' : 'Hinglish'
      throw new AIProviderError(`Could not translate transcript chunk ${index + 1} to ${languageName}. ${detail}`, 502)
    }
  }

  return translated.join(' ').replace(/\s+/g, ' ').trim()
}
