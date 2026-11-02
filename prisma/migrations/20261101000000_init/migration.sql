CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "videoName" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "durationSec" DOUBLE PRECISION,
    "sizeBytes" INTEGER,
    "wordCount" INTEGER,
    "notesEn" TEXT,
    "notesUr" TEXT,
    "notesHi" TEXT,
    "infographicEn" TEXT,
    "infographicUr" TEXT,
    "infographicHi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "userId" TEXT,
    "shareToken" TEXT,
    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "noteId" TEXT,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "shareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProcessingJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workerJobId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "resultJson" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessingJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Note_shareToken_key" ON "Note"("shareToken");
CREATE INDEX "Note_createdAt_idx" ON "Note"("createdAt");
CREATE INDEX "Note_deletedAt_idx" ON "Note"("deletedAt");
CREATE INDEX "Note_userId_createdAt_idx" ON "Note"("userId", "createdAt");
CREATE UNIQUE INDEX "Artifact_storageKey_key" ON "Artifact"("storageKey");
CREATE INDEX "Artifact_userId_createdAt_idx" ON "Artifact"("userId", "createdAt");
CREATE INDEX "Artifact_noteId_idx" ON "Artifact"("noteId");
CREATE INDEX "Artifact_shareToken_idx" ON "Artifact"("shareToken");
CREATE INDEX "ProcessingJob_userId_createdAt_idx" ON "ProcessingJob"("userId", "createdAt");
