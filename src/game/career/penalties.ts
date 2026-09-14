import { missedChanceWinFactor } from './matchEngine';
import type { ClubMatchResult } from './matchEngine';

/** Used when no 90-minute team strength is supplied. */
export const PENALTY_WIN_IF_SCORED = 0.8;
export const PENALTY_WIN_IF_MISSED = 0.2;

/**
 * If the tie finished level, decide it on penalties. 90-minute score stays.
 * A scored kick lifts the side; a miss scales the original 90-minute win
 * chance by the same factor as one missed open-play chance.
 */
export function settleDrawOnPenalties(
  result: ClubMatchResult,
  playerScored: boolean,
  rng: () => number = Math.random,
  teamWinProbability?: number,
): ClubMatchResult {
  if (result.outcome !== 'draw') return result;
  const pWin =
    teamWinProbability == null
      ? playerScored
        ? PENALTY_WIN_IF_SCORED
        : PENALTY_WIN_IF_MISSED
      : playerScored
        ? Math.min(0.92, Math.max(0.55, teamWinProbability + 0.3))
        : Math.max(0.06, teamWinProbability * missedChanceWinFactor(1));
  const won = rng() < pWin;
  return {
    ...result,
    outcome: won ? 'win' : 'loss',
    penalties: { won, for: won ? 5 : 4, against: won ? 4 : 5 },
  };
}

export function penaltyScoreline(result: ClubMatchResult): string | null {
  if (!result.penalties) return null;
  return `${result.penalties.for}\u2013${result.penalties.against} on penalties`;
}

export function describeDrawSettledOnPenalties(
  result: ClubMatchResult,
  scoreFor: number,
  scoreAgainst: number,
): string | null {
  const pens = penaltyScoreline(result);
  if (!pens || !result.penalties) return null;
  const verb = result.penalties.won ? 'won' : 'lost';
  return `drew ${scoreFor}\u2013${scoreAgainst} (${verb} ${pens})`;
}
