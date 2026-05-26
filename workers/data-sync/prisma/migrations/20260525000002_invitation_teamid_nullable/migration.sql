-- AlterTable: make teamId nullable on Invitation (allows standalone JUGADOR invitations with no team)
ALTER TABLE "Invitation" ALTER COLUMN "teamId" DROP NOT NULL;
