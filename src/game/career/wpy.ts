/**
 * The World Player of the Year judge - a pure function over a season's
 * already-known results. It does not simulate the Champions League or the
 * international tournament itself (that's the season 2-20 engine's job, see
 * matchEngine.ts); it only decides the award outcome once those results are
 * known, so it can be built, tested, and locked down well ahead of the
 * simulation that will eventually feed it.
 */

import type { InternationalTournamentId } from './data/competitions';
import type { TournamentSeasonOutcome } from './types';

export type WpyMajorYear = 'none' | 'world-cup' | 'euro';

export interface WpySeasonContext {
  /** This season's club goal ratio (goals / games played). */
  seasonGoalRatio: number;
  /** The ratio bar that counts as "elite" for award purposes. */
  eliteRatioBar: number;
  /** Club goals this season (league + cups + continentals). */
  clubGoals: number;
  wonChampionsLeague: boolean;
  /** World Cup or European Championship finals year. Other tournaments are ignored. */
  majorYear: WpyMajorYear;
  majorOutcome?: TournamentSeasonOutcome | null;
  majorFinalsGoals?: number;
  majorTopGoalscorer?: boolean;
  /** Rolling form across the last N club+country games, for the "extreme
   * form" lottery clause. */
  recentFormGoals: number;
  recentFormGames: number;
}

export interface WpyResult {
  won: boolean;
  reason: string;
}

export const WPY_CLUB_GOALS_BAR = 25;
export const WPY_MAJOR_FINALS_GOALS = 4;

const EXTREME_FORM_MIN_GAMES = 50;
const EXTREME_FORM_MIN_RATIO = 1.0;
const EXTREME_FORM_LOTTERY_CHANCE = 0.25;

export function majorYearForTournament(
  tournament: InternationalTournamentId | null | undefined,
  isFinalsSeason: boolean,
): WpyMajorYear {
  if (!isFinalsSeason || !tournament) return 'none';
  if (tournament === 'world-cup') return 'world-cup';
  if (tournament === 'euro') return 'euro';
  return 'none';
}

function clubPath(context: WpySeasonContext): boolean {
  return context.wonChampionsLeague && context.clubGoals >= WPY_CLUB_GOALS_BAR;
}

function majorChampionPath(context: WpySeasonContext): boolean {
  return (
    (context.majorYear === 'world-cup' || context.majorYear === 'euro')
    && context.majorOutcome === 'champion'
    && context.clubGoals >= WPY_CLUB_GOALS_BAR
    && (context.majorFinalsGoals ?? 0) >= WPY_MAJOR_FINALS_GOALS
  );
}

function majorRunnerUpPath(context: WpySeasonContext): boolean {
  return (
    (context.majorYear === 'world-cup' || context.majorYear === 'euro')
    && context.majorOutcome === 'final'
    && Boolean(context.majorTopGoalscorer)
    && context.wonChampionsLeague
    && context.clubGoals >= WPY_CLUB_GOALS_BAR
  );
}

/**
 * Locked rules:
 * - Club path: win the Champions League and score 25+ club goals.
 * - World Cup year: win the World Cup with 25+ club goals and 4+ finals
 *   goals, or lose the final as top scorer while also winning the Champions
 *   League with 25+ club goals.
 * - European Championship year: the same two paths.
 * - Copa América, Nations League, Asian, African, and other tournaments
 *   never replace the Champions League requirement.
 */
export function evaluateWpy(context: WpySeasonContext, rng: () => number = Math.random): WpyResult {
  const {
    seasonGoalRatio,
    recentFormGoals,
    recentFormGames,
    majorYear,
  } = context;

  if (majorChampionPath(context)) {
    const name = majorYear === 'world-cup' ? 'the World Cup' : 'the European Championship';
    return {
      won: true,
      reason: `Won ${name} with ${context.clubGoals} club goals and ${context.majorFinalsGoals} finals goals.`,
    };
  }

  if (majorRunnerUpPath(context)) {
    const name = majorYear === 'world-cup' ? 'World Cup' : 'European Championship';
    return {
      won: true,
      reason: `${name} runner-up, tournament top goalscorer, and Champions League winner with ${context.clubGoals} club goals.`,
    };
  }

  if (clubPath(context)) {
    return {
      won: true,
      reason: `Won the Champions League and scored ${context.clubGoals} club goals.`,
    };
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

  void seasonGoalRatio;
  return {
    won: false,
    reason: '',
  };
}
