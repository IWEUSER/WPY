import { CLUBS, clubsByTier, clubsInCountry, type Club, type ClubTier } from './data/clubs';
import { countryForNationality, pickClubsBiasedToCountry } from './clubOffers';

export const TRIAL_SHOTS = 10;

/** Maps trial conversion straight onto the club tier that comes calling. */
export function tierForTrial(goals: number): ClubTier {
  if (goals >= 9) return 1; // 9-10/10 -> elite clubs
  if (goals >= 7) return 2; // 7-8/10
  if (goals >= 4) return 3; // 4-6/10
  if (goals >= 1) return 4; // 1-3/10
  return 5; // 0/10 -> the smallest club in the game
}

/**
 * Picks up to `count` distinct clubs from the tier the trial performance
 * earned. If the player's nationality has a league in the game, two of the
 * three offers come from that country.
 */
export function offerClubsForTrial(goals: number, count = 3, nationality?: string | null): Club[] {
  const tier = tierForTrial(goals);
  let pool = clubsByTier(tier);
  if (pool.length < count) {
    const fallbackTier = Math.min(5, tier + 1) as ClubTier;
    pool = [...pool, ...clubsByTier(fallbackTier)];
  }
  if (pool.length < count) pool = [...pool, ...CLUBS];

  const country = countryForNationality(nationality);
  const extraHome = country
    ? clubsInCountry(country).filter((c) => Math.abs(c.tier - tier) <= 1)
    : [];
  const minHome = extraHome.length > 0 ? 2 : 0;
  return pickClubsBiasedToCountry(pool, count, country, minHome, extraHome);
}
