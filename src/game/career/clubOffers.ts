import { CLUBS, clubsByTier, clubsInCountry, type Club, type ClubTier } from './data/clubs';
import { getNation } from './data/nations';
import { shuffle } from './util';

/**
 * Picks `count` clubs, guaranteeing `minFromCountry` of them come from
 * `country` when that country has clubs in the game. Never fills from a
 * stronger (lower-number) tier than the preferred pool.
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
  const sameOrWorse = (club: Club) => club.tier >= hintTier;
  if (!homeCountry || minFromCountry <= 0) {
    const pool = preferred.length >= count
      ? preferred
      : [...preferred, ...nearbyTierClubs(hintTier)];
    return uniqueById(shuffle(pool.filter(sameOrWorse))).slice(0, count);
  }

  const homePreferred = preferred.filter((c) => c.country === homeCountry && sameOrWorse(c));
  const homeExtra = extraHome.filter((c) => c.country === homeCountry && sameOrWorse(c));
  const homeNeeded = Math.min(minFromCountry, count, uniqueById([...homePreferred, ...homeExtra]).length);
  const homePicks = uniqueById([...shuffle(homePreferred), ...shuffle(homeExtra)]).slice(0, homeNeeded);
  const taken = new Set(homePicks.map((c) => c.id));
  const remaining = count - homePicks.length;

  const awayPool = preferred.filter((c) => c.country !== homeCountry && !taken.has(c.id) && sameOrWorse(c));
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

/** Same tier, then one step weaker. Never a better (lower-number) tier. */
export function nearbyTierClubs(tier: ClubTier, excludeIds: string[] = []): Club[] {
  const sameOrWorse = CLUBS.filter(
    (c) => c.playable !== false && !excludeIds.includes(c.id) && c.tier >= tier && c.tier <= Math.min(5, tier + 1),
  );
  if (sameOrWorse.length > 0) return sameOrWorse;
  return CLUBS.filter((c) => c.playable !== false && !excludeIds.includes(c.id) && c.tier >= tier);
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
