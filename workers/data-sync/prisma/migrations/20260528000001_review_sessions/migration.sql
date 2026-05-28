-- Review Sessions, Agenda Items, Action Items
-- Applied manually via psql before merging to main

CREATE TABLE IF NOT EXISTS "ReviewSession" (
    "id"          TEXT        NOT NULL,
    "teamId"      TEXT        NOT NULL,
    "scrimId"     TEXT,
    "title"       TEXT        NOT NULL,
    "notes"       TEXT,
    "status"      TEXT        NOT NULL DEFAULT 'PENDIENTE',
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT        NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReviewSession_teamId_fkey"    FOREIGN KEY ("teamId")    REFERENCES "Team"("id")          ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT "ReviewSession_scrimId_fkey"   FOREIGN KEY ("scrimId")   REFERENCES "ScrimSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ReviewSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id")     ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AgendaItem" (
    "id"           TEXT        NOT NULL,
    "sessionId"    TEXT        NOT NULL,
    "order"        INTEGER     NOT NULL,
    "title"        TEXT        NOT NULL,
    "description"  TEXT,
    "vodTimestamp" INTEGER,
    "playerRef"    TEXT,
    "reviewed"     BOOLEAN     NOT NULL DEFAULT false,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgendaItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AgendaItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ReviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ActionItem" (
    "id"         TEXT        NOT NULL,
    "sessionId"  TEXT        NOT NULL,
    "title"      TEXT        NOT NULL,
    "assignedTo" TEXT,
    "status"     TEXT        NOT NULL DEFAULT 'ABIERTO',
    "dueDate"    TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ActionItem_sessionId_fkey"  FOREIGN KEY ("sessionId")  REFERENCES "ReviewSession"("id") ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT "ActionItem_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id")          ON DELETE SET NULL ON UPDATE CASCADE
);
