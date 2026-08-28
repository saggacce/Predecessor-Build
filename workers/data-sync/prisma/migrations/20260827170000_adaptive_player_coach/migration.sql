ALTER TABLE "PlayerTrainingCycle"
  ADD COLUMN "profileId" TEXT,
  ADD COLUMN "competencyKey" TEXT,
  ADD COLUMN "learningLevel" INTEGER,
  ADD COLUMN "successCriteria" JSONB,
  ADD COLUMN "evaluation" JSONB;

CREATE TABLE "PlayerLearningProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "overallLevel" INTEGER NOT NULL DEFAULT 1,
  "placementStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "activeRole" TEXT,
  "explanationDepth" TEXT NOT NULL DEFAULT 'FOUNDATIONAL',
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlayerLearningProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlayerCompetency" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "competencyKey" TEXT NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 1,
  "mastery" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "evidenceCount" INTEGER NOT NULL DEFAULT 0,
  "correctCount" INTEGER NOT NULL DEFAULT 0,
  "appliedCount" INTEGER NOT NULL DEFAULT 0,
  "lastEvidenceAt" TIMESTAMP(3),
  "nextReviewAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlayerCompetency_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CoachQuestionAttempt" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "questionKey" TEXT NOT NULL,
  "competencyKey" TEXT NOT NULL,
  "learningLevel" INTEGER NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceMatchId" TEXT,
  "promptSnapshot" JSONB NOT NULL,
  "optionsSnapshot" JSONB NOT NULL,
  "selectedOptionId" TEXT NOT NULL,
  "evaluation" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "rationaleSnapshot" TEXT NOT NULL,
  "evidenceSnapshot" JSONB,
  "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoachQuestionAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlayerReplaySession" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "matchId" TEXT,
  "matchPlayerId" TEXT,
  "title" TEXT NOT NULL,
  "recordingUrl" TEXT,
  "durationSeconds" INTEGER,
  "offsetSeconds" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlayerReplaySession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlayerReplayMarker" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "gameTime" INTEGER NOT NULL,
  "videoTime" INTEGER NOT NULL,
  "sourceEventId" TEXT,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "conclusion" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlayerReplayMarker_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiveTrainingSession" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "requestedGameMode" TEXT NOT NULL,
  "detectedGameMode" TEXT,
  "modeVerification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
  "verificationSignals" JSONB,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "captureConsent" BOOLEAN NOT NULL DEFAULT false,
  "rankedBlockedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LiveTrainingSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiveTrainingEvent" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "gameTime" INTEGER,
  "eventType" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "advice" TEXT,
  "confidence" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveTrainingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerLearningProfile_userId_key" ON "PlayerLearningProfile"("userId");
CREATE INDEX "PlayerLearningProfile_playerId_updatedAt_idx" ON "PlayerLearningProfile"("playerId", "updatedAt" DESC);
CREATE UNIQUE INDEX "PlayerCompetency_profileId_competencyKey_key" ON "PlayerCompetency"("profileId", "competencyKey");
CREATE INDEX "PlayerCompetency_profileId_mastery_confidence_idx" ON "PlayerCompetency"("profileId", "mastery", "confidence");
CREATE INDEX "CoachQuestionAttempt_profileId_competencyKey_answeredAt_idx" ON "CoachQuestionAttempt"("profileId", "competencyKey", "answeredAt" DESC);
CREATE INDEX "CoachQuestionAttempt_profileId_sourceType_answeredAt_idx" ON "CoachQuestionAttempt"("profileId", "sourceType", "answeredAt" DESC);
CREATE INDEX "PlayerReplaySession_profileId_status_updatedAt_idx" ON "PlayerReplaySession"("profileId", "status", "updatedAt" DESC);
CREATE INDEX "PlayerReplaySession_matchId_idx" ON "PlayerReplaySession"("matchId");
CREATE INDEX "PlayerReplayMarker_sessionId_gameTime_idx" ON "PlayerReplayMarker"("sessionId", "gameTime");
CREATE INDEX "LiveTrainingSession_profileId_status_startedAt_idx" ON "LiveTrainingSession"("profileId", "status", "startedAt" DESC);
CREATE INDEX "LiveTrainingSession_modeVerification_status_idx" ON "LiveTrainingSession"("modeVerification", "status");
CREATE INDEX "LiveTrainingEvent_sessionId_createdAt_idx" ON "LiveTrainingEvent"("sessionId", "createdAt");
CREATE INDEX "PlayerTrainingCycle_profileId_status_startedAt_idx" ON "PlayerTrainingCycle"("profileId", "status", "startedAt" DESC);

ALTER TABLE "PlayerLearningProfile" ADD CONSTRAINT "PlayerLearningProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerLearningProfile" ADD CONSTRAINT "PlayerLearningProfile_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerCompetency" ADD CONSTRAINT "PlayerCompetency_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerLearningProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoachQuestionAttempt" ADD CONSTRAINT "CoachQuestionAttempt_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerLearningProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerTrainingCycle" ADD CONSTRAINT "PlayerTrainingCycle_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerLearningProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlayerReplaySession" ADD CONSTRAINT "PlayerReplaySession_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerLearningProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerReplaySession" ADD CONSTRAINT "PlayerReplaySession_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlayerReplayMarker" ADD CONSTRAINT "PlayerReplayMarker_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PlayerReplaySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveTrainingSession" ADD CONSTRAINT "LiveTrainingSession_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerLearningProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveTrainingEvent" ADD CONSTRAINT "LiveTrainingEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveTrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
