ALTER TABLE "PlayerReplaySession"
ADD COLUMN "liveTrainingSessionId" TEXT,
ADD COLUMN "detectorCalibration" JSONB;

CREATE UNIQUE INDEX "PlayerReplaySession_liveTrainingSessionId_key"
ON "PlayerReplaySession"("liveTrainingSessionId");

ALTER TABLE "PlayerReplaySession"
ADD CONSTRAINT "PlayerReplaySession_liveTrainingSessionId_fkey"
FOREIGN KEY ("liveTrainingSessionId") REFERENCES "LiveTrainingSession"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
