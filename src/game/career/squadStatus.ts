import type { CalendarFixture, SeasonCalendar } from './calendar';
import type { Club } from './data/clubs';
import type { PlayerRole, SquadStatus } from './types';

export const SQUAD_STATUS_LABEL: Record<SquadStatus, string> = {
  starter: 'Starter',
  rotation: 'Rotation',
  impact: 'Impact',
};

export function defaultSquadStatus(role: PlayerRole): SquadStatus {
  if (role === 'loan') return 'starter';
  if (role === 'first-team') return 'starter';
  return 'rotation';
}

export function describeSquadStatus(status: SquadStatus): string {
  if (status === 'starter') return 'In the starting XI for league games';
  if (status === 'rotation') return 'Rotated in the league — cups and internationals still need you';
  return 'Impact role in the league — roughly every other match';
}

export function describeRotationSitOut(status: SquadStatus): string {
  if (status === 'impact') return 'Not selected · impact';
  return 'Not selected · rotation';
}

/**
 * Sit-out pattern among league fixtures already completed this season.
 * Starter: never. Rotation: every third. Impact: every other.
 */
export function shouldSitLeagueFixture(status: SquadStatus, completedLeagueFixtures: number): boolean {
  if (status === 'starter') return false;
  if (status === 'rotation') return completedLeagueFixtures % 3 === 2;
  return completedLeagueFixtures % 2 === 1;
}

export function completedLeagueFixtureCount(
  calendar: SeasonCalendar | null | undefined,
  fixtureIndex: number,
): number {
  if (!calendar) return 0;
  return calendar.fixtures.slice(0, fixtureIndex).filter((fixture) => fixture.kind === 'league').length;
}

export function isSquadRotationSitOut(
  role: PlayerRole,
  squadStatus: SquadStatus,
  fixtureKind: CalendarFixture['kind'],
  completedLeagueFixtures: number,
): boolean {
  if (role === 'reserve') return false;
  if (fixtureKind !== 'league') return false;
  return shouldSitLeagueFixture(squadStatus, completedLeagueFixtures);
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
}): SquadStatus {
  if (params.role === 'reserve') return 'rotation';
  const { current, ratio, gamesPlayed, bar } = params;
  const badlyShort = ratio < bar - 0.1 || gamesPlayed < 10;
  const hit = ratio >= bar && gamesPlayed >= 12;
  const strongHit = ratio >= bar + 0.02 && gamesPlayed >= 18;

  if (current === 'starter') {
    if (ratio >= bar && gamesPlayed >= 20) return 'starter';
    if (badlyShort) return 'impact';
    return 'rotation';
  }
  if (current === 'rotation') {
    if (strongHit) return 'starter';
    if (ratio >= bar - 0.1 && gamesPlayed >= 12) return 'rotation';
    return 'impact';
  }
  return hit ? 'rotation' : 'impact';
}

/**
 * Playing time after a move. A step up (lower tier number) starts in rotation.
 * A loan is first-team football. Same or weaker club: starter.
 */
export function squadStatusOnArrival(params: {
  fromClub: Club | null | undefined;
  toClub: Club | null | undefined;
  move: 'loan' | 'permanent' | 'promotion' | 'stay';
  nextIfStay: SquadStatus;
}): SquadStatus {
  if (params.move === 'stay') return params.nextIfStay;
  if (params.move === 'loan') return 'starter';
  if (params.move === 'promotion') return 'rotation';
  if (!params.fromClub || !params.toClub) return 'starter';
  if (params.toClub.tier < params.fromClub.tier) return 'rotation';
  return 'starter';
}
