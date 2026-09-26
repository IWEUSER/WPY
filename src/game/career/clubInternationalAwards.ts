import type { ContinentalCupId } from './data/competitions';
import type { ContinentalSeasonStat, SeasonRecord } from './types';

/** Goals per continental game required, on top of winning the tournament. */
export const CLUB_POT_MIN_RATIO = 0.7;
/** Champions League Player of the Tournament without needing the title. */
export const CL_POT_GOALS_WITHOUT_TITLE = 16;
/** Champions League golden boot threshold when NPC scorers are not simulated. */
export const CL_TOP_SCORER_MIN_GOALS = 10;

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
 * Club Player of the Tournament: win that cup at ≥ 0.7 goals per game, or
 * score 16+ Champions League goals regardless of who lifts the trophy.
 */
export function evaluateClubPlayerOfTheTournament(params: {
  continentalChampion: ContinentalCupId | null | undefined;
  continentalStats?: ContinentalSeasonStat[];
}): ClubInternationalAwardResult {
  const ucl = statsForCup(params.continentalStats, 'ucl');
  if (ucl.goals >= CL_POT_GOALS_WITHOUT_TITLE) {
    return {
      won: true,
      reason: `Scored ${ucl.goals} Champions League goals.`,
    };
  }
  const cup = params.continentalChampion ?? null;
  if (!cup) {
    return { won: false, reason: '' };
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

export function evaluateContinentalTopGoalscorer(params: {
  continentalStats?: ContinentalSeasonStat[];
}): boolean {
  return statsForCup(params.continentalStats, 'ucl').goals >= CL_TOP_SCORER_MIN_GOALS;
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
