/**
 * QA Seed Script — genera datos sintéticos para probar Team Analysis y todas las tabs.
 *
 * Uso:
 *   npx tsx scripts/seed-qa.ts          # crear datos
 *   npx tsx scripts/seed-qa.ts --clean  # borrar todos los datos [QA]
 */

import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

try {
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '../.env'));
} catch { /* ok */ }

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// ── Config ────────────────────────────────────────────────────────────────────

const QA_TAG = '[QA]';
const OWN_TEAM_NAME = '[QA] Alpha';
const RIVAL_TEAM_NAME = '[QA] Beta';
const MATCH_COUNT = 15;

const HEROES = {
  carry:    ['drongo', 'gadget', 'sparrow'],
  jungle:   ['wraith', 'grux', 'phase'],
  midlane:  ['zinx', 'murdock', 'serath'],
  offlane:  ['countess', 'gideon', 'rampage'],
  support:  ['feng-mao', 'belica', 'aurora'],
};

const ROLES = ['carry', 'jungle', 'midlane', 'offlane', 'support'] as const;

const OBJECTIVES = ['FANGTOOTH', 'ORB_PRIME', 'SEEDLING_NORTH', 'SEEDLING_SOUTH'] as const;

const STRUCTURE_TYPES = ['OUTER_TOWER', 'INNER_TOWER', 'INHIBITOR'] as const;

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function cuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Clean ─────────────────────────────────────────────────────────────────────

async function clean() {
  console.log('🧹 Borrando datos QA...');

  // Find QA teams
  const teams = await db.team.findMany({ where: { name: { startsWith: QA_TAG } } });
  const teamIds = teams.map((t) => t.id);

  // Find QA players
  const players = await db.player.findMany({ where: { displayName: { startsWith: QA_TAG } } });
  const playerIds = players.map((p) => p.id);

  if (teamIds.length === 0 && playerIds.length === 0) {
    console.log('No hay datos QA que borrar.');
    return;
  }

  // Find all match IDs that have QA players
  const matchPlayers = await db.matchPlayer.findMany({
    where: { playerId: { in: playerIds } },
    select: { matchId: true },
    distinct: ['matchId'],
  });
  const matchIds = matchPlayers.map((mp) => mp.matchId);

  // Delete in correct order (FK constraints)
  if (matchIds.length > 0) {
    await db.heroBan.deleteMany({ where: { matchId: { in: matchIds } } });
    await db.heroKill.deleteMany({ where: { matchId: { in: matchIds } } });
    await db.objectiveKill.deleteMany({ where: { matchId: { in: matchIds } } });
    await db.structureDestruction.deleteMany({ where: { matchId: { in: matchIds } } });
    await db.wardEvent.deleteMany({ where: { matchId: { in: matchIds } } });
    await db.transaction.deleteMany({ where: { matchId: { in: matchIds } } });
    await db.matchPlayer.deleteMany({ where: { matchId: { in: matchIds } } });
    await db.match.deleteMany({ where: { id: { in: matchIds } } });
    console.log(`  ✓ ${matchIds.length} partidas eliminadas`);
  }

  if (playerIds.length > 0) {
    await db.teamRoster.deleteMany({ where: { playerId: { in: playerIds } } });
    await db.playerSnapshot.deleteMany({ where: { playerId: { in: playerIds } } });
    await db.player.deleteMany({ where: { id: { in: playerIds } } });
    console.log(`  ✓ ${playerIds.length} jugadores eliminados`);
  }

  if (teamIds.length > 0) {
    await db.teamRoster.deleteMany({ where: { teamId: { in: teamIds } } });
    await db.reviewItem.deleteMany({ where: { teamId: { in: teamIds } } });
    await db.teamGoal.deleteMany({ where: { teamId: { in: teamIds } } });
    await db.llmAnalysis.deleteMany({ where: { teamId: { in: teamIds } } });
    await db.team.deleteMany({ where: { id: { in: teamIds } } });
    console.log(`  ✓ ${teamIds.length} equipos eliminados`);
  }

  console.log('✅ Datos QA eliminados.');
}

// ── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Generando datos QA...');

  // ── Teams ──────────────────────────────────────────────────────────────────

  let ownTeam = await db.team.findFirst({ where: { name: OWN_TEAM_NAME } });
  let rivalTeam = await db.team.findFirst({ where: { name: RIVAL_TEAM_NAME } });

  if (ownTeam && rivalTeam) {
    console.log('ℹ️  Los equipos QA ya existen — actualizando partidas únicamente.');
  } else {
    ownTeam = ownTeam ?? await db.team.create({
      data: { name: OWN_TEAM_NAME, abbreviation: 'QAA', type: 'OWN', region: 'EU' },
    });
    rivalTeam = rivalTeam ?? await db.team.create({
      data: { name: RIVAL_TEAM_NAME, abbreviation: 'QAB', type: 'RIVAL', region: 'EU' },
    });
    console.log(`  ✓ Equipos: ${OWN_TEAM_NAME} / ${RIVAL_TEAM_NAME}`);
  }

  // ── Players ────────────────────────────────────────────────────────────────

  const ownPlayers: { id: string; role: string }[] = [];
  const rivalPlayers: { id: string; role: string }[] = [];

  for (const role of ROLES) {
    const heroSlug = pick(HEROES[role]);

    // OWN player
    const ownDisplayName = `${QA_TAG} ${role}-${heroSlug}`;
    let ownPlayer = await db.player.findFirst({ where: { displayName: ownDisplayName } });
    if (!ownPlayer) {
      ownPlayer = await db.player.create({
        data: {
          predggId: `qa-own-${role}`,
          predggUuid: `qa-own-${role}-uuid`,
          displayName: ownDisplayName,
          lastSynced: new Date(),
        },
      });
    }
    ownPlayers.push({ id: ownPlayer.id, role });

    // Add to own team roster if not already
    const existingOwn = await db.teamRoster.findFirst({ where: { teamId: ownTeam.id, playerId: ownPlayer.id } });
    if (!existingOwn) {
      await db.teamRoster.create({ data: { teamId: ownTeam.id, playerId: ownPlayer.id, role } });
    }

    // RIVAL player
    const rivalDisplayName = `${QA_TAG} rival-${role}`;
    let rivalPlayer = await db.player.findFirst({ where: { displayName: rivalDisplayName } });
    if (!rivalPlayer) {
      rivalPlayer = await db.player.create({
        data: {
          predggId: `qa-rival-${role}`,
          predggUuid: `qa-rival-${role}-uuid`,
          displayName: rivalDisplayName,
          lastSynced: new Date(),
        },
      });
    }
    rivalPlayers.push({ id: rivalPlayer.id, role });

    const existingRival = await db.teamRoster.findFirst({ where: { teamId: rivalTeam.id, playerId: rivalPlayer.id } });
    if (!existingRival) {
      await db.teamRoster.create({ data: { teamId: rivalTeam.id, playerId: rivalPlayer.id, role } });
    }
  }
  console.log(`  ✓ 10 jugadores (5 OWN + 5 RIVAL) en roster`);

  // ── Version ────────────────────────────────────────────────────────────────

  let version = await db.version.findFirst({ where: { predggId: 'qa-patch-1' } });
  if (!version) {
    version = await db.version.create({
      data: {
        predggId: 'qa-patch-1',
        name: '0.20.0-QA',
        releaseDate: new Date('2025-01-01'),
        patchType: 'MAJOR',
        syncedAt: new Date(),
      },
    });
  }

  // ── Matches ────────────────────────────────────────────────────────────────

  const now = Date.now();
  let matchesCreated = 0;

  for (let i = 0; i < MATCH_COUNT; i++) {
    const matchUuid = `qa-match-${i + 1}-${Date.now()}`;
    const existing = await db.match.findFirst({ where: { predggUuid: { startsWith: `qa-match-${i + 1}-` } } });
    if (existing) continue;

    // Alternating wins: OWN wins 9, RIVAL wins 6
    const ownSide = i % 2 === 0 ? 'DUSK' : 'DAWN';
    const rivalSide = ownSide === 'DUSK' ? 'DAWN' : 'DUSK';
    const ownWins = i < 9; // first 9 matches OWN wins
    const winningTeam = ownWins ? ownSide : rivalSide;

    const duration = rand(1400, 2800); // 23-46 min
    const isRanked = i % 3 !== 0; // 10 ranked, 5 standard
    const startTime = new Date(now - (MATCH_COUNT - i) * 24 * 60 * 60 * 1000); // spread over 15 days

    const match = await db.match.create({
      data: {
        predggUuid: matchUuid,
        startTime,
        duration,
        gameMode: isRanked ? 'RANKED' : 'STANDARD',
        region: 'EU',
        winningTeam,
        versionId: version.id,
        syncedAt: new Date(),
        rosterSynced: true,
        eventStreamSynced: true,
      },
    });

    // ── MatchPlayers ──────────────────────────────────────────────────────

    for (const p of ownPlayers) {
      const heroSlug = pick(HEROES[p.role as keyof typeof HEROES]);
      const kills = rand(0, 12);
      const deaths = rand(0, 8);
      const assists = rand(0, 18);
      const gold = rand(8000, 22000);
      const heroDamage = rand(50000, 250000);
      const minutes = Math.floor(duration / 60);
      const goldInterval = Array.from({ length: minutes }, (_, m) =>
        Math.round(gold * ((m + 1) / minutes) + rand(-500, 500))
      );

      await db.matchPlayer.create({
        data: {
          matchId: match.id,
          playerId: p.id,
          predggPlayerUuid: `qa-own-${p.role}-uuid`,
          playerName: `QA-own-${p.role}`,
          team: ownSide,
          role: p.role,
          heroSlug,
          kills,
          deaths,
          assists,
          heroDamage,
          totalDamage: Math.round(heroDamage * 1.2),
          gold,
          wardsPlaced: rand(2, 12),
          wardsDestroyed: rand(0, 6),
          level: rand(18, 25),
          laneMinionsKilled: p.role === 'carry' || p.role === 'midlane' ? rand(80, 180) : rand(10, 50),
          goldSpent: Math.round(gold * 0.92),
          inventoryItems: [],
          goldEarnedAtInterval: goldInterval,
        },
      }).catch(() => null); // skip if unique constraint fails
    }

    for (const p of rivalPlayers) {
      const heroSlug = pick(HEROES[p.role as keyof typeof HEROES]);
      const kills = rand(0, 10);
      const deaths = rand(0, 10);
      const assists = rand(0, 15);
      const gold = rand(7000, 20000);
      const heroDamage = rand(40000, 220000);

      await db.matchPlayer.create({
        data: {
          matchId: match.id,
          playerId: p.id,
          predggPlayerUuid: `qa-rival-${p.role}-uuid`,
          playerName: `QA-rival-${p.role}`,
          team: rivalSide,
          role: p.role,
          heroSlug,
          kills,
          deaths,
          assists,
          heroDamage,
          totalDamage: Math.round(heroDamage * 1.2),
          gold,
          wardsPlaced: rand(1, 10),
          wardsDestroyed: rand(0, 5),
          level: rand(17, 24),
          laneMinionsKilled: p.role === 'carry' || p.role === 'midlane' ? rand(70, 170) : rand(8, 45),
          goldSpent: Math.round(gold * 0.9),
          inventoryItems: [],
        },
      }).catch(() => null);
    }

    // ── HeroKills ─────────────────────────────────────────────────────────

    const killCount = rand(18, 35);
    for (let k = 0; k < killCount; k++) {
      const killerIsOwn = Math.random() > 0.45;
      const killerTeam = killerIsOwn ? ownSide : rivalSide;
      const killedTeam = killerIsOwn ? rivalSide : ownSide;
      const killerPlayer = killerIsOwn ? pick(ownPlayers) : pick(rivalPlayers);
      const killedPlayer = killerIsOwn ? pick(rivalPlayers) : pick(ownPlayers);
      const gameTime = rand(60, duration - 30);

      await db.heroKill.create({
        data: {
          id: cuid(),
          matchId: match.id,
          gameTime,
          killerTeam,
          killedTeam,
          killerHeroSlug: pick(HEROES[killerPlayer.role as keyof typeof HEROES]),
          killedHeroSlug: pick(HEROES[killedPlayer.role as keyof typeof HEROES]),
          killerPlayerId: killerPlayer.id,
          killedPlayerId: killedPlayer.id,
          locationX: rand(-8000, 8000),
          locationY: rand(-8000, 8000),
          locationZ: 0,
        },
      });
    }

    // ── ObjectiveKills ────────────────────────────────────────────────────

    const objTimings = [300, 480, 660, 840, 1020, 1200, 1380, 1560].filter((t) => t < duration);
    for (const baseTime of objTimings.slice(0, rand(3, 6))) {
      const ownTakes = Math.random() > 0.4;
      const killerTeam = ownTakes ? ownSide : rivalSide;
      const killerPlayer = ownTakes ? pick(ownPlayers) : pick(rivalPlayers);
      const entityType = pick(OBJECTIVES);

      await db.objectiveKill.create({
        data: {
          id: cuid(),
          matchId: match.id,
          gameTime: baseTime + rand(-30, 30),
          entityType,
          killerTeam,
          killerPlayerId: killerPlayer.id,
          locationX: rand(-3000, 3000),
          locationY: rand(-3000, 3000),
          locationZ: 0,
        },
      });
    }

    // ── StructureDestructions ─────────────────────────────────────────────

    const structureTimings = [600, 900, 1200, 1500, 1800].filter((t) => t < duration);
    for (const baseTime of structureTimings.slice(0, rand(2, 4))) {
      const destroyerIsOwn = ownWins ? Math.random() > 0.35 : Math.random() > 0.65;
      const destructionTeam = destroyerIsOwn ? ownSide : rivalSide;

      await db.structureDestruction.create({
        data: {
          id: cuid(),
          matchId: match.id,
          gameTime: baseTime + rand(-60, 60),
          structureType: pick(STRUCTURE_TYPES),
          destructionTeam,
          locationX: rand(-5000, 5000),
          locationY: rand(-5000, 5000),
          locationZ: 0,
        },
      });
    }

    // ── WardEvents ────────────────────────────────────────────────────────

    const wardTypes = ['STEALTH', 'ORACLE', 'SENTRY', 'SONAR_DRONE'];
    const wardCount = rand(20, 40);
    for (let w = 0; w < wardCount; w++) {
      const isOwn = Math.random() > 0.5;
      const team = isOwn ? ownSide : rivalSide;
      const player = isOwn ? pick(ownPlayers) : pick(rivalPlayers);
      const placementTime = rand(60, duration - 60);

      await db.wardEvent.create({
        data: {
          id: cuid(),
          matchId: match.id,
          gameTime: placementTime,
          eventType: 'PLACEMENT',
          wardType: pick(wardTypes),
          team,
          playerId: player.id,
          locationX: rand(-8000, 8000),
          locationY: rand(-8000, 8000),
          locationZ: 0,
        },
      });

      // ~60% of wards get destroyed
      if (Math.random() > 0.4) {
        const destroyerIsOwn = !isOwn;
        const destroyerPlayer = destroyerIsOwn ? pick(ownPlayers) : pick(rivalPlayers);
        await db.wardEvent.create({
          data: {
            id: cuid(),
            matchId: match.id,
            gameTime: placementTime + rand(30, 300),
            eventType: 'DESTRUCTION',
            wardType: pick(wardTypes),
            team: destroyerIsOwn ? ownSide : rivalSide,
            playerId: destroyerPlayer.id,
            locationX: rand(-8000, 8000),
            locationY: rand(-8000, 8000),
            locationZ: 0,
          },
        });
      }
    }

    // ── HeroBans (RANKED only) ────────────────────────────────────────────

    if (isRanked) {
      const allHeroes = Object.values(HEROES).flat();
      const banned = new Set<string>();
      for (const side of [ownSide, rivalSide]) {
        for (let b = 0; b < 3; b++) {
          let heroSlug = pick(allHeroes);
          while (banned.has(heroSlug)) heroSlug = pick(allHeroes);
          banned.add(heroSlug);
          await db.heroBan.create({
            data: { id: cuid(), matchId: match.id, heroSlug, team: side },
          });
        }
      }
    }

    matchesCreated++;
  }

  console.log(`  ✓ ${matchesCreated} partidas generadas (${MATCH_COUNT - matchesCreated} ya existían)`);
  console.log('');
  console.log('✅ Datos QA listos. Para borrarlos: npx tsx scripts/seed-qa.ts --clean');
  console.log('');
  console.log('📋 Resumen:');
  console.log(`   Equipo OWN:   ${OWN_TEAM_NAME}`);
  console.log(`   Equipo RIVAL: ${RIVAL_TEAM_NAME}`);
  console.log(`   Partidas:     ${MATCH_COUNT} (${MATCH_COUNT - Math.floor(MATCH_COUNT / 3)} RANKED, ${Math.floor(MATCH_COUNT / 3)} STANDARD)`);
  console.log(`   Wins OWN:     9 / Losses: 6`);
  console.log('');
  console.log('💡 Tabs disponibles: Team Analysis · Phase Analysis · Vision Analysis');
  console.log('                     Objective Analysis · Draft Analysis · Scrim Report');
}

// ── Main ──────────────────────────────────────────────────────────────────────

const isClean = process.argv.includes('--clean');

(isClean ? clean() : seed())
  .catch((err) => { console.error('❌ Error:', err); process.exit(1); })
  .finally(() => db.$disconnect());
