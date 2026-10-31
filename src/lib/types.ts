// Shared types — no runtime imports, safe for client + server.
/** `both` stays readable for records created by older versions. */
export type Language = 'english' | 'urdu' | 'hinglish' | 'both'
export type NoteLanguage = 'english' | 'urdu' | 'hinglish'

export type Theme = 'emerald' | 'midnight' | 'sunrise'

export interface KeyPoint {
  heading: string
  detail: string
}

export interface StructuredNote {
  title: string
  summary: string
  keyPoints: KeyPoint[]
  tags: string[]
  language: NoteLanguage
  /** Optional map of tag → hex color (e.g. { "deep work": "#10b981" }). */
  tagColors?: Record<string, string>
}

/** Notes returned by the generator, with only requested language versions set. */
export interface GeneratedNotes {
  english?: StructuredNote
  urdu?: StructuredNote
  hinglish?: StructuredNote
}

export interface NoteVersion {
  structured: StructuredNote
  markdown: string
}

export interface TranscribeResponse {
  transcript: string
  meta: {
    filename: string
    sizeBytes: number
    durationSec: number | null
    wordCount: number
  }
}

export interface GenerateNotesResponse {
  noteId: string | null
  language: NoteLanguage
  english?: NoteVersion
  urdu?: NoteVersion
  hinglish?: NoteVersion
}

export interface InfographicFile {
  filename: string
  url: string
}

export interface GenerateInfographicResponse {
  english: InfographicFile | null
  urdu: InfographicFile | null
  hinglish: InfographicFile | null
  dimensions: { width: number; height: number }
  theme: Theme
}

export interface NoteDetail {
  id: string
  videoName: string
  language: Language
  createdAt: string
  transcript: string
  durationSec: number | null
  sizeBytes: number | null
  wordCount: number | null
  english?: NoteVersion
  urdu?: NoteVersion
  hinglish?: NoteVersion
  infographicEn: InfographicFile | null
  infographicUr: InfographicFile | null
  infographicHi: InfographicFile | null
}

export interface NoteDetailResponse {
  note: NoteDetail
}

export interface CompareNote {
  id: string
  videoName: string
  language: Language
  createdAt: string
  durationSec: number | null
  wordCount: number | null
  english?: NoteVersion
  urdu?: NoteVersion
  hinglish?: NoteVersion
  infographicEn: InfographicFile | null
  infographicUr: InfographicFile | null
  infographicHi: InfographicFile | null
}

export interface CompareResponse {
  a: CompareNote
  b: CompareNote
}

export interface HistoryItem {
  id: string
  videoName: string
  language: Language
  createdAt: string
  deletedAt: string | null
  hasEnglishNotes: boolean
  hasUrduNotes: boolean
  hasHinglishNotes: boolean
  hasEnglishInfographic: boolean
  hasUrduInfographic: boolean
  hasHinglishInfographic: boolean
  infographicEnUrl: string | null
  infographicUrUrl: string | null
  infographicHiUrl: string | null
  // Aggregated tags across EN+UR (deduped, lowercased) for filtering
  tags: string[]
  durationSec: number | null
  wordCount: number | null
}
