import type { ShotResult } from '../shooting/types';
import type { SeasonCalendar } from './calendar';
import type { NationalTeamState } from './international';
import type { SeasonStandings } from './matchEngine';
import type { LiveMatch, SeasonSimState } from './seasonSim';
import type { PendingTransfer } from './transfers';
import type { WpyResult } from './wpy';

export type PlayerRole = 'reserve' | 'first-team' | 'loan';

/**
 * Tracks the escalating "miss games -> get dropped" rule:
 * - You get an allowance of consecutive games to score in.
 * - Score at any point in the window and everything resets to a fresh
 *   3-game allowance.
 * - Fail the whole window and you're dropped for a number of games, then
 *   return with a *shorter* allowance next time (3 -> 2 -> 1, then it stays
 *   at 1) while the ban itself gets *longer* each time you fail again
 *   (1 -> 1 -> 2 -> 3 -> 4 -> ...).
 */
export interface AvailabilityState {
  /** 0 = fresh 3-game allowance, 1 = 2-game allowance, 2+ = 1-game allowance. */
  phase: number;
  /** Scoreless games so far within the current allowance window. */
  windowFails: number;
  /** Games still left to serve before the player is picked again. */
  bannedGamesRemaining: number;
}

export interface MatchRecord {
  matchNumber: number;
  played: boolean;
  scored: boolean | null;
}

export interface SeasonRecord {
  seasonNumber: number;
  clubId: string;
  role: PlayerRole;
  matches: MatchRecord[];
  goals: number;
  gamesPlayed: number;
  /** Set once the season is finalized - whether the ratio requirement was met. */
  ratioMet: boolean | null;
}

export interface TrialState {
  shots: ShotResult[];
  goals: number;
  offeredClubIds: string[];
}

export type CareerPhase =
  | 'menu'
  | 'trial'
  | 'club-offer'
  | 'nationality-choice'
  | 'hub'
  | 'match'
  | 'season-summary'
  | 'transfer-choice';

export interface CareerState {
  phase: CareerPhase;
  age: number;
  seasonNumber: number;
  clubId: string | null;
  parentClubId: string | null;
  role: PlayerRole;
  /** Seasons spent at the current club (0 = this is the grace-period season). */
  seasonsAtCurrentClub: number;
  trial: TrialState | null;
  availability: AvailabilityState;
  currentSeason: SeasonRecord | null;
  seasonHistory: SeasonRecord[];
  careerGoals: number;
  careerGames: number;
  /** Set when a loan/sale/transfer decision needs the player to pick a club. */
  pendingTransfer: PendingTransfer | null;
  /** Chosen international nationality (independent of current club) - null
   * until picked. The player chooses this once after signing their first
   * club; call-ups later use goal ratio + club level (see international.ts). */
  nationality: string | null;
  /** Caps, goals, and the same miss-streak drop rule as club football, scoped
   * to the national team. Null until a nationality is chosen. */
  nationalTeam: NationalTeamState | null;
  /** This season's fixture list once there are real opponents (season 2+) -
   * null in Season 1, which is reserve-team, no-opponents by design. Built
   * by calendar.ts; consumed by the not-yet-implemented season 2-20 engine
   * (see matchEngine.ts). */
  seasonCalendar: SeasonCalendar | null;
  /** Live league table + European stage for season 2+. Null in Season 1. */
  seasonStandings: SeasonStandings | null;
  seasonSim: SeasonSimState | null;
  liveMatch: LiveMatch | null;
  /** 1 per appearance (club or country), capped at 50, for the WPY form clause. */
  formWindow: number[];
  wpyResult: WpyResult | null;
  lastMatchSummary: string | null;
}
