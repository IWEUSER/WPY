import { CLUBS, clubsByTier, clubsInCountry, type Club, type ClubTier } from './data/clubs';
import { getNation } from './data/nations';
import { shuffle } from './util';

/**
 * Picks `count` clubs, guaranteeing `minFromCountry` of them come from
 * `country` when that country has clubs in the game. Falls back to the
 * global pool when it doesn't (Brazil, etc.).
 */
export function pickClubsBiasedToCountry(
  preferred: Club[],
  count: number,
  country: string | null | undefined,
  minFromCountry: number,
  extraHome: Club[] = [],
): Club[] {
  const homeCountry = country && CLUBS.some((c) => c.country === country) ? country : null;
  if (!homeCountry || minFromCountry <= 0) {
    const pool = preferred.length >= count ? preferred : [...preferred, ...CLUBS];
    return uniqueById(shuffle(pool)).slice(0, count);
  }

  const homePreferred = preferred.filter((c) => c.country === homeCountry);
  const homeExtra = extraHome.filter((c) => c.country === homeCountry);
  const homeNeeded = Math.min(minFromCountry, count, uniqueById([...homePreferred, ...homeExtra]).length);
  const homePicks = uniqueById([...shuffle(homePreferred), ...shuffle(homeExtra)]).slice(0, homeNeeded);
  const taken = new Set(homePicks.map((c) => c.id));
  const remaining = count - homePicks.length;

  const awayPool = preferred.filter((c) => c.country !== homeCountry && !taken.has(c.id));
  const awayFallback = CLUBS.filter((c) => c.country !== homeCountry && !taken.has(c.id));
  const awayPicks = uniqueById([...shuffle(awayPool), ...shuffle(awayFallback)]).slice(0, remaining);
  awayPicks.forEach((c) => taken.add(c.id));

  if (homePicks.length + awayPicks.length < count) {
    const filler = CLUBS.filter((c) => !taken.has(c.id));
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

export function nearbyTierClubs(tier: ClubTier, excludeIds: string[] = []): Club[] {
  const nearby = CLUBS.filter((c) => !excludeIds.includes(c.id) && Math.abs(c.tier - tier) <= 1);
  return nearby.length > 0 ? nearby : CLUBS.filter((c) => !excludeIds.includes(c.id));
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
  let pool = clubsByTier(tier).filter((c) => !excludeIds.includes(c.id));
  if (pool.length === 0) pool = nearbyTierClubs(tier, excludeIds);
  return pool;
}
