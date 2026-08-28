import { createAvailability } from './availabilityEngine';
import { confederationForCountry, type Confederation } from './data/competitions';
import type { ClubTier } from './data/clubs';
import type { AvailabilityState } from './types';

export interface Nation {
  id: string;
  name: string;
  confederation: Confederation;
}

/** One nation per country already represented in the club pyramid, so a
 * fresh save always has a real choice - add more nations here freely, since
 * nationality is independent of which club a player signs for. */
export const NATIONS: Nation[] = [
  { id: 'england', name: 'England', confederation: confederationForCountry('England') },
  { id: 'spain', name: 'Spain', confederation: confederationForCountry('Spain') },
  { id: 'italy', name: 'Italy', confederation: confederationForCountry('Italy') },
  { id: 'germany', name: 'Germany', confederation: confederationForCountry('Germany') },
  { id: 'france', name: 'France', confederation: confederationForCountry('France') },
  { id: 'saudi-arabia', name: 'Saudi Arabia', confederation: confederationForCountry('Saudi Arabia') },
  { id: 'united-states', name: 'United States', confederation: confederationForCountry('United States') },
];

export function getNation(id: string): Nation | undefined {
  return NATIONS.find((n) => n.id === id);
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

/** Threshold goal ratio needed to be picked, indexed by club tier (1 = elite
 * down to 5 = smallest) - index 0 is unused padding so `tier` can index
 * directly. Bigger clubs put a player in front of more selectors, so a
 * lower ratio there still gets you picked over the same ratio at a tiny
 * club. */
export const SELECTION_RATIO_BY_TIER: readonly number[] = [0, 0.3, 0.35, 0.42, 0.5, 0.6];

export function selectionRatioForTier(clubTier: ClubTier): number {
  return SELECTION_RATIO_BY_TIER[clubTier];
}

/**
 * Whether the player earns international selection this season, based on
 * their club level and the goal ratio they posted there. A real (if simple)
 * heuristic that the season 2-20 engine calls whenever national squads are
 * picked; TODO(season 2-20): wire this into an actual squad-selection +
 * fixture list once international matches join the calendar.
 */
export function isSelectedForNationalTeam(clubTier: ClubTier, seasonGoalRatio: number): boolean {
  return seasonGoalRatio >= SELECTION_RATIO_BY_TIER[clubTier];
}
