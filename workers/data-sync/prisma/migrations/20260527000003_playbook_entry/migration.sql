-- CreateTable: PlaybookEntry — team tactical library
CREATE TABLE IF NOT EXISTS "PlaybookEntry" (
    "id"          TEXT NOT NULL,
    "teamId"      TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "body"        TEXT NOT NULL,
    "category"    TEXT NOT NULL DEFAULT 'General',
    "phase"       TEXT NOT NULL DEFAULT 'ALL',
    "roles"       TEXT[] NOT NULL DEFAULT '{}',
    "pinned"      BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaybookEntry_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PlaybookEntry"
    ADD CONSTRAINT "PlaybookEntry_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlaybookEntry"
    ADD CONSTRAINT "PlaybookEntry_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
