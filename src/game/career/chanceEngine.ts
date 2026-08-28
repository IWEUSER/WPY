import type { CalendarFixture } from './calendar';

/**
 * How many scoring chances the player gets in a given match, and whether
 * this fixture is a "decisive" one - a semi-final or final settled by a
 * single defining chance rather than a normal spread across the game.
 */
export interface MatchChances {
  count: number;
  isDecisive: boolean;
}

/**
 * Weighted distribution over 0-4 chances whose mean is exactly 2
 * (0*0.1 + 1*0.2 + 2*0.4 + 3*0.2 + 4*0.1 = 2.0) - used for any match that
 * isn't a decisive semi/final: league games, group-stage games, and each
 * leg of a two-legged knockout tie considered on its own.
 */
const CHANCE_WEIGHTS: readonly (readonly [count: number, weight: number])[] = [
  [0, 0.1],
  [1, 0.2],
  [2, 0.4],
  [3, 0.2],
  [4, 0.1],
];

function weightedPick(weights: readonly (readonly [number, number])[], rng: () => number): number {
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [value, weight] of weights) {
    if (roll < weight) return value;
    roll -= weight;
  }
  return weights[weights.length - 1][0];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** A regular league or group-stage match: 0-4 chances, random game to game,
 * but distributed so the season's average lands on 2 per match. */
export function chancesForLeagueMatch(rng: () => number = Math.random): MatchChances {
  return { count: weightedPick(CHANCE_WEIGHTS, rng), isDecisive: false };
}

/**
 * A two-legged continental knockout tie: each leg gets its own 0-4 chance
 * count, but the pair is balanced so the *tie's* average still lands on ~2
 * per leg (the locked design's example: 4 chances in one leg, 0 in the
 * other) - unlike league matches, whose two instances would be fully
 * independent draws.
 */
export function chancesForKnockoutTie(rng: () => number = Math.random): [MatchChances, MatchChances] {
  const firstLeg = Math.floor(rng() * 5); // uniform 0-4
  const wobble = Math.floor(rng() * 3) - 1; // -1, 0, or +1 - keeps it from being perfectly predictable
  const secondLeg = clamp(4 - firstLeg + wobble, 0, 4);
  return [
    { count: firstLeg, isDecisive: false },
    { count: secondLeg, isDecisive: false },
  ];
}

/** Semis and finals are decided by a single defining chance: score it and
 * the club wins, miss it and the club goes out - no probability buffer. */
export function chancesForDecisiveMatch(): MatchChances {
  return { count: 1, isDecisive: true };
}

/** Resolves how many chances a given calendar fixture grants the player.
 * For a two-legged knockout tie's *pair*, prefer chancesForKnockoutTie() so
 * both legs are balanced together; this single-fixture entry point (used
 * when only one leg is known at a time, e.g. a league match) falls back to
 * the same weighted table as a standalone leg. */
export function chancesForFixture(fixture: CalendarFixture, rng: () => number = Math.random): MatchChances {
  if (fixture.isDecisive) return chancesForDecisiveMatch();
  return chancesForLeagueMatch(rng);
}

export type DecisiveOutcome = 'win' | 'lose';

/** In a decisive match the club's fate is entirely the player's: score the
 * one chance and the club wins, miss it and the club is out. */
export function resolveDecisiveMatch(scored: boolean): DecisiveOutcome {
  return scored ? 'win' : 'lose';
}
