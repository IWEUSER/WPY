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

export type ContinentalCupId = 'ucl' | 'uel' | 'uecl' | 'acle' | 'leagues-cup';

export const CONTINENTAL_CUPS: Record<ContinentalCupId, Competition> = {
  ucl: { id: 'ucl', name: 'Champions League', kind: 'continental-cup', confederation: 'UEFA' },
  uel: { id: 'uel', name: 'Europa League', kind: 'continental-cup', confederation: 'UEFA' },
  uecl: { id: 'uecl', name: 'Conference League', kind: 'continental-cup', confederation: 'UEFA' },
  acle: {
    id: 'acle',
    name: 'AFC Champions League Elite',
    kind: 'continental-cup',
    confederation: 'AFC',
  },
  'leagues-cup': {
    id: 'leagues-cup',
    name: 'Leagues Cup',
    kind: 'continental-cup',
    confederation: 'CONCACAF',
  },
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
  'kings-cup': { id: 'kings-cup', name: 'King Cup', kind: 'domestic-cup', country: 'Saudi Arabia' },
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
 * football. AFC clubs in the top two tiers play the Champions League Elite;
 * MLS sides play Leagues Cup instead of a year-long continental league.
 */
/** Saudi top four plus the AFC guest sides that fill out the Elite draw. */
export function clubContinentalCup(club: Club): ContinentalCupId | null {
  if (club.league === 'Saudi Pro League') {
    return club.strength >= 76 ? 'acle' : null;
  }
  const conf = confederationForCountry(club.country);
  if (conf === 'AFC' && club.playable === false) return 'acle';
  return continentalCupForClub(club.tier, conf);
}

export function continentalCupForClub(tier: ClubTier, confederation: Confederation): ContinentalCupId | null {
  if (confederation === 'AFC') {
    if (tier <= 2) return 'acle';
    return null;
  }
  if (confederation === 'CONCACAF') {
    return null;
  }
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
 * International calendar (internal season numbers; the reserve year is 1):
 *  - Season 1: no international football (reserves; player is not involved).
 *  - Season 2, 6, 10…: remaining World Cup qualifiers (first half of the
 *    campaign was played in the unused reserve year), then the World Cup.
 *  - Season 3, 7, 11…: first half of continental qualifying.
 *  - Season 4, 8, 12…: second half of continental qualifying, then the
 *    tournament (Euros / Copa / AFCON / …).
 */
export type InternationalCampaignPhase = 'none' | 'qualifiers' | 'qualifiers-and-tournament';

export interface InternationalCampaign {
  tournament: InternationalTournamentId | null;
  phase: InternationalCampaignPhase;
  /** How many qualifying matches the player is involved in this season. */
  qualifierGames: number;
}

export function internationalCampaignForSeason(
  seasonNumber: number,
  confederation?: Confederation | null,
): InternationalCampaign {
  if (seasonNumber < 2) return { tournament: null, phase: 'none', qualifierGames: 0 };
  const cycle = (seasonNumber - 2) % 4;
  if (cycle === 3) return { tournament: null, phase: 'none', qualifierGames: 0 };
  if (cycle === 0) {
    return { tournament: 'world-cup', phase: 'qualifiers-and-tournament', qualifierGames: 3 };
  }
  const continental = confederation
    ? CONTINENTAL_TOURNAMENT_FOR_CONFEDERATION[confederation]
    : 'continental-championship';
  const full = continental === 'copa-america' || continental === 'gold-cup' || continental === 'ofc-nations-cup' ? 4 : 6;
  const firstHalf = Math.floor(full / 2);
  const secondHalf = Math.ceil(full / 2);
  return {
    tournament: continental,
    phase: cycle === 1 ? 'qualifiers' : 'qualifiers-and-tournament',
    qualifierGames: cycle === 1 ? firstHalf : secondHalf,
  };
}

export function isInternationalFinalsSeason(seasonNumber: number): boolean {
  return internationalCampaignForSeason(seasonNumber).phase === 'qualifiers-and-tournament';
}

/**
 * Tournament the season is building towards (qualifiers or finals). Null in
 * off-years and season 1.
 */
export function internationalTournamentForSeason(
  seasonNumber: number,
  confederation?: Confederation | null,
): InternationalTournamentId | null {
  return internationalCampaignForSeason(seasonNumber, confederation).tournament;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
