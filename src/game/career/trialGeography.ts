import { clubsByTier, clubsInCountry, clubsInLeague, type Club, type ClubTier } from './data/clubs';
import { fifaRank } from './data/fifaRankings';
import { getNation } from './data/nations';
import { shuffle } from './util';

/** Only FIFA top-10 nations can earn Elite youth trials (6+ tournament goals). */
export const YOUTH_ELITE_RANK_CAP = 10;

const IRELAND_ENGLAND = new Set(['republic-of-ireland', 'northern-ireland']);

const NORDIC = new Set([
  'sweden',
  'norway',
  'denmark',
  'finland',
  'iceland',
  'faroe-islands',
]);

const EASTERN_EUROPE = new Set([
  'albania',
  'belarus',
  'bosnia-and-herzegovina',
  'bulgaria',
  'croatia',
  'czechia',
  'estonia',
  'georgia',
  'hungary',
  'kosovo',
  'latvia',
  'lithuania',
  'moldova',
  'montenegro',
  'north-macedonia',
  'poland',
  'romania',
  'russia',
  'serbia',
  'slovakia',
  'slovenia',
  'ukraine',
]);

const MIDDLE_EAST = new Set([
  'saudi-arabia',
  'qatar',
  'uae',
  'united-arab-emirates',
  'iran',
  'iraq',
  'jordan',
  'kuwait',
  'lebanon',
  'oman',
  'bahrain',
  'syria',
  'yemen',
  'palestine',
]);

const HOME_LEAGUE_COUNTRIES = new Set([
  'England',
  'Spain',
  'Italy',
  'Germany',
  'France',
  'Portugal',
  'Netherlands',
  'Turkey',
  'United States',
  'Saudi Arabia',
]);

/** Destination countries for youth/club trials. Empty means use home-country bias. */
export function trialDestinationCountries(nationId: string | null | undefined): string[] {
  if (!nationId) return [];
  const nation = getNation(nationId);
  if (!nation) return [];
  if (HOME_LEAGUE_COUNTRIES.has(nation.name)) return [nation.name];
  if (IRELAND_ENGLAND.has(nationId)) return ['England'];
  if (nation.confederation === 'CAF') return ['France'];
  if (NORDIC.has(nationId)) return ['Germany', 'Netherlands'];
  if (EASTERN_EUROPE.has(nationId)) return ['Germany', 'Netherlands', 'Italy'];
  if (nation.confederation === 'CONMEBOL') return ['Spain', 'Portugal'];
  if (nation.confederation === 'CONCACAF') return ['United States'];
  if (MIDDLE_EAST.has(nationId)) return ['Saudi Arabia'];
  return [];
}

export function isTopTenNation(nationId: string | null | undefined): boolean {
  if (!nationId) return false;
  const rank = fifaRank(nationId);
  return rank > 0 && rank <= YOUTH_ELITE_RANK_CAP;
}

/** @deprecated Use isTopTenNation. Youth Elite is now FIFA top 10 only. */
export function isTopTwentyNation(nationId: string | null | undefined): boolean {
  return isTopTenNation(nationId);
}

/** Player is from a country that already has a playable league in-game. */
export function isHomeLeagueNation(nationId: string | null | undefined): boolean {
  if (!nationId) return false;
  const nation = getNation(nationId);
  return Boolean(nation && HOME_LEAGUE_COUNTRIES.has(nation.name));
}

/**
 * Youth-championship band from raw goals, not goals/game.
 * FIFA top 10: 6+ Elite, 5 Strong, 4 Mid-table, 3 Medium, 2- Lower.
 * Rank 11+: 6+ Strong, 4–5 Mid-table, 3 Medium, 2- Lower. No Elite path.
 */
export function youthTierForNation(goals: number, nationId?: string | null): ClubTier {
  const scored = Math.max(0, Math.floor(goals));
  if (isTopTenNation(nationId)) {
    if (scored >= 6) return 1;
    if (scored >= 5) return 2;
    if (scored >= 4) return 3;
    if (scored >= 3) return 4;
    return 5;
  }
  if (scored >= 6) return 2;
  if (scored >= 4) return 3;
  if (scored >= 3) return 4;
  return 5;
}

/** A blank youth campaign from a nation outside the top 10 is MLS only. */
export function youthTrialsAreMlsOnly(goals: number, nationId?: string | null): boolean {
  return !isTopTenNation(nationId) && goals <= 0;
}

export function clubsInCountries(countries: string[], tier?: ClubTier, excludeIds: string[] = []): Club[] {
  const taken = new Set(excludeIds);
  const out: Club[] = [];
  for (const country of countries) {
    for (const club of clubsInCountry(country)) {
      if (club.playable === false || taken.has(club.id)) continue;
      if (tier != null && club.tier !== tier) continue;
      taken.add(club.id);
      out.push(club);
    }
  }
  return out;
}

export function mlsClubsAtTier(tier: ClubTier, excludeIds: string[] = []): Club[] {
  return clubsInLeague('MLS').filter((c) => c.playable !== false && c.tier === tier && !excludeIds.includes(c.id));
}

/** Two looks from the geographic destination, then fill from the rest of the band. */
export function pickGeographicTrialClubs(
  tier: ClubTier,
  nationId: string | null | undefined,
  excludeIds: string[] = [],
  count = 3,
  homeLooks = 2,
): Club[] {
  const exclude = [...excludeIds];
  if (youthTrialsAreMlsOnly(0, nationId) && tier === 5) {
    const mls = shuffle(mlsClubsAtTier(5, exclude));
    const picks = mls.slice(0, count);
    return picks.length >= count ? picks : [...picks, ...shuffle(clubsByTier(5).filter((c) => !exclude.includes(c.id) && c.league === 'MLS'))].slice(0, count);
  }

  const destinations = trialDestinationCountries(nationId);
  const picks: Club[] = [];
  const takeFrom = (pool: Club[]) => {
    for (const club of pool) {
      if (picks.length >= count) break;
      picks.push(club);
      exclude.push(club.id);
    }
  };
  if (destinations.length > 0) {
    takeFrom(shuffle(clubsInCountries(destinations, tier, exclude)).slice(0, Math.min(homeLooks, count)));
    if (picks.length < count) {
      takeFrom(shuffle(clubsInCountries(destinations, tier, exclude)));
    }
    // Pathway nations (Africa→France, Brazil→Iberia) stay in dest countries.
    // Home-league nations (Germany, Spain, …) keep the earned band and
    // world-fill the remaining Elite/Strong slots rather than dropping a tier.
    if (picks.length < count && !isHomeLeagueNation(nationId)) {
      for (const nearby of [tier + 1, tier - 1, tier + 2, tier - 2]) {
        if (nearby < 1 || nearby > 5) continue;
        takeFrom(shuffle(clubsInCountries(destinations, nearby as ClubTier, exclude)));
      }
      return picks.slice(0, count);
    }
  }
  if (picks.length < count) {
    const rest = shuffle(clubsByTier(tier).filter((c) => !exclude.includes(c.id)));
    takeFrom(rest);
  }
  return picks.slice(0, count);
}
