/**
 * Domestic individual awards: the league's top goalscorer (golden boot) and
 * Player of the Year. Neither is a lock from a single rule — both roll a
 * chance table. Golden boot starts at 20 league goals in every league.
 * Player of the Year can still go to a top scorer who did not win the title.
 */

export const GOLDEN_BOOT_MIN_GOALS = 20;

/** League goals that put you in the golden-boot conversation. Same in every league. */
export function goldenBootTarget(_league?: string): number {
  return GOLDEN_BOOT_MIN_GOALS;
}

/**
 * @deprecated POTY no longer uses a published goal bar. Kept so older tests compile.
 */
export function playerOfTheYearGoalTarget(_league?: string): number {
  return GOLDEN_BOOT_MIN_GOALS;
}

export interface AwardResult {
  won: boolean;
  reason: string;
}

/**
 * 20 → 20%, 21 → 25%, 22 → 30%, 23 → 40%, 24 → 50%, 25 → 60%,
 * 26 → 70%, 27 → 80%, 28 → 90%, 29 → 95%, 30+ → 99%.
 */
export function goldenBootWinChance(leagueGoals: number, _target?: number, _league?: string): number {
  if (leagueGoals < GOLDEN_BOOT_MIN_GOALS) return 0;
  if (leagueGoals >= 30) return 0.99;
  const table: Record<number, number> = {
    20: 0.2,
    21: 0.25,
    22: 0.3,
    23: 0.4,
    24: 0.5,
    25: 0.6,
    26: 0.7,
    27: 0.8,
    28: 0.9,
    29: 0.95,
  };
  return table[leagueGoals] ?? 0;
}

export function evaluateTopGoalscorer(
  leagueGoals: number,
  league: string,
  rng: () => number = Math.random,
): AwardResult {
  const chance = goldenBootWinChance(leagueGoals);
  if (chance <= 0) {
    return {
      won: false,
      reason: `${leagueGoals} league goal${leagueGoals === 1 ? '' : 's'} in ${league}.`,
    };
  }
  const won = rng() < chance;
  return {
    won,
    reason: won
      ? `Won the ${league} golden boot with ${leagueGoals} league goals.`
      : `${leagueGoals} league goals in ${league}, but another striker took the golden boot.`,
  };
}

/**
 * Chance of Player of the Year. Title winners are favoured, but a golden-boot
 * winner who did not take the league still has a real shot. Never a hard rule
 * like "must win the league".
 */
export function playerOfTheYearWinChance(params: {
  leagueChampion: boolean;
  topGoalscorer: boolean;
  leagueGoals: number;
}): number {
  const { leagueChampion, topGoalscorer, leagueGoals } = params;
  const boot = goldenBootWinChance(leagueGoals);
  let chance = 0;
  if (topGoalscorer) {
    chance = Math.max(chance, leagueChampion ? Math.min(0.92, 0.55 + boot * 0.4) : Math.min(0.72, 0.28 + boot * 0.45));
  }
  if (leagueChampion && boot > 0) {
    chance = Math.max(chance, 0.32 + boot * 0.5);
  }
  if (!leagueChampion && !topGoalscorer && boot > 0) {
    chance = Math.max(chance, boot * 0.35);
  }
  return Math.min(0.95, chance);
}

export function evaluatePlayerOfTheYear(params: {
  leagueChampion: boolean;
  leagueGoals: number;
  league: string;
  topGoalscorer?: boolean;
  rng?: () => number;
}): AwardResult {
  const { leagueChampion, leagueGoals, league, topGoalscorer = false, rng = Math.random } = params;
  const chance = playerOfTheYearWinChance({ leagueChampion, topGoalscorer, leagueGoals });
  if (chance <= 0) {
    return {
      won: false,
      reason: `${leagueGoals} league goal${leagueGoals === 1 ? '' : 's'} in ${league}.`,
    };
  }
  const won = rng() < chance;
  return {
    won,
    reason: won
      ? `Won ${league} Player of the Year with ${leagueGoals} league goals.`
      : `${leagueGoals} league goals in ${league}, but another player took Player of the Year.`,
  };
}
