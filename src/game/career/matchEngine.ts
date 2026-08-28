import type { ClubTier } from './data/clubs';
import type { ContinentalCupId } from './data/competitions';

/**
 * The club-vs-club simulation surface for seasons 2-20 - deliberately left
 * as interfaces/stubs behind this module so the calendar, chance engine, and
 * career store can all be built and tested against a stable contract before
 * the actual probabilistic engine exists.
 *
 * Locked design this will implement:
 * - A probabilistic result engine weighted by the fixed club/tier hierarchy
 *   (see data/clubs.ts) - better clubs should win more often, never
 *   deterministically.
 * - Regular league/group fixtures are resolved by this engine independent of
 *   the player's individual chances (the player's goals are one input among
 *   many teammates' performances).
 * - Semi-finals and finals bypass this engine entirely: see
 *   chanceEngine.ts's resolveDecisiveMatch(), which settles those on the
 *   player's single chance alone.
 */

export interface ClubMatchContext {
  clubTier: ClubTier;
  opponentTier: ClubTier;
  isHome: boolean;
}

export interface ClubMatchResult {
  scoreFor: number;
  scoreAgainst: number;
  outcome: 'win' | 'draw' | 'loss';
}

/** TODO(season 2-20): implement the probabilistic tier-weighted result
 * engine described above. Left unimplemented on purpose - every other piece
 * of the season 2-20 scaffolding (calendar, chance engine, standings shape)
 * is designed to plug into this without further interface changes. */
export function simulateClubMatch(_context: ClubMatchContext): ClubMatchResult {
  throw new Error('simulateClubMatch is not implemented yet - part of the season 2-20 simulation.');
}

export interface LeagueStanding {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  position: number;
}

export type EuropeanStage =
  | 'group'
  | 'round-of-16'
  | 'quarter-final'
  | 'semi-final'
  | 'final'
  | 'eliminated'
  | 'champion';

export interface EuropeanStanding {
  cup: ContinentalCupId;
  stage: EuropeanStage;
}

/**
 * What the Career Hub renders once season 2-20 exists: league position and
 * European standing only, per the locked design ("not every result"). Folded
 * up from simulateClubMatch() results across the season's SeasonCalendar.
 */
export interface SeasonStandings {
  league: LeagueStanding[];
  europeanStanding: EuropeanStanding | null;
}

/** TODO(season 2-20): fold simulateClubMatch() results (played across the
 * SeasonCalendar's league + continental-* fixtures) into a table position
 * and European stage. Left unimplemented on purpose - see module docs. */
export function buildSeasonStandings(): SeasonStandings {
  throw new Error('buildSeasonStandings is not implemented yet - part of the season 2-20 simulation.');
}
