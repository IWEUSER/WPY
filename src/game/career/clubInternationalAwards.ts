import type { ContinentalCupId } from './data/competitions';
import type { ContinentalSeasonStat, SeasonRecord } from './types';

/** Goals per continental game required, on top of winning the tournament. */
export const CLUB_POT_MIN_RATIO = 0.7;

export interface ClubInternationalAwardResult {
  won: boolean;
  reason: string;
}

function statsForCup(
  rows: ContinentalSeasonStat[] | undefined,
  cup: ContinentalCupId | null | undefined,
): { games: number; goals: number } {
  if (!cup) return { games: 0, goals: 0 };
  const row = (rows ?? []).find((item) => item.cup === cup);
  return { games: row?.games ?? 0, goals: row?.goals ?? 0 };
}

/**
 * Club Player of the Tournament is a hard rule: win that continental cup
 * this season and score at least 0.7 goals per game in it. No roll.
 */
export function evaluateClubPlayerOfTheTournament(params: {
  continentalChampion: ContinentalCupId | null | undefined;
  continentalStats?: ContinentalSeasonStat[];
}): ClubInternationalAwardResult {
  const cup = params.continentalChampion ?? null;
  if (!cup) {
    return { won: false, reason: 'Win the continental tournament to be eligible.' };
  }
  const { games, goals } = statsForCup(params.continentalStats, cup);
  if (games <= 0) {
    return { won: false, reason: 'No continental appearances in the tournament you won.' };
  }
  const ratio = goals / games;
  if (ratio < CLUB_POT_MIN_RATIO) {
    return {
      won: false,
      reason: `Need ${CLUB_POT_MIN_RATIO.toFixed(1)} goals per game in the tournament — scored ${ratio.toFixed(2)}.`,
    };
  }
  return {
    won: true,
    reason: `Won the tournament and scored ${ratio.toFixed(2)} goals per game.`,
  };
}

export function clubPlayerOfTheTournamentFromSeason(
  season: Pick<SeasonRecord, 'continentalStats'>,
  continentalChampion: ContinentalCupId | null | undefined,
): ClubInternationalAwardResult {
  return evaluateClubPlayerOfTheTournament({
    continentalChampion,
    continentalStats: season.continentalStats,
  });
}
