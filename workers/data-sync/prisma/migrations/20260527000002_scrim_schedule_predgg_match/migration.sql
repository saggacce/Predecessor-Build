-- Add pred.gg match UUID to ScrimSchedule for auto-detected results
ALTER TABLE "ScrimSchedule" ADD COLUMN IF NOT EXISTS "predggMatchId" TEXT;
