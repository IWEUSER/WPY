import type { CalendarFixture, SeasonCalendar } from './calendar';
import type { Club } from './data/clubs';
import type { PlayerRole, SeasonRecord, SquadStatus } from './types';

export const SQUAD_STATUS_LABEL: Record<SquadStatus, string> = {
  starter: 'Starter',
  'rising-star': 'Rising star',
  reserve: 'Reserve',
  impact: 'Impact',
};

/** Stay as Rising star into the next season with at least this goals-per-game. */
export const RISING_STAR_MIN_RATIO = 0.33;

/** Squad role is reviewed from this calendar week onward each season. */
export const ROLE_REVIEW_WEEK = 20;

/** Older saves stored the reserve minutes role as "rotation". */
export function normalizeSquadStatus(
  status: string | null | undefined,
  role: PlayerRole = 'first-team',
): SquadStatus {
  if (status === 'rotation') return 'reserve';
  if (status === 'starter' || status === 'rising-star' || status === 'reserve' || status === 'impact') {
    return status;
  }
  return defaultSquadStatus(role);
}

export function defaultSquadStatus(role: PlayerRole): SquadStatus {
  if (role === 'loan') return 'starter';
  if (role === 'first-team') return 'starter';
  return 'reserve';
}

/** First public season on every path starts as Rising star, not a full-time starter. */
export function openingSquadStatus(role: PlayerRole): SquadStatus {
  if (role === 'first-team') return 'rising-star';
  return defaultSquadStatus(role);
}

export function describeSquadStatus(status: SquadStatus): string {
  if (status === 'starter') return 'In the starting XI across league, cups and internationals';
  if (status === 'rising-star') {
    return 'Rising star — more games than a reserve, one chance each time you play';
  }
  if (status === 'reserve') {
    return 'Reserve role across league, cups and internationals — fewer appearances';
  }
  return 'Impact role across all competitions — roughly every other match';
}

export function describeRotationSitOut(status: SquadStatus): string {
  if (status === 'impact') return 'Not selected · impact';
  if (status === 'rising-star') return 'Not selected · rising star';
  return 'Not selected · reserve';
}

/**
 * Sit-out pattern among actionable fixtures already completed this season.
 * Starter: never. Rising star: every fourth. Reserve: two of every three.
 * Impact: every other. Applies to league, cups and internationals alike.
 */
export function shouldSitLeagueFixture(status: SquadStatus, completedFixtures: number): boolean {
  if (status === 'starter') return false;
  if (status === 'rising-star') return completedFixtures % 4 === 3;
  if (status === 'reserve') return completedFixtures % 3 !== 0;
  return completedFixtures % 2 === 1;
}

/** Rising star always gets a single look in matches they play. */
export function chancesForSquadStatus(status: SquadStatus, drawn: number): number {
  if (status === 'rising-star') return 1;
  return drawn;
}

export function completedLeagueFixtureCount(
  calendar: SeasonCalendar | null | undefined,
  fixtureIndex: number,
): number {
  if (!calendar) return 0;
  return calendar.fixtures.slice(0, fixtureIndex).filter((fixture) => fixture.kind !== 'rest').length;
}

export function isSquadRotationSitOut(
  role: PlayerRole,
  squadStatus: SquadStatus,
  fixtureKind: CalendarFixture['kind'],
  completedFixtures: number,
): boolean {
  if (role === 'reserve') return false;
  if (fixtureKind === 'rest') return false;
  return shouldSitLeagueFixture(squadStatus, completedFixtures);
}

/** League golden boot, POTY, or tournament POT counts as clearing the club bar. */
export function seasonOverridesRatioBar(season: Pick<
  SeasonRecord,
  'topGoalscorer' | 'playerOfTheYear' | 'clubPlayerOfTheTournament' | 'international'
>): boolean {
  return Boolean(
    season.topGoalscorer
    || season.playerOfTheYear
    || season.clubPlayerOfTheTournament
    || season.international?.playerOfTheTournament
    || season.international?.topGoalscorer,
  );
}

export function seasonRatioClearsBar(params: {
  ratio: number;
  gamesPlayed: number;
  bar: number;
  season?: Pick<SeasonRecord, 'topGoalscorer' | 'playerOfTheYear' | 'clubPlayerOfTheTournament' | 'international'> | null;
}): boolean {
  if (params.season && seasonOverridesRatioBar(params.season)) return true;
  return params.gamesPlayed > 0 && params.ratio >= params.bar;
}

/**
 * End-of-season playing-time change. The player sees this before the transfer
 * window so they know their status going into the next campaign.
 */
export function nextSquadStatusAfterSeason(params: {
  role: PlayerRole;
  current: SquadStatus;
  ratio: number;
  gamesPlayed: number;
  bar: number;
  honoursClear?: boolean;
}): SquadStatus {
  if (params.role === 'reserve') return 'rising-star';
  const { current, ratio, gamesPlayed, bar } = params;
  const honours = Boolean(params.honoursClear);
  const badlyShort = !honours && (ratio < bar - 0.1 || gamesPlayed < 10);
  const hit = honours || (ratio >= bar && gamesPlayed >= 12);
  const strongHit = honours || (ratio >= bar + 0.02 && gamesPlayed >= 18);

  if (current === 'starter') {
    if (honours || (ratio >= bar && gamesPlayed >= 20)) return 'starter';
    if (badlyShort) return 'impact';
    return 'reserve';
  }
  if (current === 'rising-star') {
    if (hit) return 'starter';
    if (ratio >= RISING_STAR_MIN_RATIO && gamesPlayed >= 8) return 'rising-star';
    return 'reserve';
  }
  if (current === 'reserve') {
    if (strongHit) return 'starter';
    if (ratio >= bar - 0.1 && gamesPlayed >= 12) return 'reserve';
    return 'impact';
  }
  return hit ? 'reserve' : 'impact';
}

/**
 * After week 20, this season's ratio (or a honour) promotes a reserve / rising
 * star into the XI, or drops a starter who is short of the bar.
 */
export function squadStatusAfterFormReview(params: {
  current: SquadStatus;
  ratio: number;
  gamesPlayed: number;
  bar: number;
  honoursClear?: boolean;
}): SquadStatus {
  const honours = Boolean(params.honoursClear);
  const sample = params.gamesPlayed >= 6;
  const hit = honours || (sample && params.ratio >= params.bar);
  if (hit) return 'starter';
  if (params.current === 'starter' && sample && params.ratio < params.bar) return 'reserve';
  if (params.current === 'rising-star') {
    if (sample && params.ratio < RISING_STAR_MIN_RATIO) return 'reserve';
    return 'rising-star';
  }
  if (params.current === 'reserve' && sample && params.ratio < params.bar - 0.1) return 'impact';
  return params.current;
}

/**
 * Playing time after a move. A step up (lower tier number) starts as reserve.
 * A loan is first-team football. Same or weaker club: starter.
 * Academy promotion is Rising star.
 */
export function squadStatusOnArrival(params: {
  fromClub: Club | null | undefined;
  toClub: Club | null | undefined;
  move: 'loan' | 'permanent' | 'promotion' | 'stay';
  nextIfStay: SquadStatus;
}): SquadStatus {
  if (params.move === 'stay') return params.nextIfStay;
  if (params.move === 'loan') return 'starter';
  if (params.move === 'promotion') return 'rising-star';
  if (!params.fromClub || !params.toClub) return 'starter';
  if (params.toClub.tier < params.fromClub.tier) return 'reserve';
  return 'starter';
}
