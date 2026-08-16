import { CLUBS, clubsByTier, type Club, type ClubTier } from './data/clubs';

export const TRIAL_SHOTS = 10;

/** Maps trial conversion straight onto the club tier that comes calling. */
export function tierForTrial(goals: number): ClubTier {
  if (goals >= 9) return 1; // 9-10/10 -> elite clubs
  if (goals >= 7) return 2; // 7-8/10
  if (goals >= 4) return 3; // 4-6/10
  if (goals >= 1) return 4; // 1-3/10
  return 5; // 0/10 -> the smallest club in the game
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Picks up to `count` distinct clubs from the tier the trial performance earned. */
export function offerClubsForTrial(goals: number, count = 3): Club[] {
  const tier = tierForTrial(goals);
  let pool = clubsByTier(tier);
  if (pool.length < count) {
    // Not enough clubs in this tier alone (e.g. tier 5) - top up from the
    // next tier down so there's always a real choice of three.
    const fallbackTier = Math.min(5, tier + 1) as ClubTier;
    pool = [...pool, ...clubsByTier(fallbackTier)];
  }
  if (pool.length < count) pool = CLUBS;
  return shuffle(pool).slice(0, count);
}
