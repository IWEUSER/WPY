import { clubsByTier, clubsInCountry, clubsInLeague, type Club, type ClubTier } from './data/clubs';
import { fifaRank } from './data/fifaRankings';
import { getNation } from './data/nations';
import { shuffle } from './util';

/** Only FIFA top-10 nations can earn Elite youth trials (6+ tournament goals). */
export const YOUTH_ELITE_RANK_CAP = 10;

const IRELAND_ENGLAND = new Set(['republic-of-ireland', 'northern-ireland']);
const BRITISH_ISLES_ENGLAND = new Set(['scotland', 'wales', 'gibraltar']);
const CENTRAL_EUROPE = new Set([
  'austria',
  'belgium',
  'liechtenstein',
  'luxembourg',
  'switzerland',
]);

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
  if (IRELAND_ENGLAND.has(nationId) || BRITISH_ISLES_ENGLAND.has(nationId)) return ['England'];
  if (nation.confederation === 'CAF') return ['France'];
  if (NORDIC.has(nationId)) return ['Germany', 'Netherlands'];
  if (CENTRAL_EUROPE.has(nationId)) return ['Germany', 'Netherlands', 'France'];
  if (EASTERN_EUROPE.has(nationId) || nation.confederation === 'UEFA') {
    return ['Germany', 'Netherlands', 'Italy'];
  }
  if (nation.confederation === 'CONMEBOL') return ['Spain', 'Portugal'];
  if (nation.confederation === 'CONCACAF') return ['United States'];
  if (MIDDLE_EAST.has(nationId)) return ['Saudi Arabia'];
  return [];
}

export function isEuropeanNation(nationId: string | null | undefined): boolean {
  if (!nationId) return false;
  return getNation(nationId)?.confederation === 'UEFA';
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

/** A blank / Lower youth campaign uses MLS only for North American nations. */
export function nationUsesMlsLower(nationId: string | null | undefined): boolean {
  if (!nationId) return false;
  return getNation(nationId)?.confederation === 'CONCACAF';
}

export function youthTrialsAreMlsOnly(goals: number, nationId?: string | null): boolean {
  return nationUsesMlsLower(nationId) && youthTierForNation(goals, nationId) >= 5;
}

/** Portuguese lower-level Primeira sides plus Spain's second division. */
export function southAmericanLowerTrialClubs(excludeIds: string[] = []): Club[] {
  const exclude = new Set(excludeIds);
  const portugalLower = clubsInLeague('Primeira Liga').filter(
    (c) => c.playable !== false && c.tier >= 4 && !exclude.has(c.id),
  );
  const spainSecond = clubsInLeague('La Liga 2').filter(
    (c) => c.playable !== false && !exclude.has(c.id),
  );
  return [...portugalLower, ...spainSecond];
}

const EUROPEAN_SECOND_DIVISIONS = [
  'Championship',
  'La Liga 2',
  'Serie B',
  '2. Bundesliga',
  'Ligue 2',
] as const;

const EUROPEAN_LOWER_TOP_FLIGHTS = ['Primeira Liga', 'Eredivisie', 'Super Lig'] as const;

/** European second divisions plus Portuguese / Dutch / Turkish lower-level sides. */
export function europeanLowerTrialClubs(excludeIds: string[] = []): Club[] {
  const exclude = new Set(excludeIds);
  const second = EUROPEAN_SECOND_DIVISIONS.flatMap((league) =>
    clubsInLeague(league).filter((club) => club.playable !== false && !exclude.has(club.id)),
  );
  const lowerTop = EUROPEAN_LOWER_TOP_FLIGHTS.flatMap((league) =>
    clubsInLeague(league).filter(
      (club) => club.playable !== false && club.tier >= 4 && !exclude.has(club.id),
    ),
  );
  return [...second, ...lowerTop];
}

function excludeMlsUnlessNorthAmerica(
  clubs: Club[],
  nationId: string | null | undefined,
): Club[] {
  if (nationUsesMlsLower(nationId)) return clubs;
  return clubs.filter((club) => club.league !== 'MLS');
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
  if (nationUsesMlsLower(nationId) && tier >= 5) {
    const mls = shuffle(mlsClubsAtTier(5, exclude));
    const picks = mls.slice(0, count);
    return picks.length >= count
      ? picks
      : [...picks, ...shuffle(mlsClubsAtTier(5, [...exclude, ...picks.map((c) => c.id)]))].slice(0, count);
  }
  if (nationId && getNation(nationId)?.confederation === 'CONMEBOL' && tier >= 5) {
    return shuffle(southAmericanLowerTrialClubs(exclude)).slice(0, count);
  }

  const destinations = trialDestinationCountries(nationId);
  const europeanLower = isEuropeanNation(nationId) && tier >= 5;
  const picks: Club[] = [];
  const takeFrom = (pool: Club[]) => {
    for (const club of pool) {
      if (picks.length >= count) break;
      picks.push(club);
      exclude.push(club.id);
    }
  };
  if (destinations.length > 0) {
    takeFrom(shuffle(excludeMlsUnlessNorthAmerica(clubsInCountries(destinations, tier, exclude), nationId)).slice(0, Math.min(homeLooks, count)));
    if (picks.length < count) {
      takeFrom(shuffle(excludeMlsUnlessNorthAmerica(clubsInCountries(destinations, tier, exclude), nationId)));
    }
    // Pathway nations (Africa→France, Brazil→Iberia) stay in dest countries.
    // Home-league nations (Germany, Spain, …) keep the earned band and
    // world-fill the remaining Elite/Strong slots rather than dropping a tier.
    // European Lower (2 goals or fewer) stays on that geographic map.
    const stayOnDestMap = !isHomeLeagueNation(nationId) || europeanLower;
    if (picks.length < count && stayOnDestMap) {
      for (const nearby of [tier + 1, tier - 1, tier + 2, tier - 2]) {
        if (nearby < 1 || nearby > 5) continue;
        takeFrom(shuffle(excludeMlsUnlessNorthAmerica(
          clubsInCountries(destinations, nearby as ClubTier, exclude),
          nationId,
        )));
      }
      if (!isHomeLeagueNation(nationId)) return picks.slice(0, count);
    }
    if (europeanLower && picks.length < count) {
      takeFrom(shuffle(europeanLowerTrialClubs(exclude)));
      return picks.slice(0, count);
    }
  }
  if (picks.length < count && europeanLower) {
    takeFrom(shuffle(europeanLowerTrialClubs(exclude)));
    return picks.slice(0, count);
  }
  if (picks.length < count) {
    const rest = shuffle(excludeMlsUnlessNorthAmerica(
      clubsByTier(tier).filter((c) => !exclude.includes(c.id)),
      nationId,
    ));
    takeFrom(rest);
  }
  return picks.slice(0, count);
}
