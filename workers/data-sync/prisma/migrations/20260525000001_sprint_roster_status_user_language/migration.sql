-- AlterTable: add rosterStatus to TeamRoster (STARTER | BENCH)
ALTER TABLE "TeamRoster" ADD COLUMN IF NOT EXISTS "rosterStatus" TEXT NOT NULL DEFAULT 'STARTER';

-- AlterTable: add language preference to User (en | es)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'en';
