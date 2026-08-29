import { createAvailability } from './availabilityEngine';
import type { Confederation } from './data/competitions';
import { clubsInCountry, goalRatioFromStrength, type ClubTier } from './data/clubs';
import { NATIONS, getNation, type Nation } from './data/nations';
import type { AvailabilityState } from './types';

export type { Nation };
export { NATIONS, getNation };

export function nationHasDomesticLeague(nationId: string): boolean {
  const nation = getNation(nationId);
  return Boolean(nation && clubsInCountry(nation.name).length > 0);
}

/**
 * A player's international career: caps/goals plus its own availability
 * state. Deliberately reuses availabilityEngine's escalating miss-streak
 * rule wholesale (it's already generic, not club-specific) - a scoreless run
 * for the national team drops you from the squad exactly the same way a
 * scoreless run for your club does.
 */
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

/** Threshold goal ratio needed to be picked, indexed by club tier (1 = elite
 * down to 5 = smallest) - index 0 is unused padding so `tier` can index
 * directly. Selectors expect you to be close to the standard of the club
 * you play for, so the bar rises with the pyramid. */
const TYPICAL_STRENGTH_BY_TIER: Record<ClubTier, number> = {
  1: 90,
  2: 81,
  3: 73,
  4: 64,
  5: 52,
};

export const SELECTION_RATIO_BY_TIER: readonly number[] = [
  0,
  goalRatioFromStrength(TYPICAL_STRENGTH_BY_TIER[1]),
  goalRatioFromStrength(TYPICAL_STRENGTH_BY_TIER[2]),
  goalRatioFromStrength(TYPICAL_STRENGTH_BY_TIER[3]),
  goalRatioFromStrength(TYPICAL_STRENGTH_BY_TIER[4]),
  goalRatioFromStrength(TYPICAL_STRENGTH_BY_TIER[5]),
];

export function selectionRatioForTier(clubTier: ClubTier): number {
  return SELECTION_RATIO_BY_TIER[clubTier];
}

/**
 * Whether the player earns international selection this season, based on
 * their club level and the goal ratio they posted there.
 */
export function isSelectedForNationalTeam(clubTier: ClubTier, seasonGoalRatio: number): boolean {
  return seasonGoalRatio >= SELECTION_RATIO_BY_TIER[clubTier];
}
