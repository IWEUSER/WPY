import { createAvailability } from './availabilityEngine';
import type { Confederation } from './data/competitions';
import { clubsInCountry, type ClubTier } from './data/clubs';
import { fifaRank } from './data/fifaRankings';
import { NATIONS, getNation, type Nation } from './data/nations';
import type { AvailabilityState } from './types';

export type { Nation };
export { NATIONS, getNation };

export function nationHasDomesticLeague(nationId: string): boolean {
  const nation = getNation(nationId);
  return Boolean(nation && clubsInCountry(nation.name).length > 0);
}

export interface NationalTeamState {
  nationId: string;
  availability: AvailabilityState;
  caps: number;
  goals: number;
}

export function createNationalTeamState(nationId: string): NationalTeamState {
  return { nationId, availability: createAvailability(), caps: 0, goals: 0 };
}

export function confederationOfNation(nationId: string | null | undefined): Confederation | null {
  if (!nationId) return null;
  return getNation(nationId)?.confederation ?? null;
}

/** Call-ups are only for first-team players at a proper senior club, not the lower pyramid. */
export const MAX_CLUB_TIER_FOR_SELECTION: ClubTier = 3;

/** Top-20 FIFA nations demand a 0.66 career ratio. */
export const TOP_NATION_SELECTION_RATIO = 0.66;

export function selectionRatioForNation(nationId: string): number {
  const rank = fifaRank(nationId);
  if (rank <= 20) return TOP_NATION_SELECTION_RATIO;
  if (rank <= 50) return 0.5;
  return 0.4;
}

/** @deprecated Use selectionRatioForNation — kept so old hub copy can migrate. */
export function selectionRatioForTier(_clubTier: ClubTier): number {
  return TOP_NATION_SELECTION_RATIO;
}

export function clubEligibleForNationalTeam(clubTier: ClubTier): boolean {
  return clubTier <= MAX_CLUB_TIER_FOR_SELECTION;
}

/**
 * Call-up uses the player's first-team career ratio (trial and the reserve
 * year do not count) and the country's FIFA standing. Lower-league clubs
 * are never selected.
 */
export function isSelectedForNationalTeam(params: {
  clubTier: ClubTier;
  careerGoalRatio: number;
  nationId: string | null;
}): boolean {
  if (!params.nationId) return false;
  if (!clubEligibleForNationalTeam(params.clubTier)) return false;
  return params.careerGoalRatio >= selectionRatioForNation(params.nationId);
}

/**
 * Call-up uses first-team career ratio. Before any first-team games exist
 * (the start of internal season 2), fall back to the reserve-year sample.
 */
export function careerRatioForSelection(
  careerGoals: number,
  careerGames: number,
  reserveFallbackRatio: number,
): number {
  if (careerGames > 0) return careerGoals / careerGames;
  return reserveFallbackRatio;
}
