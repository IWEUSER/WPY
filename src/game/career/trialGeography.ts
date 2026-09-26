import { clubsByTier, clubsInCountry, clubsInLeague, type Club, type ClubTier } from './data/clubs';
import { fifaRank } from './data/fifaRankings';
import { getNation } from './data/nations';
import { shuffle } from './util';

/** Nations outside the FIFA top 20 cannot earn Elite/Strong youth trials. */
export const YOUTH_ELITE_RANK_CAP = 20;

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

export function isTopTwentyNation(nationId: string | null | undefined): boolean {
  if (!nationId) return false;
  const rank = fifaRank(nationId);
  return rank > 0 && rank <= YOUTH_ELITE_RANK_CAP;
}

/**
 * Youth-championship band. Top-20 nations keep the existing elite→lower
 * scale. Everyone else cannot reach Elite/Strong: 1.00 mid-table, 0.66
 * medium, 0.33/0.00 lower level.
 */
export function youthTierForNation(ratio: number, nationId?: string | null): ClubTier {
  if (isTopTwentyNation(nationId)) {
    if (ratio >= 0.75) return 1;
    if (ratio >= 0.55) return 2;
    if (ratio >= 0.45) return 3;
    if (ratio >= 0.33) return 4;
    return 5;
  }
  if (ratio >= 1) return 3;
  if (ratio >= 0.66) return 4;
  return 5;
}

/** A blank youth campaign from a nation outside the top 20 is MLS only. */
export function youthTrialsAreMlsOnly(ratio: number, nationId?: string | null): boolean {
  return !isTopTwentyNation(nationId) && ratio <= 0;
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
  if (destinations.length > 0) {
    const destPool = shuffle(clubsInCountries(destinations, tier, exclude));
    const wanted = Math.min(homeLooks, count, destPool.length);
    for (let i = 0; i < wanted; i++) {
      picks.push(destPool[i]);
      exclude.push(destPool[i].id);
    }
  }
  if (picks.length < count) {
    const rest = shuffle(clubsByTier(tier).filter((c) => !exclude.includes(c.id)));
    for (const club of rest) {
      picks.push(club);
      exclude.push(club.id);
      if (picks.length >= count) break;
    }
  }
  return picks;
}
