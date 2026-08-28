/**
 * The World Player of the Year judge - a pure function over a season's
 * already-known results. It does not simulate the Champions League or the
 * international tournament itself (that's the season 2-20 engine's job, see
 * matchEngine.ts); it only decides the award outcome once those results are
 * known, so it can be built, tested, and locked down well ahead of the
 * simulation that will eventually feed it.
 */

export interface WpySeasonContext {
  /** This season's club goal ratio (goals / games played). */
  seasonGoalRatio: number;
  /** The ratio bar that counts as "elite" for award purposes - typically the
   * player's own first-team club threshold, but callers can tune this. */
  eliteRatioBar: number;
  wonChampionsLeague: boolean;
  isInternationalTournamentYear: boolean;
  wonInternationalTournament: boolean;
  /** Rolling form across the last N club+country games, for the "extreme
   * form" lottery clause. */
  recentFormGoals: number;
  recentFormGames: number;
}

export interface WpyResult {
  won: boolean;
  reason: string;
}

const EXTREME_FORM_MIN_GAMES = 50;
const EXTREME_FORM_MIN_RATIO = 1.0;
const EXTREME_FORM_LOTTERY_CHANCE = 0.25;

/**
 * Locked rules:
 * - Non-international years: need the elite goal ratio *and* a Champions
 *   League win. Club trophies without the ratio never win it.
 * - International years (Euros/World Cup-equivalent): winning that
 *   tournament trumps the Champions League as the trophy requirement.
 * - Extreme form (~1 goal/game over ~50 club+country games) buys a 1-in-4
 *   lottery shot at the award regardless of trophies.
 */
export function evaluateWpy(context: WpySeasonContext, rng: () => number = Math.random): WpyResult {
  const {
    seasonGoalRatio,
    eliteRatioBar,
    wonChampionsLeague,
    isInternationalTournamentYear,
    wonInternationalTournament,
    recentFormGoals,
    recentFormGames,
  } = context;

  const ratioMet = seasonGoalRatio >= eliteRatioBar;
  const trophyMet = isInternationalTournamentYear ? wonInternationalTournament : wonChampionsLeague;

  if (ratioMet && trophyMet) {
    const trophyName = isInternationalTournamentYear ? 'the international tournament' : 'the Champions League';
    return { won: true, reason: `Elite goal ratio (${seasonGoalRatio.toFixed(2)}) plus winning ${trophyName}.` };
  }

  const formRatio = recentFormGames > 0 ? recentFormGoals / recentFormGames : 0;
  if (recentFormGames >= EXTREME_FORM_MIN_GAMES && formRatio >= EXTREME_FORM_MIN_RATIO) {
    const wins = rng() < EXTREME_FORM_LOTTERY_CHANCE;
    return {
      won: wins,
      reason: wins
        ? `Extreme form (${formRatio.toFixed(2)} goals/game over ${recentFormGames} games) won the 1-in-4 lottery.`
        : `Extreme form (${formRatio.toFixed(2)} goals/game over ${recentFormGames} games) put you in the conversation, but the 1-in-4 lottery didn't land.`,
    };
  }

  return {
    won: false,
    reason: trophyMet ? 'Won the trophy, but the ratio requirement was not met.' : 'Ratio and/or trophy requirement not met.',
  };
}
