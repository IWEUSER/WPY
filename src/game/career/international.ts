import { createAvailability } from './availabilityEngine';
import type { Confederation, InternationalTournamentId } from './data/competitions';
import { clubsInCountry, type ClubTier } from './data/clubs';
import { fifaRank } from './data/fifaRankings';
import { NATIONS, getNation, type Nation } from './data/nations';
import { VALUE_FORM_MIN_GAMES } from './playerValue';
import type { AvailabilityState, InternationalSeasonRecord } from './types';

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
  /** Qualifier opponents faced recently — avoid redrawing them while the pool lasts. */
  recentQualifierOpponentIds?: string[];
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
 * Call-up uses the ratio passed in (career until this season has a real
 * sample, then this season). Lower-league clubs are never selected.
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
 * Until this season has VALUE_FORM_MIN_GAMES, take the better of this
 * season and prior career so a new campaign with a 1.13 career ratio is
 * selected from week 1, a hot start can still earn a call-up, and a
 * 13-game blank cannot wipe the career figure. After 15 games, this
 * season decides.
 */
export function callUpRatio(params: {
  season?: { goals: number; gamesPlayed: number } | null;
  careerGoals: number;
  careerGames: number;
}): number {
  const gp = params.season?.gamesPlayed ?? 0;
  const goals = params.season?.goals ?? 0;
  const seasonRatio = gp > 0 ? goals / gp : 0;
  if (gp >= VALUE_FORM_MIN_GAMES) return seasonRatio;
  const priorGames = Math.max(0, params.careerGames - gp);
  const priorGoals = Math.max(0, params.careerGoals - goals);
  const priorRatio = priorGames > 0 ? priorGoals / priorGames : 0;
  return Math.max(seasonRatio, priorRatio);
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

export function emptyInternationalSeason(
  tournament: InternationalTournamentId | null,
): InternationalSeasonRecord {
  return {
    tournament,
    qualifyingGames: 0,
    qualifyingGoals: 0,
    qualifyingOutcome: 'none',
    finalsGames: 0,
    finalsGoals: 0,
    tournamentOutcome: 'none',
    playerOfTheTournament: false,
    topGoalscorer: false,
    injuryMissedFinals: false,
  };
}

export function markInjuryMissedFinals(
  rec: InternationalSeasonRecord | undefined,
  tournament: InternationalTournamentId | null,
): InternationalSeasonRecord {
  const next = rec ? { ...rec, tournament: rec.tournament ?? tournament } : emptyInternationalSeason(tournament);
  next.injuryMissedFinals = true;
  return next;
}

export function bumpInternationalSeason(
  rec: InternationalSeasonRecord | undefined,
  tournament: InternationalTournamentId | null,
  isQualifier: boolean,
  goals: number,
): InternationalSeasonRecord {
  const next: InternationalSeasonRecord = rec
    ? { ...rec, tournament: rec.tournament ?? tournament }
    : emptyInternationalSeason(tournament);
  if (isQualifier) {
    next.qualifyingGames += 1;
    next.qualifyingGoals += goals;
  } else {
    next.finalsGames += 1;
    next.finalsGoals += goals;
  }
  return next;
}

export function rememberQualifierOpponents(
  team: NationalTeamState | null,
  ids: string[],
): NationalTeamState | null {
  if (!team || ids.length === 0) return team;
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of [...ids, ...(team.recentQualifierOpponentIds ?? [])]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
    if (unique.length >= 24) break;
  }
  return { ...team, recentQualifierOpponentIds: unique };
}

export function qualifierExcludeIds(
  team: NationalTeamState | null,
  carryOpponentIds?: string[] | null,
): string[] {
  return [...(team?.recentQualifierOpponentIds ?? []), ...(carryOpponentIds ?? [])];
}

type InternationalSnapshotSim = {
  internationalSelected: boolean;
  internationalTournament: InternationalTournamentId | null;
  internationalPhase: string;
  internationalStage: string;
  internationalReached?: string | null;
  nationQualified: boolean;
  qualifierTarget: number;
};

export function snapshotInternationalOutcomes(
  rec: InternationalSeasonRecord,
  sim: InternationalSnapshotSim | null,
): InternationalSeasonRecord {
  const tournament = rec.tournament ?? sim?.internationalTournament ?? null;
  if (!sim?.internationalSelected && rec.qualifyingGames === 0 && rec.finalsGames === 0) {
    return { ...rec, tournament };
  }

  let qualifyingOutcome: InternationalSeasonRecord['qualifyingOutcome'] = rec.qualifyingOutcome;
  if (rec.qualifyingGames <= 0 && (sim?.qualifierTarget ?? 0) <= 0) {
    qualifyingOutcome = 'none';
  } else if (sim?.internationalStage === 'failed-qualifying') {
    qualifyingOutcome = 'failed';
  } else if (sim?.internationalPhase === 'qualifiers') {
    qualifyingOutcome = 'ongoing';
  } else if (rec.qualifyingGames > 0) {
    if (
      sim?.nationQualified ||
      rec.finalsGames > 0 ||
      (sim?.internationalStage != null &&
        sim.internationalStage !== 'qualifying' &&
        sim.internationalStage !== 'not-selected' &&
        sim.internationalStage !== 'failed-qualifying')
    ) {
      qualifyingOutcome = 'qualified';
    }
  }

  let tournamentOutcome: InternationalSeasonRecord['tournamentOutcome'] = 'none';
  if (sim?.internationalPhase === 'qualifiers') {
    tournamentOutcome = 'none';
  } else if (sim?.internationalStage === 'failed-qualifying') {
    tournamentOutcome = 'did-not-qualify';
  } else if (sim?.internationalStage === 'champion') {
    tournamentOutcome = 'champion';
  } else if (sim?.internationalStage === 'eliminated') {
    const reached = sim.internationalReached;
    tournamentOutcome = isTournamentOutcome(reached) ? reached : 'group';
  } else if (isTournamentOutcome(sim?.internationalStage)) {
    tournamentOutcome = sim.internationalStage as InternationalSeasonRecord['tournamentOutcome'];
  } else if (rec.finalsGames > 0) {
    tournamentOutcome = 'ongoing';
  }

  return { ...rec, tournament, qualifyingOutcome, tournamentOutcome };
}

function isTournamentOutcome(
  value: string | null | undefined,
): value is InternationalSeasonRecord['tournamentOutcome'] {
  return (
    value === 'group' ||
    value === 'round-of-32' ||
    value === 'round-of-16' ||
    value === 'quarter-final' ||
    value === 'semi-final' ||
    value === 'final' ||
    value === 'champion' ||
    value === 'ongoing' ||
    value === 'did-not-qualify'
  );
}
