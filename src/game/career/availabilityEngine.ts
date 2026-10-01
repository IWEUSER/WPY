import type { AvailabilityState, SquadStatus } from './types';

/**
 * The escalating suspension rule:
 *
 *   Phase 0: 3-game allowance to score in.  Fail all 3 -> dropped for 1 game.
 *   Phase 1: 2-game allowance.               Fail both -> dropped for 1 game.
 *   Phase 2: 1-game allowance.               Fail it    -> dropped for 2 games.
 *   Phase 3: 1-game allowance.               Fail it    -> dropped for 3 games.
 *   Phase n (n >= 2): 1-game allowance.      Fail it    -> dropped for n games.
 *
 * Scoring at ANY point resets straight back to phase 0 with a fresh 3-game
 * allowance - there is no partial credit, but there is also no permanent
 * penalty: one goal wipes the slate clean.
 *
 * This window runs for every squad role, including Rising star and Impact.
 * Rotation sit-outs and 0-chance fixtures still do not count as misses.
 */

/** Drop windows run for every squad role, including Rising star and Impact. */
export function availabilityDropsApply(_status?: SquadStatus | null): boolean {
  return true;
}

export function allowanceForPhase(phase: number): number {
  if (phase <= 0) return 3;
  if (phase === 1) return 2;
  return 1;
}

export function banLengthForPhase(phase: number): number {
  if (phase <= 1) return 1;
  return phase;
}

export function createAvailability(): AvailabilityState {
  return { phase: 0, windowFails: 0, bannedGamesRemaining: 0 };
}

export function isAvailable(state: AvailabilityState): boolean {
  return state.bannedGamesRemaining <= 0;
}

/** Consumes one game of an active ban (called for matches the player sits out). */
export function serveBannedGame(state: AvailabilityState): AvailabilityState {
  return { ...state, bannedGamesRemaining: Math.max(0, state.bannedGamesRemaining - 1) };
}

/** A match with no scoring look cannot start or continue a drop window. */
export function matchCountsTowardDrop(chances?: number | null): boolean {
  return (chances ?? 1) > 0;
}

/** Applies the outcome of a game the player actually played in. */
export function applyMatchResult(
  state: AvailabilityState,
  scored: boolean,
  chances = 1,
  squadStatus?: SquadStatus,
): AvailabilityState {
  if (!availabilityDropsApply(squadStatus)) return state;
  if (!matchCountsTowardDrop(chances)) return state;
  if (scored) return createAvailability();

  const windowFails = state.windowFails + 1;
  const allowance = allowanceForPhase(state.phase);
  if (windowFails >= allowance) {
    return {
      phase: state.phase + 1,
      windowFails: 0,
      bannedGamesRemaining: banLengthForPhase(state.phase),
    };
  }
  return { ...state, windowFails };
}

/** Games left in the current scoring window before a drop. */
export function gamesLeftInDropWindow(state: AvailabilityState): number {
  return Math.max(0, allowanceForPhase(state.phase) - state.windowFails);
}

/** True when a blank in the next scoring look drops the player. */
export function nextMissDrops(state: AvailabilityState, squadStatus?: SquadStatus): boolean {
  if (!availabilityDropsApply(squadStatus) || !isAvailable(state)) return false;
  return gamesLeftInDropWindow(state) === 1;
}

/** Human-readable status for the career hub UI. Drop risk lives on Recent form. */
export function describeAvailability(
  state: AvailabilityState,
  squadStatus?: SquadStatus,
): string {
  if (!availabilityDropsApply(squadStatus)) return 'In the squad';
  if (!isAvailable(state)) {
    const games = state.bannedGamesRemaining;
    return `Dropped from the squad \u2014 ${games} game${games === 1 ? '' : 's'} remaining`;
  }
  return 'In the squad';
}
