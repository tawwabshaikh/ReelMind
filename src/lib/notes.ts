import ZAI from 'z-ai-web-dev-sdk'
import { jsonrepair } from 'jsonrepair'
import type { Language, KeyPoint, StructuredNote, GeneratedNotes } from './types'

export type { Language, KeyPoint, StructuredNote, GeneratedNotes }

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

const COMMON_FORMAT_INSTRUCTIONS = `You are an expert note-taker who turns spoken-video transcripts into clear, well-structured study/summary notes.

Analyze the transcript and produce notes with EXACTLY this JSON structure (no other text, no markdown fences):
{
  "title": "A concise, descriptive title (max 10 words)",
  "summary": "A one or two sentence overview of what the video is about",
  "keyPoints": [
    { "heading": "Short point label (2-6 words)", "detail": "A clear explanation sentence or two of this point" }
  ],
  "tags": ["3-6 relevant topic tags"]
}

Rules:
- Produce between 3 and 6 keyPoints.
- Keep each heading short and each detail focused.
- Tags should be single words or short phrases, lowercase.
- Output ONLY the JSON object, nothing else.`

function buildUserPrompt(transcript: string, language: 'english' | 'urdu'): string {
  if (language === 'urdu') {
    // CRITICAL: explicitly require Urdu script (Nastaliq), forbid Roman Urdu.
    return `Below is a transcript. Turn it into structured notes.

IMPORTANT LANGUAGE REQUIREMENT:
- Write the ENTIRE response (title, summary, every heading, every detail, and all tags) in the URDU language using the proper URDU SCRIPT (Nastaliq / Arabic-Persian script characters).
- DO NOT write in Roman Urdu (i.e. Urdu spelled out using English/Latin letters). For example write "خوش آمدید", NOT "khush aamdeed".
- DO NOT write in English.
- Use correct Urdu grammar, vocabulary and spelling.
- The tags MUST also be in Urdu script.

Transcript:
"""
${transcript}
"""`
  }
  return `Below is a transcript. Turn it into structured notes in ENGLISH.

- Write the ENTIRE response (title, summary, every heading, every detail, and all tags) in clear, correct English.
- The tags MUST also be in English.

Transcript:
"""
${transcript}
"""`
}

function buildSystemPrompt(language: 'english' | 'urdu'): string {
  const base = COMMON_FORMAT_INSTRUCTIONS
  if (language === 'urdu') {
    return base + `\n\nLANGUAGE: You MUST respond in Urdu using the Urdu (Nastaliq) script — the same script used for writing Urdu in Pakistan. Roman Urdu (Latin letters) is strictly forbidden. Your JSON string values must contain real Urdu script characters such as اردو, خوش آمدید, علم.`
  }
  return base + `\n\nLANGUAGE: Respond in English only.`
}

// ---------------------------------------------------------------------------
// LLM call + JSON parsing
// ---------------------------------------------------------------------------

function stripCodeFences(raw: string): string {
  let s = raw.trim()
  // Remove leading ```json or ``` and trailing ```
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  }
  return s.trim()
}

/**
 * Repair common LLM JSON mistakes:
 *  - smart quotes (“ ” ‘ ’) → straight quotes
 *  - trailing commas before ] or }
 *  - control characters / zero-width chars inside strings
 * Still best-effort; if the model emitted truly broken JSON we surface a clear error.
 */
function repairJson(s: string): string {
  let out = s
  // Smart quotes → straight
  out = out.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'")
  // Trailing commas: ,] or ,} (with optional whitespace/newlines)
  out = out.replace(/,(\s*[\]}])/g, '$1')
  // Remove zero-width joiners / non-breaking spaces that can break parsing
  out = out.replace(/[\u200B-\u200D\uFEFF]/g, '')
  return out
}

function extractJsonObject(raw: string): string {
  const cleaned = stripCodeFences(raw)
  // If the model added prose around the JSON, try to slice from first { to last }
  const first = cleaned.indexOf('{')
  const last = cleaned.lastIndexOf('}')
  if (first !== -1 && last !== -1 && last > first) {
    return cleaned.slice(first, last + 1)
  }
  return cleaned
}

function parseStructuredNote(raw: string, language: 'english' | 'urdu'): StructuredNote {
  const jsonStr = repairJson(extractJsonObject(raw))
  let parsed: any
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    // Fallback: jsonrepair handles missing braces, trailing commas, smart
    // quotes, unescaped characters, etc. — the common LLM JSON ailments.
    try {
      parsed = JSON.parse(jsonrepair(jsonStr))
    } catch (err) {
      throw new Error(`LLM did not return valid JSON. ${err instanceof Error ? err.message : String(err)}. Raw (truncated): ${raw.slice(0, 300)}`)
    }
  }

  const title = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : 'Untitled'
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : ''
  const keyPoints: KeyPoint[] = Array.isArray(parsed.keyPoints)
    ? parsed.keyPoints
        .filter((p: any) => p && typeof p === 'object')
        .slice(0, 6)
        .map((p: any) => {
          // Tolerate the occasional nested-keyPoints mistake
          // { "keyPoints": { "heading": ..., "detail": ... } }
          const src = p.keyPoints && typeof p.keyPoints === 'object' && !Array.isArray(p.keyPoints) ? p.keyPoints : p
          return {
            heading: String(src.heading ?? src.title ?? '').trim() || 'Point',
            detail: String(src.detail ?? src.description ?? src.text ?? '').trim(),
          }
        })
        .filter((p: KeyPoint) => p.detail.length > 0)
    : []
  const tags: string[] = Array.isArray(parsed.tags)
    ? parsed.tags.filter((t: any) => typeof t === 'string' && t.trim()).map((t: string) => t.trim()).slice(0, 6)
    : []

  if (keyPoints.length === 0) {
    // Fallback: if the model didn't structure points, put the whole summary as one point
    keyPoints.push({ heading: title, detail: summary || 'No details available.' })
  }

  return { title, summary, keyPoints, tags, language }
}

async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
  })
  const content = completion.choices[0]?.message?.content
  if (!content || !content.trim()) {
    throw new Error('LLM returned an empty response.')
  }
  return content
}

/**
 * Generate structured notes from a transcript in the requested language(s).
 * For "both", two independent LLM calls are made (one EN, one UR) so each
 * version is fully idiomatic in its own language.
 */
export async function generateNotes(
  transcript: string,
  language: Language,
): Promise<GeneratedNotes> {
  if (transcript.trim().length === 0) {
    throw new Error('Cannot generate notes from an empty transcript.')
  }

  const make = async (lang: 'english' | 'urdu'): Promise<StructuredNote> => {
    const systemPrompt = buildSystemPrompt(lang)
    const userPrompt = buildUserPrompt(transcript, lang)

    // Try up to 3 times — LLMs occasionally emit slightly malformed JSON
    // (missing braces, wrong keys). A retry with a corrective nudge usually
    // yields clean JSON, and our parser is tolerant of minor quirks.
    let lastErr: unknown = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      const correction =
        attempt > 1
          ? '\n\nNOTE: Your previous response was not valid JSON. Output ONLY a single valid JSON object. Each keyPoints array element MUST be exactly { "heading": "...", "detail": "..." } — do NOT nest other keys. Ensure every { has a matching }. Do not wrap in markdown fences.'
          : ''
      const raw = await callLLM(systemPrompt + correction, userPrompt)
      try {
        return parseStructuredNote(raw, lang)
      } catch (err) {
        lastErr = err
        console.warn(`[generateNotes] parse attempt ${attempt} failed for ${lang}:`, err instanceof Error ? err.message : err)
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error('Failed to parse structured notes after multiple attempts.')
  }

  if (language === 'english') {
    return { english: await make('english') }
  }
  if (language === 'urdu') {
    return { urdu: await make('urdu') }
  }
  // both — run in parallel for speed
  const [english, urdu] = await Promise.all([make('english'), make('urdu')])
  return { english, urdu }
}

// ---------------------------------------------------------------------------
// Markdown rendering (for the Notes tab + .md download)
// ---------------------------------------------------------------------------

export function structuredNoteToMarkdown(note: StructuredNote): string {
  const lines: string[] = []
  lines.push(`# ${note.title}`)
  lines.push('')
  if (note.summary) {
    lines.push(`> ${note.summary}`)
    lines.push('')
  }
  lines.push('## Key Points')
  lines.push('')
  for (const kp of note.keyPoints) {
    lines.push(`### ${kp.heading}`)
    lines.push(kp.detail)
    lines.push('')
  }
  if (note.tags.length > 0) {
    lines.push('---')
    lines.push('')
    lines.push(`**Tags:** ${note.tags.map((t) => `\`${t}\``).join(' ')}`)
    lines.push('')
  }
  return lines.join('\n')
}

/**
 * Filename slug helper — keeps ASCII safe, appends language suffix.
 */
export function slugify(input: string, maxLen = 40): string {
  const ascii = input
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '') // strip non-ascii (urdu) for filename safety
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
  const out = ascii.slice(0, maxLen).replace(/-$/, '')
  return out || 'notes'
}
