# Vercel deployment readiness

**Status: build configuration is prepared, but the full ReelMind service is not ready for a public Vercel deployment.** No Vercel project was created and nothing was deployed.

## Changes made in this preparation

- Use Vercel's normal Next.js build output; `npm run build` now generates Prisma Client and runs `next build`.
- Use Node.js 20.9 or newer and `next start` for local production runs.
- Self-host Inter so a production build does not need to fetch Google Fonts.
- Include the Urdu font files in the relevant route-handler traces.
- Ignore local SQLite files and generated exports. The local `.env`, database, and generated files have been removed from Git tracking without deleting their local copies.
- Stop tracking the local development PID file.
- Restrict PDF infographic paths to generated PNGs, preventing arbitrary local-file reads through that endpoint.
- Stop logging raw model response excerpts when note JSON parsing fails.
- Remove the unused `/api` Hello World endpoint.

## Required before production

1. **Database:** The Prisma schema currently uses SQLite. Replace it with managed PostgreSQL, add production migrations, configure `DATABASE_URL` in Vercel, and migrate any history that should be retained. [Vercel does not support durable SQLite storage in Functions](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel).
2. **Generated files:** Infographics and PDFs are written to `public/generated`. Function files are not durable deployment storage. Move these artifacts to object storage and persist their URLs, such as [Vercel Blob](https://vercel.com/docs/vercel-blob).
3. **Video processing:** Transcription currently depends on local `ffmpeg`, `ffprobe`, `whisper-cli`, a Whisper model file, and `yt-dlp`. Those binaries/model files are not provisioned for Vercel. The 120 MB upload limit also exceeds Vercel Function's [4.5 MB request/response payload limit](https://vercel.com/docs/functions/limitations). Use direct object-storage uploads and a separate worker or hosted processing service.
4. **AI:** `OLLAMA_BASE_URL` defaults to `127.0.0.1:11434`; in Vercel that points to the function container, not the developer's computer. Configure a reachable model service or move inference to a worker.
5. **Chromium:** Infographic and PDF rendering launch Playwright Chromium. The repository installs Playwright but does not provision a serverless-compatible Chromium executable. That rendering path needs a compatible browser package or a rendering service.
6. **Access control:** Notes, transcripts, history, and destructive API routes have no authentication or ownership checks. Protect the app and APIs before making the deployment public.
7. **Git history:** Earlier repository commits contain versions of the local database and generated exports. Removing them from the current tree does not remove prior copies from Git history. Review repository visibility and decide whether to purge that history before sharing it publicly.

Vercel's current limits and storage behavior can change; check the account's plan and connected storage pricing before provisioning services.
