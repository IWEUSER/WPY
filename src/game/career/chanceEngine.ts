import type { CalendarFixture } from './calendar';
import { clampStrength, STRENGTH_CEILING, STRENGTH_FLOOR } from './data/clubs';

/**
 * How many scoring chances the player gets in a given match, and whether
 * this fixture is a "decisive" one - a semi-final or final settled by a
 * single defining chance rather than a normal spread across the game.
 */
export interface MatchChances {
  count: number;
  isDecisive: boolean;
}

/** Mid-pyramid default when a caller has no club (tests, fallbacks). */
const DEFAULT_STRENGTH = 70;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Expected chances per non-decisive match. Elite sides (~94) average about
 * 3.2 looks; the weakest (~52) average about 0.8. A striker at Mainz simply
 * does not see the ball as often as one at Bayern, however clinical they are.
 */
export function meanChancesFromStrength(strength: number): number {
  const t = (clampStrength(strength) - STRENGTH_FLOOR) / (STRENGTH_CEILING - STRENGTH_FLOOR);
  return 0.8 + t * 2.4;
}

function binomial(n: number, p: number, rng: () => number): number {
  let k = 0;
  for (let i = 0; i < n; i++) {
    if (rng() < p) k += 1;
  }
  return k;
}

function sampleChances(strength: number, rng: () => number): number {
  const mean = meanChancesFromStrength(strength);
  const p = clamp(mean / 4, 0.08, 0.88);
  return binomial(4, p, rng);
}

export interface ChanceDrawOptions {
  strength?: number;
  rng?: () => number;
}

/** A regular league, cup, or group-stage match: 0-4 chances, scaled so
 * stronger clubs generate more looks. */
export function chancesForLeagueMatch(options: ChanceDrawOptions = {}): MatchChances {
  const rng = options.rng ?? Math.random;
  const strength = options.strength ?? DEFAULT_STRENGTH;
  return { count: sampleChances(strength, rng), isDecisive: false };
}

/**
 * A two-legged continental knockout tie: each leg is drawn from the same
 * club-strength distribution, so an elite side still sees more of the ball
 * over the tie than a minnow.
 */
export function chancesForKnockoutTie(options: ChanceDrawOptions = {}): [MatchChances, MatchChances] {
  const rng = options.rng ?? Math.random;
  const strength = options.strength ?? DEFAULT_STRENGTH;
  return [
    { count: sampleChances(strength, rng), isDecisive: false },
    { count: sampleChances(strength, rng), isDecisive: false },
  ];
}

/** Semis and finals are decided by a single defining chance: score it and
 * the club wins, miss it and the club goes out - no probability buffer. */
export function chancesForDecisiveMatch(): MatchChances {
  return { count: 1, isDecisive: true };
}

/** Resolves how many chances a given calendar fixture grants the player. */
export function chancesForFixture(
  fixture: CalendarFixture,
  options: ChanceDrawOptions = {},
): MatchChances {
  if (fixture.isDecisive) return chancesForDecisiveMatch();
  return chancesForLeagueMatch(options);
}

export type DecisiveOutcome = 'win' | 'lose';

/** In a decisive match the club's fate is entirely the player's: score the
 * one chance and the club wins, miss it and the club is out. */
export function resolveDecisiveMatch(scored: boolean): DecisiveOutcome {
  return scored ? 'win' : 'lose';
}
