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

/** League goals that put you in the golden-boot conversation. */
export function goldenBootTarget(league: string): number {
  if (league === 'Premier League') return 25;
  if (ELITE_LEAGUES.has(league)) return 16;
  return 20;
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
 * Chance of winning the golden boot once the target is hit.
 * Premier League: 25 is a medium-chance contender; 30 is likely; 31+ likelier.
 * Other leagues: hitting the bar is a coin-flip, then each extra goal helps.
 */
export function goldenBootWinChance(leagueGoals: number, target: number, league?: string): number {
  if (leagueGoals < target) return 0;
  if (league === 'Premier League') {
    if (leagueGoals <= 25) return 0.48;
    if (leagueGoals === 26) return 0.56;
    if (leagueGoals === 27) return 0.64;
    if (leagueGoals === 28) return 0.72;
    if (leagueGoals === 29) return 0.78;
    if (leagueGoals === 30) return 0.86;
    if (leagueGoals === 31) return 0.92;
    return Math.min(0.97, 0.92 + (leagueGoals - 31) * 0.015);
  }
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
  const chance = goldenBootWinChance(leagueGoals, target, league);
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
