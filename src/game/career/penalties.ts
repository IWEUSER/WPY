import type { ClubMatchResult } from './matchEngine';

export const PENALTY_WIN_IF_SCORED = 0.8;
export const PENALTY_WIN_IF_MISSED = 0.2;

/** If the tie finished level, decide it on penalties. 90-minute score stays. */
export function settleDrawOnPenalties(
  result: ClubMatchResult,
  playerScored: boolean,
  rng: () => number = Math.random,
): ClubMatchResult {
  if (result.outcome !== 'draw') return result;
  const won = rng() < (playerScored ? PENALTY_WIN_IF_SCORED : PENALTY_WIN_IF_MISSED);
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
