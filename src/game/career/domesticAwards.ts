/**
 * Domestic individual awards: the league's top goalscorer (golden boot) and
 * Player of the Year. Neither is a lock from a single rule — both roll a
 * chance table. Golden boot starts at 25 league goals in every league.
 * Player of the Year requires the league title. A golden boot from mid-table
 * is never enough.
 */

import { leagueDisplayName } from './data/leagueFormat';

export const GOLDEN_BOOT_MIN_GOALS = 25;

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
 * 25 → 20%, then +8% for every extra league goal, capped at 99%.
 */
export function goldenBootWinChance(leagueGoals: number, _target?: number, _league?: string): number {
  if (leagueGoals < GOLDEN_BOOT_MIN_GOALS) return 0;
  return Math.min(0.99, 0.2 + (leagueGoals - GOLDEN_BOOT_MIN_GOALS) * 0.08);
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
      reason: `${leagueGoals} league goal${leagueGoals === 1 ? '' : 's'} in ${leagueDisplayName(league)}.`,
    };
  }
  const won = rng() < chance;
  return {
    won,
    reason: won
      ? `Won the ${leagueDisplayName(league)} golden boot with ${leagueGoals} league goals.`
      : `${leagueGoals} league goals in ${leagueDisplayName(league)}, but another striker took the golden boot.`,
  };
}

/**
 * Chance of Player of the Year. The title is required — a golden boot from
 * 15th is never enough. Title plus top scorer is the usual path; a champion
 * who was not top scorer still has a small chance once they hit 25 goals.
 */
export function playerOfTheYearWinChance(params: {
  leagueChampion: boolean;
  topGoalscorer: boolean;
  leagueGoals: number;
}): number {
  const { leagueChampion, topGoalscorer, leagueGoals } = params;
  if (!leagueChampion) return 0;
  if (leagueGoals >= 40 && topGoalscorer) return 1;
  const boot = goldenBootWinChance(leagueGoals);
  if (topGoalscorer) return Math.min(0.92, 0.55 + boot * 0.4);
  if (boot > 0) return Math.min(0.28, 0.08 + boot * 0.2);
  return 0;
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
      reason: `${leagueGoals} league goal${leagueGoals === 1 ? '' : 's'} in ${leagueDisplayName(league)}.`,
    };
  }
  const won = rng() < chance;
  return {
    won,
    reason: won
      ? `Won ${leagueDisplayName(league)} Player of the Year with ${leagueGoals} league goals.`
      : `${leagueGoals} league goals in ${leagueDisplayName(league)}, but another player took Player of the Year.`,
  };
}
