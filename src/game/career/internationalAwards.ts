import type { InternationalTournamentId } from './data/competitions';
import type { TournamentSeasonOutcome } from './types';

/**
 * World Cup / continental tournament individual awards.
 *
 * Top goalscorer is a roll from finals goals.
 * Player of the Tournament is only available if the nation won the tournament,
 * or reached the final and the player also won the golden boot.
 */

export function isWorldCupTournament(tournament: InternationalTournamentId): boolean {
  return tournament === 'world-cup';
}

/** Probability of winning the tournament golden boot at this finals tally. */
export function internationalAwardWinChance(
  tournament: InternationalTournamentId,
  finalsGoals: number,
): number {
  if (isWorldCupTournament(tournament)) {
    if (finalsGoals >= 8) return 0.9;
    if (finalsGoals >= 7) return 0.75;
    if (finalsGoals >= 6) return 0.5;
    return 0;
  }
  if (finalsGoals >= 7) return 0.9;
  if (finalsGoals >= 6) return 0.75;
  if (finalsGoals >= 5) return 0.5;
  return 0;
}

/**
 * Losing-finalist Player of the Tournament, only if they also took the golden
 * boot: 8 → 50%, 9 → 75%, 10 → 90%, 11+ → 99%.
 */
export function losingFinalistPlayerOfTheTournamentChance(finalsGoals: number): number {
  if (finalsGoals >= 11) return 0.99;
  if (finalsGoals >= 10) return 0.9;
  if (finalsGoals >= 9) return 0.75;
  if (finalsGoals >= 8) return 0.5;
  return 0;
}

export function reachedInternationalFinal(
  outcome: TournamentSeasonOutcome | string | null | undefined,
): boolean {
  return outcome === 'champion' || outcome === 'final';
}

export interface InternationalAwardResult {
  playerOfTheTournament: boolean;
  topGoalscorer: boolean;
  chance: number;
}

export function evaluateInternationalTournamentAwards(params: {
  tournament: InternationalTournamentId;
  finalsGoals: number;
  tournamentOutcome?: TournamentSeasonOutcome | string | null;
  rng?: () => number;
}): InternationalAwardResult {
  const { tournament, finalsGoals, tournamentOutcome = 'none', rng = Math.random } = params;
  const bootChance = internationalAwardWinChance(tournament, finalsGoals);
  const topGoalscorer = bootChance > 0 && rng() < bootChance;

  if (tournamentOutcome === 'champion') {
    const pottChance = Math.max(0.55, bootChance);
    return {
      topGoalscorer,
      playerOfTheTournament: rng() < pottChance,
      chance: pottChance,
    };
  }

  if (tournamentOutcome === 'final' && topGoalscorer) {
    const pottChance = losingFinalistPlayerOfTheTournamentChance(finalsGoals);
    return {
      topGoalscorer: true,
      playerOfTheTournament: pottChance > 0 && rng() < pottChance,
      chance: pottChance,
    };
  }

  return {
    playerOfTheTournament: false,
    topGoalscorer,
    chance: bootChance,
  };
}
