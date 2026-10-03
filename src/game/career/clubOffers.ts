import { CLUBS, clubsByTier, clubsInCountry, SECOND_DIVISIONS, type Club, type ClubTier } from './data/clubs';
import { getNation } from './data/nations';
import { shuffle } from './util';

export const SOUTH_AMERICAN_COUNTRIES = new Set([
  'Brazil',
  'Argentina',
  'Colombia',
  'Chile',
  'Uruguay',
  'Peru',
  'Ecuador',
  'Paraguay',
  'Bolivia',
  'Venezuela',
]);
export const SOUTH_AMERICAN_LEAGUES = new Set(['Brasileirao', 'Liga Profesional', 'Primera A']);

export const HOME_TRANSFER_COUNT = 4;
export const AWAY_HOME_TRANSFER_COUNT = 2;
export const HOST_LOAN_COUNT = 2;

export function offerGeography(
  hostCountry: string | null | undefined,
  nationalityCountry: string | null | undefined,
): {
  atHome: boolean;
  host: string | null;
  home: string | null;
  transferFromHome: number;
  loanFromHost: number;
  loanFromHome: number;
} {
  const host = hostCountry || null;
  const home = nationalityCountry || null;
  const atHome = Boolean(host && home && host === home);
  return {
    atHome,
    host,
    home,
    transferFromHome: atHome ? HOME_TRANSFER_COUNT : AWAY_HOME_TRANSFER_COUNT,
    loanFromHost: HOST_LOAN_COUNT,
    loanFromHome: atHome ? HOST_LOAN_COUNT : 1,
  };
}

export function restrictedOfferRegion(club: Club): 'sa' | 'mexico' | 'japan' | null {
  if (club.country === 'Mexico' || club.league === 'Liga MX') return 'mexico';
  if (club.country === 'Japan' || club.league === 'J1 League') return 'japan';
  if (SOUTH_AMERICAN_COUNTRIES.has(club.country) || SOUTH_AMERICAN_LEAGUES.has(club.league)) return 'sa';
  return null;
}

export function playerCanReceiveRegionClub(
  club: Club,
  nationality: string | null | undefined,
  hostCountry: string | null | undefined,
): boolean {
  const region = restrictedOfferRegion(club);
  if (!region) return true;
  const nation = nationality ? getNation(nationality) : null;
  const homeCountry = nation?.name ?? null;
  if (region === 'sa') {
    return nation?.confederation === 'CONMEBOL'
      || SOUTH_AMERICAN_COUNTRIES.has(hostCountry ?? '')
      || SOUTH_AMERICAN_COUNTRIES.has(homeCountry ?? '');
  }
  if (region === 'mexico') {
    return nationality === 'mexico' || hostCountry === 'Mexico' || homeCountry === 'Mexico';
  }
  return nationality === 'japan' || hostCountry === 'Japan' || homeCountry === 'Japan';
}

export function filterOfferClubs(
  clubs: Club[],
  nationality: string | null | undefined,
  hostCountry: string | null | undefined,
): Club[] {
  return clubs.filter((club) => playerCanReceiveRegionClub(club, nationality, hostCountry));
}

export function pickClubsForOfferWindow(
  preferred: Club[],
  count: number,
  hostCountry: string | null | undefined,
  nationalityCountry: string | null | undefined,
  extra: Club[] = [],
): Club[] {
  const geo = offerGeography(hostCountry, nationalityCountry);
  const hintTier = preferred[0]?.tier ?? extra[0]?.tier ?? 5;
  const sameTier = (club: Club) => club.tier === hintTier;
  const pool = uniqueById([...preferred, ...extra]).filter(sameTier);
  const taken = new Set<string>();
  const picked: Club[] = [];
  const takeFrom = (country: string | null, n: number) => {
    if (!country || n <= 0) return;
    for (const club of shuffle(pool.filter((item) => item.country === country && !taken.has(item.id)))) {
      if (picked.length >= count || n <= 0) break;
      taken.add(club.id);
      picked.push(club);
      n -= 1;
    }
  };
  takeFrom(geo.home, geo.transferFromHome);
  if (!geo.atHome) takeFrom(geo.host, count - picked.length);
  for (const club of shuffle(pool)) {
    if (picked.length >= count) break;
    if (taken.has(club.id)) continue;
    taken.add(club.id);
    picked.push(club);
  }
  if (picked.length < count) {
    const filler = nearbyTierClubs(hintTier, [...taken]).filter((club) => !SECOND_DIVISIONS.has(club.league) || hintTier >= 4);
    picked.push(...shuffle(filler).slice(0, count - picked.length));
  }
  return picked.slice(0, count);
}

/**
 * Picks `count` clubs, guaranteeing `minFromCountry` of them come from
 * `country` when that country has clubs in the game. Never fills from a
 * different tier than the preferred pool.
 */
export function pickClubsBiasedToCountry(
  preferred: Club[],
  count: number,
  country: string | null | undefined,
  minFromCountry: number,
  extraHome: Club[] = [],
): Club[] {
  const homeCountry = country && CLUBS.some((c) => c.country === country && c.playable !== false) ? country : null;
  const hintTier = preferred[0]?.tier ?? extraHome[0]?.tier ?? 5;
  const sameTier = (club: Club) => club.tier === hintTier;
  if (!homeCountry || minFromCountry <= 0) {
    const pool = preferred.length >= count
      ? preferred
      : [...preferred, ...nearbyTierClubs(hintTier)];
    return uniqueById(shuffle(pool.filter(sameTier))).slice(0, count);
  }

  const homePreferred = preferred.filter((c) => c.country === homeCountry && sameTier(c));
  const homeExtra = extraHome.filter((c) => c.country === homeCountry && sameTier(c));
  const homeNeeded = Math.min(minFromCountry, count, uniqueById([...homePreferred, ...homeExtra]).length);
  const homePicks = uniqueById([...shuffle(homePreferred), ...shuffle(homeExtra)]).slice(0, homeNeeded);
  const taken = new Set(homePicks.map((c) => c.id));
  const remaining = count - homePicks.length;

  const awayPool = preferred.filter((c) => c.country !== homeCountry && !taken.has(c.id) && sameTier(c));
  const awayFallback = nearbyTierClubs(hintTier, [...taken]).filter((c) => c.country !== homeCountry);
  const awayPicks = uniqueById([...shuffle(awayPool), ...shuffle(awayFallback)]).slice(0, remaining);
  awayPicks.forEach((c) => taken.add(c.id));

  if (homePicks.length + awayPicks.length < count) {
    const filler = nearbyTierClubs(hintTier, [...taken]);
    return [...homePicks, ...awayPicks, ...shuffle(filler)].slice(0, count);
  }
  return [...homePicks, ...awayPicks];
}

export function countryForNationality(nationId: string | null | undefined): string | null {
  if (!nationId) return null;
  return getNation(nationId)?.name ?? null;
}

export function clubsForNationality(nationId: string | null | undefined): Club[] {
  const country = countryForNationality(nationId);
  return country ? clubsInCountry(country) : [];
}

/** Clubs at this exact transfer band. Windows never mix levels. */
export function nearbyTierClubs(tier: ClubTier, excludeIds: string[] = []): Club[] {
  return CLUBS.filter((c) => c.playable !== false && !excludeIds.includes(c.id) && c.tier === tier);
}

function uniqueById(clubs: Club[]): Club[] {
  const seen = new Set<string>();
  const out: Club[] = [];
  for (const club of clubs) {
    if (seen.has(club.id)) continue;
    seen.add(club.id);
    out.push(club);
  }
  return out;
}

export function tierPool(tier: ClubTier, excludeIds: string[] = []): Club[] {
  return clubsByTier(tier).filter((c) => !excludeIds.includes(c.id));
}
