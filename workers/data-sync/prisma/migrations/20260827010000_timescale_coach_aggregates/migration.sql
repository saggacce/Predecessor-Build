-- Reproduce the production time-series layout on every environment.
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS "HeroKill" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "gameTime" INTEGER NOT NULL,
  "syncedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locationX" DOUBLE PRECISION,
  "locationY" DOUBLE PRECISION,
  "locationZ" DOUBLE PRECISION,
  "killerTeam" TEXT,
  "killedTeam" TEXT,
  "killerHeroSlug" TEXT,
  "killedHeroSlug" TEXT,
  "killerPlayerId" TEXT,
  "killedPlayerId" TEXT,
  PRIMARY KEY ("id", "syncedAt"),
  CONSTRAINT "HeroKill_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ObjectiveKill" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "gameTime" INTEGER NOT NULL,
  "syncedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "entityType" TEXT NOT NULL,
  "killerTeam" TEXT,
  "killerPlayerId" TEXT,
  "locationX" DOUBLE PRECISION,
  "locationY" DOUBLE PRECISION,
  "locationZ" DOUBLE PRECISION,
  PRIMARY KEY ("id", "syncedAt"),
  CONSTRAINT "ObjectiveKill_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "StructureDestruction" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "gameTime" INTEGER NOT NULL,
  "syncedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "structureType" TEXT NOT NULL,
  "destructionTeam" TEXT,
  "locationX" DOUBLE PRECISION,
  "locationY" DOUBLE PRECISION,
  "locationZ" DOUBLE PRECISION,
  PRIMARY KEY ("id", "syncedAt"),
  CONSTRAINT "StructureDestruction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "WardEvent" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "gameTime" INTEGER NOT NULL,
  "syncedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "eventType" TEXT NOT NULL,
  "wardType" TEXT NOT NULL,
  "locationX" DOUBLE PRECISION,
  "locationY" DOUBLE PRECISION,
  "locationZ" DOUBLE PRECISION,
  "playerId" TEXT,
  "team" TEXT,
  PRIMARY KEY ("id", "syncedAt"),
  CONSTRAINT "WardEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Transaction" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "gameTime" INTEGER NOT NULL,
  "syncedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "transactionType" TEXT NOT NULL,
  "itemName" TEXT,
  "playerId" TEXT,
  "team" TEXT,
  PRIMARY KEY ("id", "syncedAt"),
  CONSTRAINT "Transaction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

SELECT create_hypertable('"HeroKill"', 'syncedAt', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE, migrate_data => TRUE);
SELECT create_hypertable('"ObjectiveKill"', 'syncedAt', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE, migrate_data => TRUE);
SELECT create_hypertable('"StructureDestruction"', 'syncedAt', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE, migrate_data => TRUE);
SELECT create_hypertable('"WardEvent"', 'syncedAt', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE, migrate_data => TRUE);
SELECT create_hypertable('"Transaction"', 'syncedAt', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE, migrate_data => TRUE);

DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['HeroKill', 'ObjectiveKill', 'StructureDestruction', 'WardEvent', 'Transaction']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM timescaledb_information.hypertables
      WHERE hypertable_schema = 'public'
        AND timescaledb_information.hypertables.hypertable_name = target_table
        AND compression_enabled
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I SET (timescaledb.compress, timescaledb.compress_segmentby = ''matchId'', timescaledb.compress_orderby = ''syncedAt DESC'')',
        target_table
      );
    END IF;
  END LOOP;
END $$;

SELECT add_compression_policy('"HeroKill"', INTERVAL '30 days', if_not_exists => TRUE);
SELECT add_compression_policy('"ObjectiveKill"', INTERVAL '30 days', if_not_exists => TRUE);
SELECT add_compression_policy('"StructureDestruction"', INTERVAL '30 days', if_not_exists => TRUE);
SELECT add_compression_policy('"WardEvent"', INTERVAL '30 days', if_not_exists => TRUE);
SELECT add_compression_policy('"Transaction"', INTERVAL '30 days', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS "Match_startTime_gameMode_versionId_idx" ON "Match"("startTime" DESC, "gameMode", "versionId");
CREATE INDEX IF NOT EXISTS "MatchPlayer_playerId_matchId_idx" ON "MatchPlayer"("playerId", "matchId");
CREATE INDEX IF NOT EXISTS "MatchPlayer_playerId_role_heroSlug_idx" ON "MatchPlayer"("playerId", "role", "heroSlug");
CREATE INDEX IF NOT EXISTS "MatchPlayer_matchId_team_role_idx" ON "MatchPlayer"("matchId", "team", "role");
CREATE INDEX IF NOT EXISTS "HeroKill_matchId_gameTime_idx" ON "HeroKill"("matchId", "gameTime");
CREATE INDEX IF NOT EXISTS "ObjectiveKill_matchId_gameTime_idx" ON "ObjectiveKill"("matchId", "gameTime");
CREATE INDEX IF NOT EXISTS "StructureDestruction_matchId_gameTime_idx" ON "StructureDestruction"("matchId", "gameTime");
CREATE INDEX IF NOT EXISTS "WardEvent_matchId_playerId_gameTime_idx" ON "WardEvent"("matchId", "playerId", "gameTime");
CREATE INDEX IF NOT EXISTS "Transaction_matchId_playerId_gameTime_idx" ON "Transaction"("matchId", "playerId", "gameTime");

CREATE MATERIALIZED VIEW IF NOT EXISTS "CoachBuildAggregate" AS
SELECT
  md5(concat_ws('|', COALESCE(m."versionId", 'unknown'), m."gameMode", COALESCE(mp.role, 'unknown'), mp."heroSlug", mp."inventoryItems"::text)) AS "aggregateKey",
  m."versionId",
  m."gameMode",
  mp.role,
  mp."heroSlug",
  mp."inventoryItems" AS "buildItems",
  COUNT(*)::INTEGER AS matches,
  COUNT(*) FILTER (WHERE m."winningTeam" = mp.team)::INTEGER AS wins,
  ROUND(AVG((mp.kills + mp.assists)::numeric / GREATEST(mp.deaths, 1)), 2)::DOUBLE PRECISION AS kda,
  ROUND(AVG(mp."heroDamage")::numeric, 0)::DOUBLE PRECISION AS "averageHeroDamage",
  ROUND(AVG(mp.gold)::numeric, 0)::DOUBLE PRECISION AS "averageGold",
  MAX(m."startTime") AS "lastSeenAt"
FROM "MatchPlayer" mp
JOIN "Match" m ON m.id = mp."matchId"
WHERE mp."playerId" IS NOT NULL
  AND jsonb_typeof(mp."inventoryItems") = 'array'
  AND jsonb_array_length(mp."inventoryItems") > 0
GROUP BY m."versionId", m."gameMode", mp.role, mp."heroSlug", mp."inventoryItems"
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS "CoachBuildAggregate_key" ON "CoachBuildAggregate"("aggregateKey");
CREATE INDEX IF NOT EXISTS "CoachBuildAggregate_lookup" ON "CoachBuildAggregate"("heroSlug", role, "gameMode", "versionId", matches DESC);

CREATE MATERIALIZED VIEW IF NOT EXISTS "CoachMatchupAggregate" AS
SELECT
  md5(concat_ws('|', COALESCE(m."versionId", 'unknown'), m."gameMode", COALESCE(player.role, 'unknown'), player."heroSlug", opponent."heroSlug")) AS "aggregateKey",
  m."versionId",
  m."gameMode",
  player.role,
  player."heroSlug",
  opponent."heroSlug" AS "opponentHeroSlug",
  COUNT(*)::INTEGER AS matches,
  COUNT(*) FILTER (WHERE m."winningTeam" = player.team)::INTEGER AS wins,
  ROUND(AVG((player.kills + player.assists)::numeric / GREATEST(player.deaths, 1)), 2)::DOUBLE PRECISION AS kda,
  ROUND(AVG(player."heroDamage")::numeric, 0)::DOUBLE PRECISION AS "averageHeroDamage",
  MAX(m."startTime") AS "lastSeenAt"
FROM "MatchPlayer" player
JOIN "Match" m ON m.id = player."matchId"
JOIN "MatchPlayer" opponent
  ON opponent."matchId" = player."matchId"
 AND opponent.team <> player.team
 AND opponent.role IS NOT DISTINCT FROM player.role
WHERE player."playerId" IS NOT NULL
GROUP BY m."versionId", m."gameMode", player.role, player."heroSlug", opponent."heroSlug"
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS "CoachMatchupAggregate_key" ON "CoachMatchupAggregate"("aggregateKey");
CREATE INDEX IF NOT EXISTS "CoachMatchupAggregate_lookup" ON "CoachMatchupAggregate"("heroSlug", role, "opponentHeroSlug", "gameMode", "versionId", matches DESC);

CREATE MATERIALIZED VIEW IF NOT EXISTS "CoachPlayerIntervalAggregate" AS
SELECT
  md5(concat_ws('|', mp."playerId", date_trunc('week', m."startTime")::text, m."gameMode", COALESCE(mp.role, 'unknown'), mp."heroSlug")) AS "aggregateKey",
  mp."playerId",
  date_trunc('week', m."startTime") AS "intervalStart",
  m."gameMode",
  mp.role,
  mp."heroSlug",
  COUNT(*)::INTEGER AS matches,
  COUNT(*) FILTER (WHERE m."winningTeam" = mp.team)::INTEGER AS wins,
  ROUND(AVG((mp.kills + mp.assists)::numeric / GREATEST(mp.deaths, 1)), 2)::DOUBLE PRECISION AS kda,
  ROUND(AVG(mp.gold / GREATEST(m.duration / 60.0, 1))::numeric, 2)::DOUBLE PRECISION AS gpm,
  ROUND(AVG(mp."heroDamage" / GREATEST(m.duration / 60.0, 1))::numeric, 2)::DOUBLE PRECISION AS dpm,
  ROUND(AVG(mp."laneMinionsKilled" / GREATEST(m.duration / 60.0, 1))::numeric, 2)::DOUBLE PRECISION AS "csPerMinute",
  ROUND(AVG(mp.deaths)::numeric, 2)::DOUBLE PRECISION AS "deathsPerMatch"
FROM "MatchPlayer" mp
JOIN "Match" m ON m.id = mp."matchId"
WHERE mp."playerId" IS NOT NULL
GROUP BY mp."playerId", date_trunc('week', m."startTime"), m."gameMode", mp.role, mp."heroSlug"
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS "CoachPlayerIntervalAggregate_key" ON "CoachPlayerIntervalAggregate"("aggregateKey");
CREATE INDEX IF NOT EXISTS "CoachPlayerIntervalAggregate_lookup" ON "CoachPlayerIntervalAggregate"("playerId", "intervalStart" DESC, "gameMode", role, "heroSlug");
