import type { Club, ClubTier } from './clubs';
import { confederationForCountry as confederationForNationCountry } from './nations';

/**
 * Confederations group nations for international call-ups and the
 * continental championship the player's country qualifies for.
 */
export type Confederation = 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'AFC' | 'OFC';

export function confederationForCountry(country: string): Confederation {
  return confederationForNationCountry(country);
}

export type CompetitionKind =
  | 'domestic-league'
  | 'domestic-cup'
  | 'continental-cup'
  | 'international-tournament'
  | 'super-cup';

/**
 * A single unified shape for anything the calendar can schedule a fixture
 * against: the player's domestic league, a continental club cup, the annual
 * Super Cup, a domestic knockout cup, or an international tournament.
 */
export interface Competition {
  id: string;
  name: string;
  kind: CompetitionKind;
  confederation?: Confederation;
  country?: string;
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

export type DomesticCupId =
  | 'fa-cup'
  | 'copa-del-rey'
  | 'coppa-italia'
  | 'dfb-pokal'
  | 'coupe-de-france'
  | 'kings-cup'
  | 'us-open-cup';

export const DOMESTIC_CUPS: Record<DomesticCupId, Competition> = {
  'fa-cup': { id: 'fa-cup', name: 'FA Cup', kind: 'domestic-cup', country: 'England' },
  'copa-del-rey': { id: 'copa-del-rey', name: 'Copa del Rey', kind: 'domestic-cup', country: 'Spain' },
  'coppa-italia': { id: 'coppa-italia', name: 'Coppa Italia', kind: 'domestic-cup', country: 'Italy' },
  'dfb-pokal': { id: 'dfb-pokal', name: 'DFB-Pokal', kind: 'domestic-cup', country: 'Germany' },
  'coupe-de-france': { id: 'coupe-de-france', name: 'Coupe de France', kind: 'domestic-cup', country: 'France' },
  'kings-cup': { id: 'kings-cup', name: "King's Cup", kind: 'domestic-cup', country: 'Saudi Arabia' },
  'us-open-cup': { id: 'us-open-cup', name: 'US Open Cup', kind: 'domestic-cup', country: 'United States' },
};

const DOMESTIC_CUP_BY_COUNTRY: Record<string, DomesticCupId> = {
  England: 'fa-cup',
  Spain: 'copa-del-rey',
  Italy: 'coppa-italia',
  Germany: 'dfb-pokal',
  France: 'coupe-de-france',
  'Saudi Arabia': 'kings-cup',
  'United States': 'us-open-cup',
};

export function domesticCupForCountry(country: string): DomesticCupId | null {
  return DOMESTIC_CUP_BY_COUNTRY[country] ?? null;
}

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

export type InternationalTournamentId =
  | 'world-cup'
  | 'euro'
  | 'copa-america'
  | 'gold-cup'
  | 'afcon'
  | 'asian-cup'
  | 'ofc-nations-cup'
  | 'continental-championship';

export const INTERNATIONAL_TOURNAMENTS: Record<InternationalTournamentId, Competition> = {
  'world-cup': { id: 'world-cup', name: 'World Cup', kind: 'international-tournament' },
  euro: { id: 'euro', name: 'European Championship', kind: 'international-tournament', confederation: 'UEFA' },
  'copa-america': {
    id: 'copa-america',
    name: 'Copa América',
    kind: 'international-tournament',
    confederation: 'CONMEBOL',
  },
  'gold-cup': { id: 'gold-cup', name: 'Gold Cup', kind: 'international-tournament', confederation: 'CONCACAF' },
  afcon: { id: 'afcon', name: 'Africa Cup of Nations', kind: 'international-tournament', confederation: 'CAF' },
  'asian-cup': { id: 'asian-cup', name: 'AFC Asian Cup', kind: 'international-tournament', confederation: 'AFC' },
  'ofc-nations-cup': {
    id: 'ofc-nations-cup',
    name: 'OFC Nations Cup',
    kind: 'international-tournament',
    confederation: 'OFC',
  },
  /** Legacy id kept so older saves still resolve a label. */
  'continental-championship': {
    id: 'continental-championship',
    name: 'Continental Championship',
    kind: 'international-tournament',
  },
};

export const CONTINENTAL_TOURNAMENT_FOR_CONFEDERATION: Record<Confederation, InternationalTournamentId> = {
  UEFA: 'euro',
  CONMEBOL: 'copa-america',
  CONCACAF: 'gold-cup',
  CAF: 'afcon',
  AFC: 'asian-cup',
  OFC: 'ofc-nations-cup',
};

/**
 * The World Cup and the player's continental championship alternate on a
 * two-year cadence, starting in the player's 2nd season (the first season
 * with a real, opponent-having calendar) - seasons 2, 6, 10… are continental,
 * seasons 4, 8, 12… are the World Cup.
 */
export function internationalTournamentForSeason(
  seasonNumber: number,
  confederation?: Confederation | null,
): InternationalTournamentId | null {
  if (seasonNumber < 2 || seasonNumber % 2 !== 0) return null;
  if (seasonNumber % 4 === 0) return 'world-cup';
  if (confederation) return CONTINENTAL_TOURNAMENT_FOR_CONFEDERATION[confederation];
  return 'continental-championship';
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
