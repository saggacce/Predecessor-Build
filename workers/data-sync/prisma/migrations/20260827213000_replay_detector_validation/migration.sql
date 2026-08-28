ALTER TABLE "PlayerReplayMarker"
ADD COLUMN "signalAssessment" TEXT NOT NULL DEFAULT 'UNREVIEWED';

CREATE INDEX "PlayerReplayMarker_signalAssessment_updatedAt_idx"
ON "PlayerReplayMarker"("signalAssessment", "updatedAt" DESC);
