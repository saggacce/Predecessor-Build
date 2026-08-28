ALTER TABLE "Match"
  ADD COLUMN "endTime" TIMESTAMP(3),
  ADD COLUMN "endReason" TEXT,
  ADD COLUMN "spoilerBlockedUntil" TIMESTAMP(3);

ALTER TABLE "MatchPlayer"
  ADD COLUMN "crestHealingDone" INTEGER,
  ADD COLUMN "itemHealingDone" INTEGER,
  ADD COLUMN "utilityHealingDone" INTEGER,
  ADD COLUMN "totalShieldingReceived" INTEGER,
  ADD COLUMN "totalDamageMitigated" INTEGER,
  ADD COLUMN "physicalDamageTaken" INTEGER,
  ADD COLUMN "magicalDamageTaken" INTEGER,
  ADD COLUMN "trueDamageTaken" INTEGER,
  ADD COLUMN "physicalDamageTakenFromHeroes" INTEGER,
  ADD COLUMN "magicalDamageTakenFromHeroes" INTEGER,
  ADD COLUMN "trueDamageTakenFromHeroes" INTEGER,
  ADD COLUMN "minionsKilled" INTEGER,
  ADD COLUMN "neutralMinionsKilled" INTEGER,
  ADD COLUMN "neutralMinionsTeamJungle" INTEGER,
  ADD COLUMN "neutralMinionsEnemyJungle" INTEGER,
  ADD COLUMN "ratingId" TEXT,
  ADD COLUMN "ratingPoints" DOUBLE PRECISION,
  ADD COLUMN "ratingNewPoints" DOUBLE PRECISION,
  ADD COLUMN "ratingDelta" DOUBLE PRECISION,
  ADD COLUMN "ratingRankName" TEXT,
  ADD COLUMN "ratingTierName" TEXT,
  ADD COLUMN "ratingIsRankup" BOOLEAN;
