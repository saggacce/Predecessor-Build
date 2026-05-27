-- Add mapSnapshot field to PlaybookEntry
-- Stores JSON-serialized BoardElement[] from TacticalBoardCanvas
ALTER TABLE "PlaybookEntry" ADD COLUMN IF NOT EXISTS "mapSnapshot" TEXT;
