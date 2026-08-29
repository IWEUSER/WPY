/**
 * Domestic individual awards: the league's top goalscorer (golden boot) and
 * Player of the Year. Golden-boot targets are per league so a 24-game season
 * has a realistic scoring bar; meeting that bar is not a lock because a
 * randomiser stands in for the rest of the league. Player of the Year is
 * closer to the WPY rule: win the league, then clear a lower goal bar.
 */

const ELITE_LEAGUES = new Set([
  'Premier League',
  'La Liga',
  'Serie A',
  'Bundesliga',
  'Ligue 1',
]);

const SECOND_TIER_LEAGUES = new Set([
  'Championship',
  'La Liga 2',
  'Serie B',
  '2. Bundesliga',
  'Ligue 2',
]);

/** League goals that put you in the golden-boot conversation over 24 games. */
export function goldenBootTarget(league: string): number {
  if (ELITE_LEAGUES.has(league)) return 16;
  if (SECOND_TIER_LEAGUES.has(league)) return 13;
  return 14;
}

/**
 * Player of the Year needs the title plus a high — but not golden-boot —
 * league tally. High scorers who also won the league should get this.
 */
export function playerOfTheYearGoalTarget(league: string): number {
  return Math.ceil(goldenBootTarget(league) * 0.7);
}

export interface AwardResult {
  won: boolean;
  reason: string;
}

/**
 * Chance of winning the golden boot once the target is hit. Exact target is
 * only a coin-flip; each extra league goal helps, but it never becomes a lock.
 */
export function goldenBootWinChance(leagueGoals: number, target: number): number {
  if (leagueGoals < target) return 0;
  return Math.min(0.88, 0.5 + (leagueGoals - target) * 0.08);
}

export function evaluateTopGoalscorer(
  leagueGoals: number,
  league: string,
  rng: () => number = Math.random,
): AwardResult {
  const target = goldenBootTarget(league);
  if (leagueGoals < target) {
    return {
      won: false,
      reason: `Golden boot target in ${league} is ${target} league goals; you scored ${leagueGoals}.`,
    };
  }
  const chance = goldenBootWinChance(leagueGoals, target);
  const won = rng() < chance;
  return {
    won,
    reason: won
      ? `Won the ${league} golden boot with ${leagueGoals} league goals (target ${target}).`
      : `${leagueGoals} league goals met the ${target}-goal bar, but another striker took the golden boot.`,
  };
}

export function evaluatePlayerOfTheYear(params: {
  leagueChampion: boolean;
  leagueGoals: number;
  league: string;
}): AwardResult {
  const { leagueChampion, leagueGoals, league } = params;
  const bar = playerOfTheYearGoalTarget(league);
  if (!leagueChampion) {
    return {
      won: false,
      reason: `Player of the Year requires winning ${league}.`,
    };
  }
  if (leagueGoals < bar) {
    return {
      won: false,
      reason: `Won ${league}, but Player of the Year needs ${bar} league goals (you scored ${leagueGoals}).`,
    };
  }
  return {
    won: true,
    reason: `Won ${league} and scored ${leagueGoals} league goals (bar ${bar}).`,
  };
}
