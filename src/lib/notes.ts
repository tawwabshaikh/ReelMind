import { jsonrepair } from 'jsonrepair'
import { createChatCompletion } from './ai-provider'
import type { Language, NoteLanguage, KeyPoint, StructuredNote, GeneratedNotes } from './types'

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

function buildUserPrompt(transcript: string, language: NoteLanguage): string {
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
  if (language === 'hinglish') {
    return `Neeche video ka transcript hai. Isko structured Hinglish notes mein badlo.

IMPORTANT LANGUAGE REQUIREMENT:
- Har value ko natural Pakistani Hinglish / Roman Urdu mein likho. Sirf Latin letters use karo.
- Har summary aur detail ki sentence structure Roman Urdu/Hinglish ho. English transcript ko English mein summarize mat karo.
- English technical nouns jaise "body temperature" aur "digestion" reh sakte hain, lekin unke around Roman Urdu grammar zaroor likho (jaise "Pani body temperature ko control karta hai").
- Urdu/Arabic script aur Devanagari script bilkul use mat karo.
- Headings, summary, details aur tags sab isi Hinglish style mein hon.
- Style example: English "Water is important for health and helps digestion." ko "Pani sehat ke liye zaroori hai aur digestion mein help karta hai." likho.
- JSON keys English mein rakho; JSON ke andar content Hinglish mein ho.

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

function buildSystemPrompt(language: NoteLanguage): string {
  const base = COMMON_FORMAT_INSTRUCTIONS
  if (language === 'urdu') {
    return base + `\n\nLANGUAGE: You MUST respond in Urdu using the Urdu (Nastaliq) script — the same script used for writing Urdu in Pakistan. Roman Urdu (Latin letters) is strictly forbidden. Your JSON string values must contain real Urdu script characters such as اردو, خوش آمدید, علم.`
  }
  if (language === 'hinglish') {
    return base + `\n\nLANGUAGE: The transcript may be English, but all JSON string values MUST be rewritten in natural Pakistani Hinglish / Roman Urdu using Latin letters only. English-only sentences are incorrect. Keep technical nouns in English when natural, but use Roman Urdu grammar around them. Example: "The process improves health" => "Yeh process sehat ko behtar banata hai." Never use Urdu/Arabic or Devanagari script.`
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

function parseStructuredNote(raw: string, language: NoteLanguage): StructuredNote {
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

const HINGLISH_MARKERS = new Set([
  'hai', 'hain', 'ka', 'ki', 'ko', 'se', 'aur', 'mein', 'liye', 'kar', 'karta', 'karti',
  'karte', 'karein', 'hota', 'hoti', 'hote', 'zaroori', 'chahiye', 'sakta', 'sakti',
  'yeh', 'ye', 'woh', 'isliye', 'matlab', 'apne', 'bhi', 'lekin', 'jab', 'tab', 'tak',
])

function isHinglish(note: StructuredNote): boolean {
  const prose = [note.title, note.summary, ...note.keyPoints.map((point) => point.detail)]
  const text = [...prose, ...note.keyPoints.map((point) => point.heading), ...note.tags].join(' ')
  // Hinglish output is expected in Roman script; reject Urdu and Devanagari.
  if (/[\u0600-\u06ff\u0750-\u077f\u0900-\u097f]/u.test(text)) return false
  const words = (value: string) => value.toLowerCase().match(/[a-z]+/g) ?? []
  // A single Hinglish paragraph must not hide English-only bullet points.
  if (prose.some((value) => !words(value).some((word) => HINGLISH_MARKERS.has(word)))) return false
  const allWords = words(prose.join(' '))
  const markers = allWords.filter((word) => HINGLISH_MARKERS.has(word))
  return markers.length >= 3 && new Set(markers).size >= 2
}

async function translateNoteToHinglish(note: StructuredNote): Promise<StructuredNote> {
  const systemPrompt = `Translate the structured note into natural Pakistani Hinglish / Roman Urdu. Keep the JSON keys and key-point order unchanged. Translate the title, summary, and every heading/detail. Keep technical terms in English only when natural; all sentences must use Roman Urdu grammar. Use Latin letters only. Preserve meaning and do not add facts. Tags can stay as short topic labels.
Return only the same JSON structure: {"title":"...","summary":"...","keyPoints":[{"heading":"...","detail":"..."}],"tags":["..."]}.
Examples: "Water and Health" => "Pani aur Sehat"; "Water is essential for the human body." => "Pani insani jism ke liye zaroori hai."; "Body temperature" => "Body temperature ko control karna"; "It regulates body temperature." => "Yeh body temperature ko control karta hai."; "People should drink water regularly." => "Logon ko rozana pani peena chahiye."`
  const source = JSON.stringify({
    title: note.title,
    summary: note.summary,
    keyPoints: note.keyPoints,
    tags: note.tags,
  })

  let lastError: unknown
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await callLLM(
        systemPrompt + (attempt > 1
          ? '\nThe previous result still had English sentences. Rewrite every title, summary, and detail in Roman Urdu/Hinglish. Keep headings short but include Hinglish grammar words.'
          : ''),
        `Translate these note fields without summarizing:\n${source}`,
      )
      const translated = parseStructuredNote(raw, 'hinglish')
      if (!isHinglish(translated)) throw new Error('The translator left English-only note content.')
      return translated
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not translate note content to Hinglish.')
}

async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  return createChatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ])
}

/**
 * Generate structured notes in the requested output language.
 */
export async function generateNotes(
  transcript: string,
  language: NoteLanguage,
): Promise<GeneratedNotes> {
  if (transcript.trim().length === 0) {
    throw new Error('Cannot generate notes from an empty transcript.')
  }

  const make = async (lang: NoteLanguage): Promise<StructuredNote> => {
    const systemPrompt = buildSystemPrompt(lang)
    const userPrompt = buildUserPrompt(transcript, lang)

    // Retry malformed JSON and English-only responses: small local models
    // sometimes ignore the requested output language on the first attempt.
    let lastErr: unknown = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      const correction =
        attempt > 1
          ? lang === 'hinglish'
            ? '\n\nCORRECTION: The previous answer was not valid Hinglish because it contained English-only lines. Rewrite EVERY title, summary, heading, and detail in Pakistani Roman Urdu/Hinglish. EACH individual line must use Roman Urdu grammar; no keyPoint may remain an English sentence. Use Latin letters only and natural words such as hai, hain, ka, ki, ko, se, aur, mein, and liye. Keep technical nouns in English if needed. Example: "Water supports digestion" => "Pani digestion mein help karta hai." Example: "People should drink water regularly" => "Logon ko regular pani peena chahiye." Tags may stay as concise topic labels. Return only the required valid JSON object; every keyPoints item must be { "heading": "...", "detail": "..." }.'
            : '\n\nNOTE: Your previous response was not valid JSON. Output ONLY a single valid JSON object. Each keyPoints array element MUST be exactly { "heading": "...", "detail": "..." } — do NOT nest other keys. Ensure every { has a matching }. Do not wrap in markdown fences.'
          : ''
      const raw = await callLLM(systemPrompt + correction, userPrompt)
      let note: StructuredNote
      try {
        note = parseStructuredNote(raw, lang)
      } catch (err) {
        lastErr = err
        console.warn(`[generateNotes] parse attempt ${attempt} failed for ${lang}:`, err instanceof Error ? err.message : err)
        continue
      }
      if (lang === 'hinglish' && !isHinglish(note)) return translateNoteToHinglish(note)
      return note
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
  if (language === 'hinglish') {
    return { hinglish: await make('hinglish') }
  }
  return { hinglish: await make('hinglish') }
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
