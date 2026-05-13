/**
 * QA Seed Script — genera datos sintéticos realistas para probar todas las tabs
 * de Team Analysis (Phase, Vision, Objective, Draft).
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
const MATCH_COUNT = 20; // más partidas = mejor muestra estadística

// Héroes por rol: índice 0 = principal (16+ partidas), índice 1 = alternativo (4+ partidas)
// Los héroes alternnativos se comparten entre roles para generar Hero Overlap:
//   drongo (carry alt) ← compartido con offlane alt
//   zinx (midlane main) ← compartido con carry main … no
// Solapamientos intencionados:
//   'serath'  → carry alt + offlane alt  (overlap entre 2 jugadores)
//   'wraith'  → jungle main + support alt (overlap entre 2 jugadores)
const OWN_HEROES: Record<string, string[]> = {
  carry:   ['drongo', 'serath'],   // serath compartido con offlane
  jungle:  ['wraith', 'gadget'],
  midlane: ['zinx', 'murdock'],
  offlane: ['countess', 'serath'], // serath compartido con carry
  support: ['feng-mao', 'wraith'], // wraith compartido con jungle
};

const RIVAL_HEROES: Record<string, string> = {
  carry:   'gadget',
  jungle:  'grux',
  midlane: 'murdock',
  offlane: 'gideon',
  support: 'belica',
};

// Héroes de ban — pool más amplio para variedad
const BAN_HEROES = ['serath', 'sparrow', 'phase', 'rampage', 'aurora', 'yin', 'zarus', 'howitzer', 'crunch', 'steel'];

const ROLES = ['carry', 'jungle', 'midlane', 'offlane', 'support'] as const;

// Objetivos que SÍ reconoce getTeamVisionAnalysis y getTeamObjectiveAnalysis
const MAJOR_OBJECTIVES = ['FANGTOOTH', 'ORB_PRIME'] as const;

// Ubicaciones aproximadas de objetivos en el mapa (coordenadas del juego)
const OBJECTIVE_LOCATIONS: Record<string, { x: number; y: number }> = {
  FANGTOOTH: { x: 0, y: 3500 },
  ORB_PRIME: { x: 0, y: -3500 },
};

// Tipos de estructura en orden progresivo
const STRUCTURE_SEQUENCE = ['OUTER_TOWER', 'OUTER_TOWER', 'INNER_TOWER', 'INHIBITOR'] as const;

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function cuid() {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

// ── Clean ─────────────────────────────────────────────────────────────────────

async function clean() {
  console.log('🧹 Borrando datos QA...');

  const teams = await db.team.findMany({ where: { name: { startsWith: QA_TAG } } });
  const teamIds = teams.map((t) => t.id);
  const players = await db.player.findMany({ where: { predggId: { startsWith: 'qa-' } } });
  const playerIds = players.map((p) => p.id);

  if (teamIds.length === 0 && playerIds.length === 0) {
    console.log('No hay datos QA que borrar.');
    return;
  }

  const matchPlayers = await db.matchPlayer.findMany({
    where: { playerId: { in: playerIds } },
    select: { matchId: true },
    distinct: ['matchId'],
  });
  const matchIds = matchPlayers.map((mp) => mp.matchId);

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
    await db.teamMembership.deleteMany({ where: { teamId: { in: teamIds } } });
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

  if (!ownTeam) {
    ownTeam = await db.team.create({
      data: { name: OWN_TEAM_NAME, abbreviation: 'QAA', type: 'OWN', region: 'EU' },
    });
  }
  if (!rivalTeam) {
    rivalTeam = await db.team.create({
      data: { name: RIVAL_TEAM_NAME, abbreviation: 'QAB', type: 'RIVAL', region: 'EU' },
    });
  }
  console.log(`  ✓ Equipos: ${OWN_TEAM_NAME} / ${RIVAL_TEAM_NAME}`);

  // ── Players — héroe fijo por rol ───────────────────────────────────────────

  const ownPlayers: { id: string; role: string; heroes: string[] }[] = [];
  const rivalPlayers: { id: string; role: string; heroSlug: string }[] = [];

  for (const role of ROLES) {
    const ownPlayer = await db.player.upsert({
      where: { predggId: `qa-own-${role}` },
      create: { predggId: `qa-own-${role}`, predggUuid: `qa-own-${role}-uuid`, displayName: `${QA_TAG} ${role}-${OWN_HEROES[role][0]}`, lastSynced: new Date() },
      update: {},
    });
    ownPlayers.push({ id: ownPlayer.id, role, heroes: OWN_HEROES[role] });
    const existingOwn = await db.teamRoster.findFirst({ where: { teamId: ownTeam.id, playerId: ownPlayer.id } });
    if (!existingOwn) await db.teamRoster.create({ data: { teamId: ownTeam.id, playerId: ownPlayer.id, role } });

    const rivalPlayer = await db.player.upsert({
      where: { predggId: `qa-rival-${role}` },
      create: { predggId: `qa-rival-${role}`, predggUuid: `qa-rival-${role}-uuid`, displayName: `${QA_TAG} rival-${role}`, lastSynced: new Date() },
      update: {},
    });
    rivalPlayers.push({ id: rivalPlayer.id, role, heroSlug: RIVAL_HEROES[role] });
    const existingRival = await db.teamRoster.findFirst({ where: { teamId: rivalTeam.id, playerId: rivalPlayer.id } });
    if (!existingRival) await db.teamRoster.create({ data: { teamId: rivalTeam.id, playerId: rivalPlayer.id, role } });
  }
  console.log(`  ✓ 10 jugadores con héroes fijos (OWN: ${Object.values(OWN_HEROES).map(h => h[0]).join(', ')})`);

  // ── Version ────────────────────────────────────────────────────────────────

  const version = await db.version.upsert({
    where: { predggId: 'qa-patch-1' },
    create: { predggId: 'qa-patch-1', name: '0.20.0-QA', releaseDate: new Date('2025-01-01'), patchType: 'MAJOR', syncedAt: new Date() },
    update: {},
  });

  // ── Matches ────────────────────────────────────────────────────────────────

  const now = Date.now();
  let matchesCreated = 0;

  for (let i = 0; i < MATCH_COUNT; i++) {
    const matchKey = `qa-match-${i + 1}`;
    const existing = await db.match.findFirst({ where: { predggUuid: { startsWith: matchKey } } });
    if (existing) continue;

    const matchUuid = `${matchKey}-${Date.now()}`;
    const ownSide = i % 2 === 0 ? 'DUSK' : 'DAWN';
    const rivalSide = ownSide === 'DUSK' ? 'DAWN' : 'DUSK';
    // OWN wins 13/20, loses 7/20 — good win rate for interesting analysis
    const ownWins = i < 13;
    const winningTeam = ownWins ? ownSide : rivalSide;
    const duration = rand(1500, 2600);
    const isRanked = i % 4 !== 0; // 15 RANKED, 5 STANDARD
    const startTime = new Date(now - (MATCH_COUNT - i) * 22 * 60 * 60 * 1000);

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

    const minuteDuration = Math.floor(duration / 60);

    for (const p of ownPlayers) {
      const kills = rand(1, 12);
      const deaths = rand(0, 7);
      const assists = rand(2, 18);
      const gold = rand(10000, 22000);
      const heroDamage = rand(60000, 280000);
      // Gold curve: gradual increase with some variance
      const goldInterval = Array.from({ length: minuteDuration }, (_, m) => {
        const progress = (m + 1) / minuteDuration;
        return Math.round(gold * (0.3 + 0.7 * progress) + rand(-800, 800));
      });

      await db.matchPlayer.create({
        data: {
          matchId: match.id,
          playerId: p.id,
          predggPlayerUuid: `qa-own-${p.role}-uuid`,
          playerName: `QA-${p.role}`,
          team: ownSide,
          role: p.role,
          heroSlug: Math.random() > 0.25 ? p.heroes[0] : p.heroes[1], // 75% principal, 25% alternativo → overlap
          kills,
          deaths,
          assists,
          heroDamage,
          totalDamage: Math.round(heroDamage * 1.25),
          gold,
          wardsPlaced: rand(3, 14),
          wardsDestroyed: rand(0, 7),
          level: rand(18, 25),
          laneMinionsKilled: p.role === 'carry' || p.role === 'midlane' ? rand(90, 190) : rand(10, 55),
          goldSpent: Math.round(gold * 0.93),
          inventoryItems: [],
          goldEarnedAtInterval: goldInterval,
        },
      }).catch(() => null);
    }

    for (const p of rivalPlayers) {
      const kills = rand(0, 10);
      const deaths = rand(1, 9);
      const gold = rand(7000, 19000);
      const heroDamage = rand(40000, 230000);

      await db.matchPlayer.create({
        data: {
          matchId: match.id,
          playerId: p.id,
          predggPlayerUuid: `qa-rival-${p.role}-uuid`,
          playerName: `QA-rival-${p.role}`,
          team: rivalSide,
          role: p.role,
          heroSlug: p.heroSlug,
          kills,
          deaths,
          assists: rand(1, 14),
          heroDamage,
          totalDamage: Math.round(heroDamage * 1.2),
          gold,
          wardsPlaced: rand(2, 11),
          wardsDestroyed: rand(0, 5),
          level: rand(17, 24),
          laneMinionsKilled: p.role === 'carry' || p.role === 'midlane' ? rand(70, 170) : rand(8, 45),
          goldSpent: Math.round(gold * 0.9),
          inventoryItems: [],
        },
      }).catch(() => null);
    }

    // ── HeroKills — distribuidos por fases (early/mid/late) ───────────────

    const killCount = rand(22, 40);
    for (let k = 0; k < killCount; k++) {
      const killerIsOwn = ownWins ? Math.random() > 0.38 : Math.random() > 0.62;
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
          killerHeroSlug: killerPlayer.heroSlug,
          killedHeroSlug: killedPlayer.heroSlug,
          killerPlayerId: killerPlayer.id,
          killedPlayerId: killedPlayer.id,
          locationX: rand(-7000, 7000),
          locationY: rand(-7000, 7000),
          locationZ: 0,
        },
      });
    }

    // ── ObjectiveKills — solo FANGTOOTH y ORB_PRIME (MAJOR_OBJECTIVES) ────
    // Spawn times: FANGTOOTH ~5min, ORB_PRIME ~7min, respawn ~4min each

    const objEvents: Array<{ entityType: string; gameTime: number; killerTeam: string; playerId: string; loc: { x: number; y: number } }> = [];

    for (const objType of MAJOR_OBJECTIVES) {
      const loc = OBJECTIVE_LOCATIONS[objType];
      const firstSpawn = objType === 'FANGTOOTH' ? 300 : 420;
      let spawnTime = firstSpawn;

      while (spawnTime < duration - 60) {
        const ownTakes = ownWins ? Math.random() > 0.35 : Math.random() > 0.65;
        const killerTeam = ownTakes ? ownSide : rivalSide;
        const killerPlayer = ownTakes ? pick(ownPlayers) : pick(rivalPlayers);
        const eventTime = spawnTime + rand(0, 60);

        objEvents.push({ entityType: objType, gameTime: eventTime, killerTeam, playerId: killerPlayer.id, loc });

        await db.objectiveKill.create({
          data: {
            id: cuid(),
            matchId: match.id,
            gameTime: eventTime,
            entityType: objType,
            killerTeam,
            killerPlayerId: killerPlayer.id,
            locationX: loc.x + rand(-200, 200),
            locationY: loc.y + rand(-200, 200),
            locationZ: 0,
          },
        });

        spawnTime += objType === 'FANGTOOTH' ? rand(220, 260) : rand(220, 260);
      }
    }

    // ── StructureDestructions — alineadas con objetivos + fase ────────────
    // Fix: estructuras se destruyen 30-90s después de cada objetivo

    // Always at least one OUTER_TOWER in early game
    const destroyerIsOwn = ownWins;
    await db.structureDestruction.create({
      data: {
        id: cuid(),
        matchId: match.id,
        gameTime: rand(420, 600), // 7-10 min: primer tower
        structureType: 'OUTER_TOWER',
        destructionTeam: destroyerIsOwn ? ownSide : rivalSide,
        locationX: rand(-3000, 3000),
        locationY: rand(-3000, 3000),
        locationZ: 0,
      },
    });

    // Additional structures after major objectives
    let structIdx = 1; // start from OUTER_TOWER (already did one)
    for (const obj of objEvents.slice(0, 4)) {
      if (structIdx >= STRUCTURE_SEQUENCE.length) break;
      const destructionTeam = obj.killerTeam; // winner of objective destroys structure
      const structureTime = obj.gameTime + rand(30, 90);
      if (structureTime >= duration) break;

      await db.structureDestruction.create({
        data: {
          id: cuid(),
          matchId: match.id,
          gameTime: structureTime,
          structureType: STRUCTURE_SEQUENCE[structIdx],
          destructionTeam,
          locationX: rand(-4000, 4000),
          locationY: rand(-4000, 4000),
          locationZ: 0,
        },
      });
      structIdx++;
    }

    // ── WardEvents — cerca de objetivos para vision analysis ──────────────
    // Fix: wards colocados cerca de las ubicaciones reales de objetivos

    const wardTypes = ['STEALTH', 'ORACLE', 'SENTRY'];
    const wardCount = rand(25, 45);

    for (let w = 0; w < wardCount; w++) {
      const isOwn = Math.random() > 0.5;
      const team = isOwn ? ownSide : rivalSide;
      const player = isOwn ? pick(ownPlayers) : pick(rivalPlayers);

      // 60% of wards near objectives (within VISION_RADIUS=3000), 40% elsewhere
      const nearObjective = Math.random() > 0.4;
      const objLoc = nearObjective ? OBJECTIVE_LOCATIONS[pick(MAJOR_OBJECTIVES)] : null;
      const x = objLoc ? objLoc.x + rand(-2000, 2000) : rand(-8000, 8000);
      const y = objLoc ? objLoc.y + rand(-2000, 2000) : rand(-8000, 8000);

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
          locationX: x,
          locationY: y,
          locationZ: 0,
        },
      });

      // ~55% of wards get destroyed
      if (Math.random() > 0.45) {
        const destroyerIsOwn2 = !isOwn;
        const destroyerPlayer = destroyerIsOwn2 ? pick(ownPlayers) : pick(rivalPlayers);
        await db.wardEvent.create({
          data: {
            id: cuid(),
            matchId: match.id,
            gameTime: placementTime + rand(20, 240),
            eventType: 'DESTRUCTION',
            wardType: pick(wardTypes),
            team: destroyerIsOwn2 ? ownSide : rivalSide,
            playerId: destroyerPlayer.id,
            locationX: x + rand(-100, 100),
            locationY: y + rand(-100, 100),
            locationZ: 0,
          },
        });
      }
    }

    // ── HeroBans (RANKED only) — pool variado ─────────────────────────────

    if (isRanked) {
      const banned = new Set<string>();
      // Each team bans 3 heroes
      for (const side of [ownSide, rivalSide]) {
        let attempts = 0;
        while (banned.size < (side === ownSide ? 3 : 6) && attempts < 20) {
          const heroSlug = pick(BAN_HEROES);
          if (!banned.has(heroSlug)) {
            banned.add(heroSlug);
            await db.heroBan.create({ data: { id: cuid(), matchId: match.id, heroSlug, team: side } });
          }
          attempts++;
        }
      }
    }

    matchesCreated++;
  }

  const ranked = Math.round(MATCH_COUNT * 0.75);
  const standard = MATCH_COUNT - ranked;
  console.log(`  ✓ ${matchesCreated} partidas generadas (${MATCH_COUNT - matchesCreated} ya existían)`);
  console.log('');
  console.log('✅ Datos QA listos. Para borrarlos: npx tsx scripts/seed-qa.ts --clean');
  console.log('');
  console.log('📋 Resumen:');
  console.log(`   Equipo OWN:   ${OWN_TEAM_NAME} (héroes: ${Object.values(OWN_HEROES).map(h => h[0]).join(', ')})`);
  console.log(`   Equipo RIVAL: ${RIVAL_TEAM_NAME}`);
  console.log(`   Partidas:     ${MATCH_COUNT} (~${ranked} RANKED, ~${standard} STANDARD)`);
  console.log(`   Wins OWN:     13 / Losses: 7 (65% WR)`);
  console.log('');
  console.log('💡 Tabs con datos: Team Analysis · Phase Analysis · Vision Analysis');
  console.log('                   Objective Analysis · Draft Analysis · Scrim Report');
}

// ── Main ──────────────────────────────────────────────────────────────────────

const isClean = process.argv.includes('--clean');

(isClean ? clean() : seed())
  .catch((err) => { console.error('❌ Error:', err); process.exit(1); })
  .finally(() => db.$disconnect());
