import type { Club, ClubTier } from './clubs';

/**
 * Confederations group nations for international call-ups and the
 * continental international tournament (this game's Euros-equivalent) - kept
 * separate from a club's *domestic* league/country, since a player's
 * nationality is a free choice independent of who they play club football
 * for. Only the confederations covered by the current club pyramid (see
 * clubs.ts) are listed; more can be added without touching any game logic.
 */
export type Confederation = 'UEFA' | 'CONCACAF' | 'AFC';

const COUNTRY_CONFEDERATION: Record<string, Confederation> = {
  England: 'UEFA',
  Spain: 'UEFA',
  Italy: 'UEFA',
  Germany: 'UEFA',
  France: 'UEFA',
  'Saudi Arabia': 'AFC',
  'United States': 'CONCACAF',
};

export function confederationForCountry(country: string): Confederation {
  return COUNTRY_CONFEDERATION[country] ?? 'UEFA';
}

export type CompetitionKind = 'domestic-league' | 'continental-cup' | 'international-tournament' | 'super-cup';

/**
 * A single unified shape for anything the calendar can schedule a fixture
 * against: the player's domestic league, a continental club cup, the annual
 * Super Cup, or an international tournament. `id` is stable and used to key
 * standings/results once the season 2-20 simulation exists.
 */
export interface Competition {
  id: string;
  name: string;
  kind: CompetitionKind;
  confederation?: Confederation;
}

export function domesticLeagueCompetition(club: Club): Competition {
  return { id: `league:${slug(club.league)}`, name: club.league, kind: 'domestic-league' };
}

export type ContinentalCupId = 'ucl' | 'uel' | 'uecl';

export const CONTINENTAL_CUPS: Record<ContinentalCupId, Competition> = {
  ucl: { id: 'ucl', name: 'Champions League', kind: 'continental-cup', confederation: 'UEFA' },
  uel: { id: 'uel', name: 'Europa League', kind: 'continental-cup', confederation: 'UEFA' },
  uecl: { id: 'uecl', name: 'Conference League', kind: 'continental-cup', confederation: 'UEFA' },
};

export const SUPER_CUP: Competition = { id: 'super-cup', name: 'Super Cup', kind: 'super-cup', confederation: 'UEFA' };

/**
 * Which continental cup (if any) a club plays in a given season.
 *
 * There's no club-growth system yet (the pyramid is fixed for all 20
 * seasons, per the locked design), so qualification is derived straight from
 * the club's tier rather than an actual final league position - tier 1 clubs
 * are Champions League regulars, tier 2 fight it out in the Europa League,
 * tier 3 gets a Conference League run, and tiers 4-5 have no European
 * football. Only UEFA clubs have a continental cup modelled for now; AFC
 * Champions League / Concacaf Champions Cup can slot in behind this same
 * function later without touching any calendar/chance-engine code.
 */
export function continentalCupForClub(tier: ClubTier, confederation: Confederation): ContinentalCupId | null {
  if (confederation !== 'UEFA') return null;
  if (tier === 1) return 'ucl';
  if (tier === 2) return 'uel';
  if (tier === 3) return 'uecl';
  return null;
}

export type InternationalTournamentId = 'world-cup' | 'continental-championship';

export const INTERNATIONAL_TOURNAMENTS: Record<InternationalTournamentId, Competition> = {
  'world-cup': { id: 'world-cup', name: 'World Cup', kind: 'international-tournament' },
  'continental-championship': { id: 'continental-championship', name: 'Continental Championship', kind: 'international-tournament' },
};

/**
 * The World Cup and the continental championship alternate on a two-year
 * cadence, starting in the player's 2nd season (the first season with a
 * real, opponent-having calendar) - e.g. seasons 2, 4, 6, 8..., alternating
 * which tournament is on. Season numbers stand in for real-world years since
 * every career starts at age 16 in "season 1".
 */
export function internationalTournamentForSeason(seasonNumber: number): InternationalTournamentId | null {
  if (seasonNumber < 2 || seasonNumber % 2 !== 0) return null;
  return seasonNumber % 4 === 0 ? 'world-cup' : 'continental-championship';
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
