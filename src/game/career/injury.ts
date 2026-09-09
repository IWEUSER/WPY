/**
 * Injuries sit the player out of upcoming fixtures. Most absences are one
 * week; a first-match injury can still wipe the rest of the season, but
 * that tail is rare across a 20-season career.
 */
export const INJURY_CHANCE_PER_MATCH = 0.032;

export function rollInjuryAbsence(remainingGames: number, rng: () => number = Math.random): number {
  if (remainingGames <= 0) return 0;
  if (rng() >= INJURY_CHANCE_PER_MATCH) return 0;
  return injuryDuration(remainingGames, rng);
}

/** Duration once an injury has already been rolled. */
export function injuryDuration(remainingGames: number, rng: () => number = Math.random): number {
  const left = Math.max(1, remainingGames);
  const u = rng();
  if (u < 0.58) return 1;
  if (u < 0.8) return Math.min(2, left);
  if (u < 0.91) return Math.min(3 + Math.floor(rng() * 3), left);
  if (u < 0.97) return Math.min(6 + Math.floor(rng() * 6), left);
  if (u < 0.995) return Math.min(12 + Math.floor(rng() * Math.max(1, left - 11)), left);
  return left;
}

export function describeInjury(gamesRemaining: number): string {
  if (gamesRemaining <= 0) return '';
  if (gamesRemaining === 1) return 'Injured — misses the next game';
  return `Injured — ${gamesRemaining} games remaining`;
}
