import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';
import { getTeamProfile, getTeamRivalScouting as getRivalScoutingReport } from './team-service.js';
import { getPlayerProfile } from './player-service.js';
import { logger } from '../logger.js';

export interface ScrimReport {
  generatedAt: Date;
  ownTeam: {
    name: string;
    roster: Array<{
      displayName: string;
      role: string | null;
      rankLabel: string | null;
      topHeroes: Array<{ slug: string; wins: number; losses: number }>;
    }>;
  };
  rivalTeam: {
    name: string;
    roster: Array<{
      displayName: string;
      role: string | null;
      rankLabel: string | null;
      topHeroes: Array<{ slug: string; wins: number; losses: number }>;
    }>;
  };
  // displayName in roster entries already reflects customName ?? displayName resolution
  matchupNotes: string[];
}

function extractTopHeroes(heroStats: unknown[]): Array<{ slug: string; wins: number; losses: number }> {
  if (!Array.isArray(heroStats)) return [];

  return (heroStats as Array<Record<string, unknown>>)
    .filter((h) => h && typeof h === 'object')
    .map((h) => ({
      slug: String((h.heroData as Record<string, unknown>)?.slug ?? h.slug ?? 'unknown'),
      wins: Number(h.wins ?? 0),
      losses: Number(h.losses ?? 0),
    }))
    .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))
    .slice(0, 5);
}

export async function generateScrimReport(
  ownTeamId: string,
  rivalTeamId: string,
): Promise<ScrimReport> {
  const [ownTeam, rivalTeam] = await Promise.all([
    getTeamProfile(ownTeamId),
    getTeamProfile(rivalTeamId),
  ]);

  // Build roster detail with top heroes
  async function buildRosterDetail(teamProfile: typeof ownTeam) {
    const details = await Promise.all(
      teamProfile.roster.map(async (member) => {
        let topHeroes: Array<{ slug: string; wins: number; losses: number }> = [];
        try {
          const profile = await getPlayerProfile(member.playerId);
          topHeroes = extractTopHeroes(profile.heroStats);
        } catch (err) {
          logger.warn({ playerId: member.playerId, err }, 'player profile unavailable for report');
        }

        return {
          displayName: member.customName ?? member.displayName,
          role: member.role,
          rankLabel: member.rating?.rankLabel ?? null,
          topHeroes,
        };
      }),
    );
    return details;
  }

  const [ownRoster, rivalRoster, rivalScouting] = await Promise.all([
    buildRosterDetail(ownTeam),
    buildRosterDetail(rivalTeam),
    getRivalScoutingReport(rivalTeamId).catch(() => null),
  ]);

  // Generate matchup notes based on available data
  const matchupNotes: string[] = [];

  // ── KDA comparison ────────────────────────────────────────────────────────
  const ownAvgRating = ownTeam.aggregateStats.averageKDA;
  const rivalAvgRating = rivalTeam.aggregateStats.averageKDA;
  if (ownAvgRating > 0 && rivalAvgRating > 0) {
    if (ownAvgRating > rivalAvgRating * 1.2) {
      matchupNotes.push(`⚠️ Ventaja de rendimiento individual: nuestro KDA agregado (${ownAvgRating}) supera significativamente al rival (${rivalAvgRating}).`);
    } else if (rivalAvgRating > ownAvgRating * 1.2) {
      matchupNotes.push(`⚠️ El rival tiene un KDA agregado superior (${rivalAvgRating} vs ${ownAvgRating}). Anticipar mayor presión individual en cada partida.`);
    } else {
      matchupNotes.push(`💡 KDA similar entre ambos equipos (${ownAvgRating} vs ${rivalAvgRating}). El resultado dependerá de las decisiones macro.`);
    }
  }

  // ── Scouting-based notes ──────────────────────────────────────────────────
  if (rivalScouting) {
    // Throw pattern
    if (rivalScouting.throwRate !== null && rivalScouting.throwRate > 20) {
      matchupNotes.push(`💡 El rival tiene un throw rate del ${rivalScouting.throwRate}% — tiende a perder ventajas de oro. Aguantar y presionar en el late game.`);
    }

    // Weak phase
    if (rivalScouting.weakPhase) {
      const phaseLabel: Record<string, string> = { early: 'early game', mid: 'mid game', late: 'late game' };
      matchupNotes.push(`🎯 Fase débil rival: ${phaseLabel[rivalScouting.weakPhase] ?? rivalScouting.weakPhase}. Diseñar el draft para presionar en esa ventana temporal.`);
    }

    // Weak role
    if (rivalScouting.weakRole) {
      matchupNotes.push(`🎯 Rol rival más explotable: ${rivalScouting.weakRole}. Dirigir la presión hacia ese carril en la fase inicial.`);
    }

    // Dominant identity
    const topIdentity = rivalScouting.identity.slice(0, 2);
    if (topIdentity.length > 0) {
      matchupNotes.push(`⚠️ Identidad rival: ${topIdentity.map(i => i.label).join(' + ')}. Adaptar el draft para contrarrestar este estilo.`);
    }

    // Objective dominance
    const dominantObj = rivalScouting.objectivePriority.find(o => o.controlPct >= 65);
    if (dominantObj) {
      matchupNotes.push(`⚠️ El rival domina ${dominantObj.entityType.replace('_', ' ')} (${dominantObj.controlPct}% de control). Priorizar ese objetivo o evitar contestarlo sin ventaja.`);
    }
  }

  // ── Ban targets from hero pool ────────────────────────────────────────────
  const rivalHeroCounts = new Map<string, number>();
  for (const member of rivalRoster) {
    for (const hero of member.topHeroes.slice(0, 3)) {
      rivalHeroCounts.set(hero.slug, (rivalHeroCounts.get(hero.slug) ?? 0) + (hero.wins + hero.losses));
    }
  }
  const topBanTargets = Array.from(rivalHeroCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([slug]) => slug);
  if (topBanTargets.length > 0) {
    matchupNotes.push(`🎯 Bans recomendados por comfort picks rivales: ${topBanTargets.join(', ')}.`);
  }

  // ── One-tricks ────────────────────────────────────────────────────────────
  for (const member of rivalRoster) {
    if (member.topHeroes.length > 0) {
      const totalGames = member.topHeroes.reduce((sum, h) => sum + h.wins + h.losses, 0);
      const topHeroGames = member.topHeroes[0].wins + member.topHeroes[0].losses;
      if (totalGames >= 5 && topHeroGames / totalGames > 0.5) {
        matchupNotes.push(`🎯 ${member.displayName} juega ${member.topHeroes[0].slug} en el ${Math.round(topHeroGames / totalGames * 100)}% de sus partidas — one-trick potencial. Ban prioritario.`);
      }
    }
  }

  return {
    generatedAt: new Date(),
    ownTeam: { name: ownTeam.name, roster: ownRoster },
    rivalTeam: { name: rivalTeam.name, roster: rivalRoster },
    matchupNotes,
  };
}
