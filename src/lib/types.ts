// Shared types — no runtime imports, safe for client + server.
export type Language = 'english' | 'urdu' | 'both'

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
  language: 'english' | 'urdu'
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
  language: Language
  english?: NoteVersion
  urdu?: NoteVersion
}

export interface InfographicFile {
  filename: string
  url: string
}

export interface GenerateInfographicResponse {
  english: InfographicFile | null
  urdu: InfographicFile | null
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
  infographicEn: InfographicFile | null
  infographicUr: InfographicFile | null
}

export interface NoteDetailResponse {
  note: NoteDetail
}

export interface HistoryItem {
  id: string
  videoName: string
  language: Language
  createdAt: string
  hasEnglishNotes: boolean
  hasUrduNotes: boolean
  hasEnglishInfographic: boolean
  hasUrduInfographic: boolean
  infographicEnUrl: string | null
  infographicUrUrl: string | null
  // Aggregated tags across EN+UR (deduped, lowercased) for filtering
  tags: string[]
  durationSec: number | null
  wordCount: number | null
}
