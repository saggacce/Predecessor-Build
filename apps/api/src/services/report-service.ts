import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';
import { getTeamProfile } from './team-service.js';
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
          displayName: member.displayName,
          role: member.role,
          rankLabel: member.rating?.rankLabel ?? null,
          topHeroes,
        };
      }),
    );
    return details;
  }

  const [ownRoster, rivalRoster] = await Promise.all([
    buildRosterDetail(ownTeam),
    buildRosterDetail(rivalTeam),
  ]);

  // Generate matchup notes based on available data
  const matchupNotes: string[] = [];

  // Rank comparison
  const ownAvgRating = ownTeam.aggregateStats.averageKDA;
  const rivalAvgRating = rivalTeam.aggregateStats.averageKDA;
  if (ownAvgRating > 0 && rivalAvgRating > 0) {
    if (ownAvgRating > rivalAvgRating * 1.2) {
      matchupNotes.push(`Your team has a significantly higher aggregate KDA (${ownAvgRating} vs ${rivalAvgRating}).`);
    } else if (rivalAvgRating > ownAvgRating * 1.2) {
      matchupNotes.push(`Rival team has a significantly higher aggregate KDA (${rivalAvgRating} vs ${ownAvgRating}). Prepare accordingly.`);
    } else {
      matchupNotes.push(`Both teams have similar aggregate KDA (${ownAvgRating} vs ${rivalAvgRating}). Expect a close match.`);
    }
  }

  // Identify ban targets from rival's top heroes
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
    matchupNotes.push(`Suggested ban targets based on rival comfort picks: ${topBanTargets.join(', ')}.`);
  }

  // Check for one-tricks
  for (const member of rivalRoster) {
    if (member.topHeroes.length > 0) {
      const totalGames = member.topHeroes.reduce((sum, h) => sum + h.wins + h.losses, 0);
      const topHeroGames = member.topHeroes[0].wins + member.topHeroes[0].losses;
      if (totalGames > 0 && topHeroGames / totalGames > 0.5) {
        matchupNotes.push(`${member.displayName} plays ${member.topHeroes[0].slug} in ${Math.round(topHeroGames / totalGames * 100)}% of games — potential one-trick.`);
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
