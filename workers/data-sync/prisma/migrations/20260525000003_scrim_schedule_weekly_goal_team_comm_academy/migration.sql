-- Team: add academyOf (self-relation — this team is academy of another OWN team)
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "academyOf" TEXT;
ALTER TABLE "Team" ADD CONSTRAINT "Team_academyOf_fkey"
  FOREIGN KEY ("academyOf") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ScrimSchedule: calendar of scrims and official matches
CREATE TABLE IF NOT EXISTS "ScrimSchedule" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "teamId"      TEXT NOT NULL,
  "rivalTeamId" TEXT,
  "rivalName"   TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "type"        TEXT NOT NULL DEFAULT 'SCRIM',
  "notes"       TEXT,
  "result"      TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScrimSchedule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScrimSchedule_teamId_fkey"      FOREIGN KEY ("teamId")      REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ScrimSchedule_rivalTeamId_fkey" FOREIGN KEY ("rivalTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ScrimSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- WeeklyGoal: self-set weekly goal for standalone players
CREATE TABLE IF NOT EXISTS "WeeklyGoal" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "userId"       TEXT NOT NULL,
  "playerId"     TEXT,
  "title"        TEXT NOT NULL,
  "metricKey"    TEXT NOT NULL DEFAULT 'custom',
  "targetValue"  DOUBLE PRECISION,
  "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "weekStart"    TIMESTAMP(3) NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklyGoal_pkey"   PRIMARY KEY ("id"),
  CONSTRAINT "WeeklyGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- TeamComm: internal communications (coach → analyst requests, manager announcements)
CREATE TABLE IF NOT EXISTS "TeamComm" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "teamId"       TEXT NOT NULL,
  "fromUserId"   TEXT NOT NULL,
  "toRole"       TEXT,
  "toUserId"     TEXT,
  "type"         TEXT NOT NULL DEFAULT 'REQUEST',
  "subject"      TEXT NOT NULL,
  "body"         TEXT NOT NULL,
  "priority"     TEXT NOT NULL DEFAULT 'normal',
  "status"       TEXT NOT NULL DEFAULT 'OPEN',
  "resolvedAt"   TIMESTAMP(3),
  "resolvedById" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamComm_pkey"         PRIMARY KEY ("id"),
  CONSTRAINT "TeamComm_teamId_fkey"      FOREIGN KEY ("teamId")     REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TeamComm_fromUserId_fkey"  FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TeamComm_toUserId_fkey"    FOREIGN KEY ("toUserId")   REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
