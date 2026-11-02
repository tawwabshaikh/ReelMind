# Vercel public deployment readiness

## Repository status

The repository now contains the application-side changes for a multi-user ReelMind deployment on Vercel. The app has not been deployed, and external production services and credentials still need to be provisioned before public traffic is enabled.

## Implemented

- Google OAuth sign-in, verified Google identity, JWT sessions, account controls, and production route/API protection.
- User ownership checks for notes, transcripts, history, edits, deletes, exports, and generation APIs. Existing local SQLite notes without an owner remain local and are not automatically exposed to accounts.
- Random share tokens and read-only shared-note routes, including authorized access to private note assets.
- Local SQLite and Vercel PostgreSQL Prisma schemas, initial PostgreSQL migration, and scripts to generate both Prisma clients.
- Private Vercel Blob support for uploads, generated infographics, and PDFs; private assets are served through access-checked routes.
- A separate Docker media/AI worker for yt-dlp, ffmpeg, Whisper.cpp, and Ollama. Vercel routes enqueue transcription jobs and poll the worker.
- Vercel tracing for server-side Chromium and Urdu fonts, self-hosted Inter, safer PDF path handling, and reduced model-output logging on parse failures.
- The hero illustration now communicates the video → transcript → notes → infographic workflow.

## Required production setup

1. **Create and attach production services.** Provision PostgreSQL and a private Vercel Blob store. Set `DATABASE_URL` to the direct Postgres connection for migrations and `DATABASE_URL_POOLED` to the pooled application connection.
2. **Apply the database migration.** Before serving production traffic, run `npm run db:migrate:deploy` with the direct production `DATABASE_URL`. Local SQLite data is not imported automatically.
3. **Configure Google OAuth.** Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED=true` in Vercel. Add `https://<production-domain>/api/auth/callback/google` as an authorized Google redirect URI.
4. **Configure private Blob uploads.** Set `BLOB_READ_WRITE_TOKEN` and `NEXT_PUBLIC_VERCEL_UPLOADS=true` in Vercel. Add the same Blob token to the processing worker so it can read and clean up private uploaded videos.
5. **Deploy the processing worker.** Deploy `worker/docker-compose.yml` on a stable host with Docker, enough CPU/RAM for Whisper and Ollama, a public HTTPS endpoint, and a reverse proxy. Set `PROCESSING_WORKER_URL` and a strong matching `PROCESSING_WORKER_TOKEN` in Vercel and the worker. The included worker keeps jobs in memory and is designed for one instance; active jobs are lost if it restarts.
6. **Review function limits and cost.** Confirm the Vercel plan permits the configured function duration for note generation and rendering. The worker requires ongoing compute and model storage; this is not a guaranteed free service.
7. **Review repository history before making GitHub public.** Prior commits contain historical local database/generated files. They are absent from the current deployment tree but remain in Git history. Removing them requires rewriting history and coordinating the remote repository, so it has not been done here.

## Validation and current boundary

`npm run lint`, `npx tsc --noEmit`, and `npm run build` are the repository checks. They validate the code/build but cannot verify external OAuth credentials, production database connectivity, Blob permissions, worker availability, or the final Vercel runtime. No Vercel project was created and no deployment was started.
