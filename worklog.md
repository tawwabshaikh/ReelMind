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

---
Task ID: 7 (cron round 1)
Agent: main (Z.ai Code) — 15-min recurring QA & enhancement
Task: Assess project status, run QA via agent-browser, then advance with mandatory styling improvements + new features (no bugs to fix — core was stable).

## Current project status (assessment)
- Core features (bilingual EN/UR notes + Playwright infographic) were COMPLETE and stable from the previous round.
- QA at start of this round: dev.log clean (no errors/warnings), `bun run lint` → 0/0, GET / → 200, GET /api/notes → 200, agent-browser smoke test rendered correctly with history rows already populated.
- No bugs, test failures, build failures, or runtime errors found → proceeded to enhancement work per the cron mandate ([Mandatory] improve styling + add features).

## Current goals / completed modifications / verification

### FEATURE A — Multiple infographic themes (emerald / midnight / sunrise)
- `src/lib/infographic.ts`: refactored the single hardcoded `PALETTE` into a `PALETTES: Record<Theme, Palette>` map with 3 distinct palettes. Each theme has its own bg gradient, accent, tag, badge, glow colors. Added `Theme` type + `isTheme()` type guard + `THEMES` metadata (label/urdu/swatch) for the UI.
- Enriched the HTML template: added radial glow blobs (top-right + bottom-left) for depth, gradient divider (amber→accent), title text-shadow, inset accent line on point cards, theme name shown in the footer.
- Threaded `theme` through `renderInfographic(note, theme)` + `renderInfographics(notes, theme)` + the API route + frontend.
- New `ThemeSelector` component (`src/components/reel-notes/theme-selector.tsx`): 3 swatch cards showing the palette colors + EN/UR labels, with active-state ring.
- Filenames now embed the theme: `infographic-{theme}-{lang}-{ts}-{rand}.png`.
- **Verification**: agent-browser selected Midnight → Regenerate → produced `infographic-midnight-english/urdu-*.png` (2160×2700, ok:true). VLM confirmed: "background is dark indigo/midnight (not green), accent is indigo/purple, Urdu still proper Nastaliq + right-aligned, no rendering issues." Same for Sunrise ("deep dark brown bg, vibrant orange accent"). All 3 themes visually distinct.

### FEATURE B — History detail reload (click a row → reload into workspace)
- New route `GET /api/notes/[id]` (`src/app/api/notes/[id]/route.ts`): returns full note detail (transcript, parsed EN/UR structured notes + markdown, infographic file refs). Reuses `structuredNoteToMarkdown` so the reloaded notes are immediately downloadable.
- `HistoryPanel` rewritten: rows are now clickable buttons with hover/active states, language badge, EN✓/UR✓/img indicators, relative time-ago ("21h ago"), and a loading spinner per-row. Shows a hint "Click any row to reload it into the workspace".
- `page.tsx` `loadHistoryNote(id)`: fetches the detail, populates transcript + notes + infographics + sets `loadedNoteId` (highlights the active row + shows a "from history" badge in the Results header). Clears the file input (since we're working from saved data, not a fresh upload).
- **Verification**: agent-browser clicked a history row → all 3 tabs enabled, Notes tab populated with EN ("Productive Deep Work") + UR (Nastaliq title) + Copy/.md buttons, "Regenerate notes only" button appeared. Active row highlighted. No console errors.

### FEATURE C — Copy-to-clipboard + transcript stats + regenerate-notes-only
- `NotesView`: each note card now has a Copy button (clipboard icon → check icon on success, with EN/UR toast: "Notes copied to clipboard" / "نوٹس کاپی ہو گئے"). Header band got a radial sheen overlay; point cards use gradient badges + hover bg.
- `TranscriptView`: added stats chips — source filename, duration, words, chars, + an emerald reading-time chip (est. @200wpm). Copy transcript button added alongside .txt download.
- `page.tsx`: new "Regenerate notes only" button (appears once a transcript exists) — re-runs `/api/generate-notes` on the existing transcript without re-uploading. Useful for trying a different language or getting a fresh summary.
- **Verification**: agent-browser saw all 4 stat values (66 words, 431 chars, 20s read, source, duration), Copy buttons present on both EN+UR cards, Regenerate-notes-only button clicked → POST /api/generate-notes 200 in 2.5s → fresh notes loaded.

### Styling polish (mandatory)
- Hero: added a 4-card feature strip (Bilingual / 3 themes / PNG 1080×1350 / History) with icon tiles.
- Header: added "v2" badge.
- UploadZone: added decorative blurred corner accents (emerald + amber).
- Notes cards: gradient header sheen, gradient point badges, hover bg transitions.
- Infographic cards: ring + hover scale on the image.
- Pipeline stepper: added Urdu labels next to each step (ٹرانسکرائب / خلاصہ / نوٹس / انفوگرافک).
- Footer: added Zap icon, refined copy.
- History rows: full visual redesign with badges + time-ago + chevron + active highlight.

### Verification summary
- `bun run lint` → 0 errors, 0 warnings.
- dev.log: all API calls 200 (transcribe, generate-notes, generate-infographic, notes, notes/[id]); no errors/exceptions.
- agent-browser: page renders, history click-to-load works, theme selector + regenerate produces themed PNGs (verified 3 themes via VLM), transcript stats display, copy buttons present, no console errors.
- Sticky footer: sticksToBottom:true on 1600px viewport; mobile 375px renders.
- Generated assets: 8 PNGs across emerald/midnight/sunrise × en/urdu.

## Unresolved issues / risks + next-phase recommendations
- The Urdu LLM JSON malformation (noted in prior round) remains mitigated by jsonrepair + 3-attempt retry; no failures observed this round (generate-notes returned 200 in 2.5s on the regenerate test). Could still be hardened with a JSON-mode if the model exposes one.
- Clipboard `readText` is blocked in headless automation (browser permission) — the copy *write* succeeds (button + toast confirm); only verification-by-readback is unavailable in agent-browser. Real users are unaffected.
- History rows loaded from DB have `durationSec: null` and `sizeBytes: 0` (we don't store these on the Note row) — shown as "—" in the transcript stats. **Recommendation for next round**: add `durationSec` + `sizeBytes` columns to the Note schema so reloaded history shows full stats. Low effort, nice polish.
- **Next-phase feature ideas** (in priority order): (1) multi-note comparison view; (2) export combined PDF (notes + infographic); (3) shareable public link per note; (4) tag-based filtering in the history panel; (5) editable notes (inline edit of key points before infographic render).
