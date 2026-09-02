import type { CalendarFixture } from './calendar';
import { clampStrength, STRENGTH_CEILING, STRENGTH_FLOOR } from './data/clubs';

/**
 * How many scoring chances the player gets in a given match. League, cup,
 * and knockout ties (including finals) all use the club-strength spread.
 * Missed chances then cut the club's win probability in matchEngine.
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

/** @deprecated Finals use the regular chance distribution. Kept for older tests. */
export function chancesForDecisiveMatch(): MatchChances {
  return chancesForLeagueMatch();
}

/** Resolves how many chances a given calendar fixture grants the player. */
export function chancesForFixture(
  _fixture: CalendarFixture,
  options: ChanceDrawOptions = {},
): MatchChances {
  return chancesForLeagueMatch(options);
}
