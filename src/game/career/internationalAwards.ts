import type { InternationalTournamentId } from './data/competitions';

/**
 * World Cup / continental tournament individual awards. Chance is a step
 * function of finals (not qualifying) goals this season; Player of the
 * Tournament and top goalscorer are independent rolls.
 *
 * World Cup: 6 goals 50%, 7 goals 75%, 8+ goals 90%.
 * Continental: 5 goals 50%, 6 goals 75%, 7+ goals 90%.
 */

export function isWorldCupTournament(tournament: InternationalTournamentId): boolean {
  return tournament === 'world-cup';
}

/** Probability of winning one tournament award at this finals tally. */
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

export interface InternationalAwardResult {
  playerOfTheTournament: boolean;
  topGoalscorer: boolean;
  chance: number;
}

export function evaluateInternationalTournamentAwards(params: {
  tournament: InternationalTournamentId;
  finalsGoals: number;
  rng?: () => number;
}): InternationalAwardResult {
  const { tournament, finalsGoals, rng = Math.random } = params;
  const chance = internationalAwardWinChance(tournament, finalsGoals);
  if (chance <= 0) {
    return { playerOfTheTournament: false, topGoalscorer: false, chance: 0 };
  }
  return {
    playerOfTheTournament: rng() < chance,
    topGoalscorer: rng() < chance,
    chance,
  };
}
