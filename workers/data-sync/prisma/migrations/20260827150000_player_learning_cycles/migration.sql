CREATE TABLE "PlayerLearningMomentReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "matchPlayerId" TEXT NOT NULL,
    "momentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlayerLearningMomentReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlayerTrainingCycle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "focusKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cue" TEXT NOT NULL,
    "targetMatches" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sourceMatchId" TEXT,
    "sourceMomentId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlayerTrainingCycle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerLearningMomentReview_userId_matchId_momentId_key" ON "PlayerLearningMomentReview"("userId", "matchId", "momentId");
CREATE INDEX "PlayerLearningMomentReview_userId_status_updatedAt_idx" ON "PlayerLearningMomentReview"("userId", "status", "updatedAt" DESC);
CREATE INDEX "PlayerLearningMomentReview_matchId_matchPlayerId_idx" ON "PlayerLearningMomentReview"("matchId", "matchPlayerId");
CREATE INDEX "PlayerTrainingCycle_userId_status_startedAt_idx" ON "PlayerTrainingCycle"("userId", "status", "startedAt" DESC);
CREATE INDEX "PlayerTrainingCycle_playerId_startedAt_idx" ON "PlayerTrainingCycle"("playerId", "startedAt" DESC);

ALTER TABLE "PlayerLearningMomentReview" ADD CONSTRAINT "PlayerLearningMomentReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerTrainingCycle" ADD CONSTRAINT "PlayerTrainingCycle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
