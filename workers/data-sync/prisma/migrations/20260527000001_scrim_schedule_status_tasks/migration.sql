-- Add status, analysedAt and reviewedAt to ScrimSchedule
ALTER TABLE "ScrimSchedule" ADD COLUMN IF NOT EXISTS "status"     TEXT NOT NULL DEFAULT 'PENDIENTE';
ALTER TABLE "ScrimSchedule" ADD COLUMN IF NOT EXISTS "analysedAt" TIMESTAMP(3);
ALTER TABLE "ScrimSchedule" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
