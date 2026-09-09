import type { AvailabilityState } from './types';

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
 */
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

/** Applies the outcome of a game the player actually played in. */
export function applyMatchResult(state: AvailabilityState, scored: boolean): AvailabilityState {
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

/** Human-readable status for the career hub UI. */
export function describeAvailability(state: AvailabilityState): string {
  if (!isAvailable(state)) {
    const games = state.bannedGamesRemaining;
    return `Dropped from the squad \u2014 ${games} game${games === 1 ? '' : 's'} remaining`;
  }
  const allowance = allowanceForPhase(state.phase);
  const remaining = allowance - state.windowFails;
  if (state.phase === 0 && state.windowFails === 0) return 'In the squad';
  return `In the squad \u2014 score within ${remaining} game${remaining === 1 ? '' : 's'} or be dropped`;
}
