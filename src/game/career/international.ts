import { createAvailability } from './availabilityEngine';
import type { Confederation, InternationalTournamentId } from './data/competitions';
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

export interface InternationalCompetitionRecord {
  tournament: InternationalTournamentId;
  qualifyingGames: number;
  qualifyingGoals: number;
  finalsGames: number;
  finalsGoals: number;
}

export interface NationalTeamState {
  nationId: string;
  availability: AvailabilityState;
  caps: number;
  goals: number;
  byCompetition: InternationalCompetitionRecord[];
}

export function createNationalTeamState(nationId: string): NationalTeamState {
  return { nationId, availability: createAvailability(), caps: 0, goals: 0, byCompetition: [] };
}

export function emptyCompetitionRecord(
  tournament: InternationalCompetitionRecord['tournament'],
): InternationalCompetitionRecord {
  return { tournament, qualifyingGames: 0, qualifyingGoals: 0, finalsGames: 0, finalsGoals: 0 };
}

export function recordInternationalAppearance(
  team: NationalTeamState,
  tournament: InternationalCompetitionRecord['tournament'] | null,
  isQualifier: boolean,
  goals: number,
): NationalTeamState {
  if (!tournament) {
    return { ...team, caps: team.caps + 1, goals: team.goals + goals };
  }
  const existing = team.byCompetition.find((row) => row.tournament === tournament);
  const row = existing ? { ...existing } : emptyCompetitionRecord(tournament);
  if (isQualifier) {
    row.qualifyingGames += 1;
    row.qualifyingGoals += goals;
  } else {
    row.finalsGames += 1;
    row.finalsGoals += goals;
  }
  const byCompetition = existing
    ? team.byCompetition.map((r) => (r.tournament === tournament ? row : r))
    : [...team.byCompetition, row];
  return { ...team, caps: team.caps + 1, goals: team.goals + goals, byCompetition };
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
 * Call-up uses this season's goals-per-game, not the career average.
 * Lower-league clubs are never selected.
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

/** Current-season ratio. Zero games means not in form for a call-up yet. */
export function seasonRatioForSelection(season: { goals: number; gamesPlayed: number } | null): number {
  if (!season || season.gamesPlayed <= 0) return 0;
  return season.goals / season.gamesPlayed;
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
