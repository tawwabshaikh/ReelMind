const ROMAN_URDU_MARKERS = new Set([
  'hai', 'hain', 'ka', 'ki', 'ko', 'se', 'aur', 'mein', 'liye', 'kar', 'karta', 'karti',
  'karte', 'karein', 'hota', 'hoti', 'hote', 'zaroori', 'chahiye', 'sakta', 'sakti',
  'yeh', 'ye', 'woh', 'isliye', 'matlab', 'apne', 'bhi', 'lekin', 'jab', 'tab', 'tak',
])

/** Heuristic used to identify legacy Hinglish transcripts that need translation. */
export function isLikelyHinglish(text: string): boolean {
  if (/[\u0600-\u06ff\u0750-\u077f\u0900-\u097f]/u.test(text)) return false
  const words = text.toLowerCase().match(/[a-z]+/g) ?? []
  const markers = words.filter((word) => ROMAN_URDU_MARKERS.has(word))
  if (markers.length < 3 || new Set(markers).size < 2) return false

  const sentences = text.split(/[.!?]+/).filter(Boolean)
  const substantialSentences = sentences.filter((sentence) => (sentence.match(/[a-z]+/gi) ?? []).length >= 6)
  return substantialSentences.length === 0 || substantialSentences.filter((sentence) =>
    (sentence.toLowerCase().match(/[a-z]+/g) ?? []).some((word) => ROMAN_URDU_MARKERS.has(word)),
  ).length / substantialSentences.length >= 0.75
}

/** Detect Urdu text written in Urdu/Arabic script instead of English. */
export function isLikelyUrdu(text: string): boolean {
  if (/[\u0900-\u097f]/u.test(text)) return false
  const letters = text.match(/[\p{L}]/gu) ?? []
  const urduLetters = text.match(/[\u0600-\u06ff\u0750-\u077f]/gu) ?? []
  return urduLetters.length >= 6 && urduLetters.length / Math.max(letters.length, 1) >= 0.15
}
