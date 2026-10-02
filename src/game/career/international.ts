import { createAvailability } from './availabilityEngine';
import type { Confederation, InternationalTournamentId } from './data/competitions';
import { clubsInCountry, SECOND_DIVISIONS, type ClubTier } from './data/clubs';
import { fifaRank } from './data/fifaRankings';
import { NATIONS, getNation, type Nation } from './data/nations';
import { SEMI_EURO_LEAGUES, TOP_LEAGUES } from './playerValue';
import type { AvailabilityState, InternationalSeasonRecord, SeasonRecord, SquadStatus } from './types';

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

export function isInternationalFinalsRound(
  round: string | null | undefined,
): boolean {
  return (
    round === 'group' ||
    round === 'round-of-32' ||
    round === 'round-of-16' ||
    round === 'quarter-final' ||
    round === 'semi-final' ||
    round === 'third-place' ||
    round === 'final'
  );
}

export function recordInternationalAppearance(
  team: NationalTeamState,
  tournament: InternationalCompetitionRecord['tournament'] | null,
  isQualifier: boolean,
  goals: number,
  isFinals = !isQualifier,
): NationalTeamState {
  if (!tournament) {
    return { ...team, caps: team.caps + 1, goals: team.goals + goals };
  }
  const existing = team.byCompetition.find((row) => row.tournament === tournament);
  const row = existing ? { ...existing } : emptyCompetitionRecord(tournament);
  if (isQualifier) {
    row.qualifyingGames += 1;
    row.qualifyingGoals += goals;
  } else if (isFinals) {
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

/** @deprecated Top-20 nations still use this as their club-level ceiling. */
export const MAX_CLUB_TIER_FOR_SELECTION: ClubTier = 3;

/** Top-20 FIFA nations demand a 0.66 career ratio. */
export const TOP_NATION_SELECTION_RATIO = 0.66;

/** A top-20 nation's own top flight is always enough for a call-up. */
const HOME_NATION_LEAGUES: Record<string, Set<string>> = {
  mexico: new Set(['Liga MX']),
  brazil: new Set(['Brasileirao']),
  argentina: new Set(['Liga Profesional']),
  colombia: new Set(['Primera A']),
  japan: new Set(['J1 League']),
  'united-states': new Set(['MLS']),
  'saudi-arabia': new Set(['Saudi Pro League']),
};

/**
 * Call-ups follow the league only for FIFA top-20 nations. Those sides
 * take their own top flight, any big-five top-division club, or a Strong
 * club in Holland, Portugal, or Turkey. Nations outside the top 20 have
 * no club-level bar.
 */
export function leagueEligibleForNationalTeam(
  league: string | null | undefined,
  nationId?: string | null,
  clubTier?: ClubTier | null,
): boolean {
  if (!league || SECOND_DIVISIONS.has(league)) return false;
  const rank = nationId ? fifaRank(nationId) : 99;
  if (rank > 20) return true;
  if (nationId && HOME_NATION_LEAGUES[nationId]?.has(league)) return true;
  if (TOP_LEAGUES.has(league)) return true;
  return SEMI_EURO_LEAGUES.has(league) && clubTier != null && clubTier <= 2;
}

export function callUpLeagueRequirement(nationId: string): string {
  const rank = fifaRank(nationId);
  if (rank <= 20) {
    return 'a top-division club in your country, a top-division English, Spanish, Italian, German or French club, or a strong club in the Dutch League, Portuguese League or Turkish League';
  }
  return 'a top division';
}

/**
 * Only the best countries insist on a certain club level. Albania and
 * other mid/low FIFA sides will call a player from any playable club.
 * @deprecated Use leagueEligibleForNationalTeam — call-ups are by league.
 */
export function maxClubTierForNation(nationId: string | null | undefined): ClubTier {
  if (!nationId) return MAX_CLUB_TIER_FOR_SELECTION;
  const rank = fifaRank(nationId);
  if (rank <= 20) return 3;
  if (rank <= 50) return 4;
  return 5;
}

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

export function clubEligibleForNationalTeam(
  clubTier: ClubTier,
  nationId?: string | null,
  league?: string | null,
): boolean {
  if (league) return leagueEligibleForNationalTeam(league, nationId, clubTier);
  return clubTier <= maxClubTierForNation(nationId);
}

/** Public Season 1 has no international call-ups until after this week. */
export const SEASON_1_CALL_UP_MIN_WEEK = 20;

/** League appearances in the call-up season before a nation will make a first call-up. */
export const CALL_UP_MIN_LEAGUE_GAMES = 20;

/** Career league appearances across seasons (transfer sample, not the first-cap wait). */
export function careerLeagueAppearances(
  seasons: Array<{ leagueGames?: number } | null | undefined> | null | undefined,
): number {
  return (seasons ?? []).reduce((n, season) => n + (season?.leagueGames ?? 0), 0);
}

export function playerHasBeenCapped(params: {
  caps?: number | null;
  seasons?: Array<{ international?: { qualifyingGames?: number; finalsGames?: number } | null }> | null;
}): boolean {
  if ((params.caps ?? 0) > 0) return true;
  return (params.seasons ?? []).some((season) => {
    const intl = season.international;
    return (intl?.qualifyingGames ?? 0) + (intl?.finalsGames ?? 0) > 0;
  });
}

/**
 * Call-up uses the ratio passed in (career until this season has a real
 * sample, then this season). Only first-team starters are called.
 * League decides eligibility, not the club: second divisions are out,
 * and top nations need a big-five club or a Strong Dutch/Portuguese/
 * Turkish side. The 20-league-game wait is only for the first-ever cap
 * and must be earned in the season they are called up — 19 last year
 * plus 1 this year is not enough. Already-capped players skip the wait.
 * Re-check the ratio before every window.
 */
export function isSelectedForNationalTeam(params: {
  clubTier: ClubTier;
  careerGoalRatio: number;
  nationId: string | null;
  publicSeason?: number | null;
  calendarWeek?: number;
  squadStatus?: SquadStatus | null;
  league?: string | null;
  leagueGames?: number;
  hasBeenCapped?: boolean;
}): boolean {
  if (!params.nationId) return false;
  if ((params.squadStatus ?? 'starter') !== 'starter') return false;
  if (!params.hasBeenCapped && (params.leagueGames ?? 0) < CALL_UP_MIN_LEAGUE_GAMES) return false;
  if (params.publicSeason === 1 && (params.calendarWeek ?? 0) <= SEASON_1_CALL_UP_MIN_WEEK) {
    return false;
  }
  if (!clubEligibleForNationalTeam(params.clubTier, params.nationId, params.league)) return false;
  return params.careerGoalRatio >= selectionRatioForNation(params.nationId);
}

/** Current-season ratio. Zero games means not in form for a call-up yet. */
export function seasonRatioForSelection(season: { goals: number; gamesPlayed: number } | null): number {
  if (!season || season.gamesPlayed <= 0) return 0;
  return season.goals / season.gamesPlayed;
}

/**
 * Until this season has CALL_UP_MIN_LEAGUE_GAMES, take the better of this
 * season and prior career. After 20 league games, this season decides so a
 * later slump drops the player even if they were already called up.
 */
export function callUpRatio(params: {
  season?: { goals: number; gamesPlayed: number; leagueGames?: number } | null;
  careerGoals: number;
  careerGames: number;
}): number {
  const gp = params.season?.leagueGames ?? params.season?.gamesPlayed ?? 0;
  const goals = params.season?.goals ?? 0;
  const seasonRatio = (params.season?.gamesPlayed ?? 0) > 0
    ? goals / (params.season?.gamesPlayed ?? 1)
    : 0;
  if (gp >= CALL_UP_MIN_LEAGUE_GAMES) return seasonRatio;
  const played = params.season?.gamesPlayed ?? 0;
  const priorGames = Math.max(0, params.careerGames - played);
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
  isFinals = !isQualifier,
): InternationalSeasonRecord {
  const next: InternationalSeasonRecord = rec
    ? { ...rec, tournament: rec.tournament ?? tournament }
    : emptyInternationalSeason(tournament);
  if (isQualifier) {
    next.qualifyingGames += 1;
    next.qualifyingGoals += goals;
  } else if (isFinals) {
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
    qualifyingOutcome = 'none';
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

/** When a later season decides qualify/fail, stamp that onto earlier same-tournament cards. */
export function patchPriorQualifyingOutcomes(
  history: SeasonRecord[],
  tournament: InternationalTournamentId | null | undefined,
  outcome: InternationalSeasonRecord['qualifyingOutcome'],
): SeasonRecord[] {
  if (!tournament || (outcome !== 'qualified' && outcome !== 'failed')) return history;
  return history.map((season) => {
    const intl = season.international;
    if (!intl || intl.tournament !== tournament || intl.qualifyingGames <= 0) return season;
    if (intl.qualifyingOutcome === 'qualified' || intl.qualifyingOutcome === 'failed') return season;
    return { ...season, international: { ...intl, qualifyingOutcome: outcome } };
  });
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
