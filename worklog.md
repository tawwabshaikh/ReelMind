# Reel → Notes (Bilingual + Infographic) — Worklog

## Project Overview
Extending a "Reel → Notes" concept (video → Whisper transcription → Claude-style summarization → Markdown notes)
with two new features, implemented on the required Next.js 16 stack:

1. **Bilingual notes** (English / Urdu / Both) — Urdu in proper Nastaliq script, not Roman Urdu.
2. **Infographic generation** — structured notes → HTML+CSS template → PNG via headless Chromium (Playwright),
   with correct RTL layout + Noto Nastaliq Urdu font shaping. Instagram-friendly dimensions (1080×1350).

---
Task ID: 1
Agent: main (Z.ai Code)
Task: Environment setup — verify ffmpeg, install Playwright + Chromium, download Urdu Nastaliq fonts, verify Urdu rendering works.

Work Log:
- Confirmed ffmpeg 7.1.5 available at /usr/bin/ffmpeg (for video→audio extraction).
- Installed `playwright@1.62.1` via bun; installed Chromium browser via `npx playwright install chromium` (chromium-1200/1234 + headless shell present in ~/.cache/ms-playwright).
- No root access for apt font install → downloaded Noto Nastaliq Urdu (Regular + Bold) TTF directly to `public/fonts/` from notofonts.github.io. Verified valid TrueType via `file`.
- Wrote a throwaway test script rendering Urdu text "اردو زبان میں خوش آمدید" via Playwright with `@font-face file://` → produced a valid 800×400 PNG. Confirms Urdu shaping + RTL works.

Stage Summary:
- Infographic rendering stack READY: Playwright + Chromium + Noto Nastaliq Urdu.
- Audio extraction READY: ffmpeg.
- ASR + LLM via z-ai-web-dev-sdk (already in package.json).
- Trade-off note for user: WeasyPrint was NOT chosen because Playwright/Chromium gives pixel-perfect Urdu Nastaliq shaping out of the box (WeasyPrint's HarfBuzz shaping is decent but its CSS support is more limited; Playwright = a real browser engine). Playwright is heavier (~300MB chromium) but the deployment here already supports it.

---
Task ID: 2-6
Agent: main (Z.ai Code)
Task: Build the full bilingual-notes + infographic feature end-to-end (Prisma schema, backend libs, API routes, frontend) and verify via agent-browser.

Work Log:
- Prisma: replaced placeholder schema with a `Note` model (videoName, language, transcript, notesEn/notesUr JSON, infographicEn/infographicUr filenames, createdAt). Ran `bun run db:push` — DB in sync.
- Backend libs (src/lib/):
  - `audio.ts` — ffmpeg wrapper: extracts mono 16kHz WAV from video, ffprobe duration, base64 read, temp cleanup.
  - `notes.ts` — LLM prompt construction with CRITICAL Urdu-script instruction (explicitly forbids Roman Urdu). Parses LLM JSON into a `StructuredNote` (title/summary/keyPoints/tags). Robust parsing: smart-quote + trailing-comma repair, `jsonrepair` fallback, tolerant nested-keyPoints handling, and 3-attempt retry with corrective nudge (the Urdu LLM occasionally emits malformed JSON — retry + jsonrepair resolves it).
  - `infographic.ts` — builds a self-contained HTML+CSS card template (1080×1350) with emerald/amber palette, numbered point cards, tag pills, RTL `dir="rtl"` + Noto Nastaliq Urdu `@font-face` (local file://) for Urdu. Renders to PNG via Playwright headless Chromium at 2× deviceScaleFactor (crisp 2160×2700 output).
  - `types.ts` — shared types (no runtime deps) so client + server share contracts.
  - `slugify-client.ts` — client-safe filename slug (avoids pulling ZAI SDK into the browser bundle).
- API routes (src/app/api/):
  - `POST /api/transcribe` — FormData video → ffmpeg audio → z-ai ASR → transcript + meta (filename, size, duration, word count). 120 MB cap, 300s maxDuration.
  - `POST /api/generate-notes` — {transcript, language, videoName} → LLM (EN and/or UR in parallel for "both") → structured notes + markdown. Persists a `Note` row (language + notes JSON) so the selected language(s) are stored as metadata.
  - `POST /api/generate-infographic` — {english, urdu, noteId} → Playwright PNG(s) → writes to /public/generated/ → updates Note row with filenames.
  - `GET /api/notes` — recent-generation history (proves metadata persistence).
- Frontend (src/app/page.tsx + src/components/reel-notes/):
  - Sticky header with "Reel → Notes" brand + gradient wordmark.
  - Hero section explaining the bilingual + infographic capability.
  - Left column: UploadZone (drag&drop), LanguageSelector (English/Urdu/Both toggle cards with Urdu labels), "Transcribe & generate notes" button, pipeline stepper (Transcribe→Summarize→Notes→Infographic).
  - Right column: Tabs (Notes / Transcript / Infographic). Notes tab shows EN+UR cards (Urdu in `dir="rtl"` + `.font-urdu` Nastaliq), each with a ".md" download. Transcript tab shows raw text + meta chips + ".txt" download. Infographic tab shows a "Generate infographic" button → renders PNG(s) with "PNG" download links.
  - HistoryPanel showing recent runs with language + artifact indicators.
  - Sticky footer (min-h-screen flex-col + mt-auto).
  - globals.css: @font-face Noto Nastaliq Urdu, .font-urdu, gradient brand text, brand hero bg, custom thin scrollbar, fade-up animation.

Verification (agent-browser + curl + VLM):
- curl `/api/transcribe` with a 30s test MP4 (TTS-generated speech about deep work) → accurate 66-word transcript. ✓
- curl `/api/generate-notes` (both) → 200 with English + Urdu notes; Urdu in proper Nastaliq script (e.g. "وقت کی منصوبہ بندی"), NOT Roman Urdu. ✓
- curl `/api/generate-infographic` → 200 with two PNGs (2160×2700 each). ✓
- VLM analysis of the Urdu infographic confirmed: proper Urdu/Nastaliq script (not Roman), right-aligned RTL, letters properly shaped/connected (not isolated forms), clean card layout, no rendering issues. ✓ This validates the core FEATURE 2 requirement that plain PIL text drawing could NOT meet.
- agent-browser full flow: injected a real video File via fetch+DataTransfer (agent-browser's native `upload` doesn't attach real bytes) → selected "Both" → clicked "Transcribe & generate notes" → watched the pipeline stepper advance (Transcribing → Generating notes…) → Notes tab populated with EN + UR cards + .md buttons → switched to Infographic tab → "Generate infographic" → two PNG images rendered (naturalWidth 2160, complete:true) with PNG download links. No console errors. ✓
- Sticky footer: verified sticks to viewport bottom on a 1600px-tall viewport (sticksToBottom:true) and pushes down naturally on long content. ✓
- Mobile (375×812) layout renders. ✓
- `bun run lint` → 0 errors, 0 warnings. ✓

Stage Summary:
- FEATURE 1 (bilingual notes) COMPLETE: English / Urdu (Nastaliq) / Both, with the prompt explicitly forbidding Roman Urdu, language stored in DB metadata + filename suffix (`-notes-en.md` / `-notes-urdu.md`).
- FEATURE 2 (infographic) COMPLETE: HTML+CSS → Playwright Chromium → PNG at 1080×1350 (@2x = 2160×2700), with correct RTL + Noto Nastaliq Urdu shaping. Two separate PNGs for "both".
- Existing Markdown notes flow preserved (additive, not replacement).
- DEPENDENCIES & SYSTEM INSTALL (the user asked about requirements.txt equivalent):
  * `playwright` (npm/bun) — added to package.json.
  * System: `npx playwright install chromium` (downloads headless Chromium ~150MB to ~/.cache/ms-playwright). Already done in this environment.
  * `ffmpeg` + `ffprobe` — system binary, used for video→audio extraction. Already present at /usr/bin/ffmpeg.
  * `jsonrepair` (npm/bun) — added; repairs LLM JSON quirks.
  * Fonts: Noto Nastaliq Urdu (Regular + Bold) downloaded to `public/fonts/` (no root/apt needed). Loaded via `@font-face file://` in the Playwright HTML template and via `@font-face /fonts/...` in the browser CSS.
  * No WeasyPrint / no system Python needed — Playwright was chosen over WeasyPrint because a real browser engine gives pixel-perfect Urdu Nastaliq shaping out of the box (WeasyPrint's HarfBuzz shaping is decent but its CSS support is more limited; Playwright is heavier but the deployment supports it).
- UNRESOLVED / RISKS:
  * The Urdu LLM occasionally emits malformed JSON on the first attempt (missing braces, nested-keyPoints mistake). Mitigated with jsonrepair + 3-attempt retry — in testing the 2nd or 3rd attempt always succeeded. Could be further hardened by switching to a stricter JSON-mode if the model exposes one.
  * Video upload cap is 120 MB / 300s route timeout — sufficient for short reels; longer videos would need chunked upload or a background job queue.
  * agent-browser's native `upload` command does not attach real file bytes in this environment; the automated QA injects files via fetch+DataTransfer. Real users uploading through the browser UI are unaffected.
