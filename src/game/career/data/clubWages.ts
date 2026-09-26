/**
 * Weekly wages in euros. Top earner = starter band. Squad average = the
 * Rising-star first-contract base (10%). MLS and Saudi stay on the old
 * formula and are omitted here.
 */

export const CLUB_TOP_WEEKLY_WAGE: Record<string, number> = {
  'real-madrid': 600_962,
  barcelona: 520_769,
  'atletico-madrid': 400_000,
  athletic: 220_000,
  sevilla: 135_000,
  'real-sociedad': 120_192,
  villarreal: 110_000,
  'real-betis': 110_000,
  valencia: 100_000,
  girona: 85_000,
  espanyol: 60_192,
  'man-city': 612_150,
  liverpool: 466_400,
  'man-united': 437_250,
  arsenal: 437_250,
  chelsea: 291_500,
  newcastle: 233_200,
  'aston-villa': 204_050,
  tottenham: 221_540,
  'west-ham': 174_900,
  'crystal-palace': 151_580,
  everton: 151_580,
  fulham: 139_920,
  'nottingham-forest': 128_260,
  brighton: 116_600,
  leicester: 116_600,
  wolves: 99_110,
  brentford: 104_940,
  bournemouth: 93_280,
  ipswich: 87_450,
  southampton: 81_620,
  bayern: 480_769,
  leverkusen: 230_000,
  dortmund: 181_346,
  leipzig: 150_000,
  stuttgart: 110_000,
  frankfurt: 100_000,
  wolfsburg: 90_000,
  hamburg: 72_500,
  gladbach: 80_000,
  inter: 320_577,
  juventus: 213_654,
  'ac-milan': 178_077,
  napoli: 200_000,
  roma: 142_500,
  atalanta: 115_000,
  lazio: 100_000,
  fiorentina: 85_000,
  bologna: 70_000,
  psg: 346_000,
  marseille: 95_000,
  lyon: 85_000,
  monaco: 70_000,
  lille: 60_000,
  nice: 55_000,
  rennes: 50_000,
  galatasaray: 410_000,
  besiktas: 115_000,
  fenerbahce: 110_000,
  benfica: 75_000,
  sporting: 60_000,
  porto: 55_000,
  ajax: 75_000,
  psv: 45_000,
  feyenoord: 40_000,
};

export const CLUB_AVERAGE_WEEKLY_WAGE: Record<string, number> = {
  'real-madrid': 202_692,
  barcelona: 144_135,
  'atletico-madrid': 99_231,
  athletic: 62_365,
  'real-sociedad': 38_788,
  sevilla: 36_923,
  villarreal: 31_538,
  'real-betis': 30_385,
  valencia: 23_462,
  girona: 20_192,
  espanyol: 16_154,
  arsenal: 186_596,
  liverpool: 177_212,
  'man-city': 175_038,
  'man-united': 133_788,
  chelsea: 108_404,
  'aston-villa': 100_654,
  newcastle: 96_481,
  tottenham: 94_385,
  everton: 91_788,
  'west-ham': 74_038,
  fulham: 71_538,
  'crystal-palace': 68_115,
  brighton: 55_346,
  'nottingham-forest': 53_192,
  brentford: 51_846,
  bournemouth: 44_096,
  wolves: 41_346,
  leicester: 38_077,
  ipswich: 28_077,
  southampton: 25_769,
  bayern: 184_577,
  leverkusen: 70_692,
  dortmund: 68_058,
  leipzig: 47_500,
  stuttgart: 35_577,
  wolfsburg: 31_154,
  frankfurt: 29_615,
  gladbach: 24_615,
  hamburg: 17_692,
  inter: 102_077,
  juventus: 84_038,
  roma: 66_577,
  napoli: 64_481,
  'ac-milan': 63_577,
  atalanta: 51_096,
  lazio: 43_269,
  fiorentina: 32_308,
  bologna: 23_846,
  psg: 143_615,
  marseille: 37_308,
  lyon: 35_000,
  monaco: 31_731,
  lille: 23_269,
  nice: 21_923,
  rennes: 19_615,
  galatasaray: 56_731,
  fenerbahce: 40_385,
  besiktas: 35_577,
  benfica: 27_308,
  ajax: 23_846,
  sporting: 22_115,
  porto: 18_846,
  psv: 15_577,
  feyenoord: 13_269,
};

export function isListedWageClub(clubId: string): boolean {
  return clubId in CLUB_TOP_WEEKLY_WAGE || clubId in CLUB_AVERAGE_WEEKLY_WAGE;
}

export function listedTopWage(clubId: string): number | null {
  return CLUB_TOP_WEEKLY_WAGE[clubId] ?? null;
}

export function listedAverageWage(clubId: string): number | null {
  return CLUB_AVERAGE_WEEKLY_WAGE[clubId] ?? null;
}

/** Unlisted European clubs sit well below the cheapest listed side in that league. */
export const UNLISTED_WAGE_FACTOR = 0.38;
/** Typical squad-average / top-earner split when a club has no published average. */
export const UNLISTED_AVERAGE_TO_TOP = 0.34;

const LISTED_LEAGUES = new Set([
  'Premier League',
  'La Liga',
  'Bundesliga',
  'Serie A',
  'Ligue 1',
  'Super Lig',
  'Primeira Liga',
  'Eredivisie',
]);

export function leagueHasListedWages(league: string | null | undefined): boolean {
  return Boolean(league && LISTED_LEAGUES.has(league));
}

export function usesPublishedWages(league: string | null | undefined): boolean {
  if (!league) return false;
  if (league === 'MLS' || league === 'Saudi Pro League') return false;
  return leagueHasListedWages(league);
}

export function cheapestListedTopWage(league: string, clubLeagueOf: (clubId: string) => string | undefined): number | null {
  let cheapest: number | null = null;
  for (const [clubId, wage] of Object.entries(CLUB_TOP_WEEKLY_WAGE)) {
    if (clubLeagueOf(clubId) !== league) continue;
    if (cheapest == null || wage < cheapest) cheapest = wage;
  }
  return cheapest;
}

export function cheapestListedAverageWage(league: string, clubLeagueOf: (clubId: string) => string | undefined): number | null {
  let cheapest: number | null = null;
  for (const [clubId, wage] of Object.entries(CLUB_AVERAGE_WEEKLY_WAGE)) {
    if (clubLeagueOf(clubId) !== league) continue;
    if (cheapest == null || wage < cheapest) cheapest = wage;
  }
  return cheapest;
}

export function unlistedTopWage(league: string, clubLeagueOf: (clubId: string) => string | undefined): number | null {
  const cheapest = cheapestListedTopWage(league, clubLeagueOf);
  if (cheapest == null) return null;
  return cheapest * UNLISTED_WAGE_FACTOR;
}

export function unlistedAverageWage(league: string, clubLeagueOf: (clubId: string) => string | undefined): number | null {
  const cheapestAvg = cheapestListedAverageWage(league, clubLeagueOf);
  if (cheapestAvg != null) return cheapestAvg * UNLISTED_WAGE_FACTOR;
  const top = unlistedTopWage(league, clubLeagueOf);
  return top == null ? null : top * UNLISTED_AVERAGE_TO_TOP;
}

export function starterWageForClubId(
  clubId: string,
  league: string,
  clubLeagueOf: (id: string) => string | undefined,
): number | null {
  if (!usesPublishedWages(league)) return null;
  if (CLUB_TOP_WEEKLY_WAGE[clubId] != null && clubLeagueOf(clubId) === league) {
    return CLUB_TOP_WEEKLY_WAGE[clubId];
  }
  return unlistedTopWage(league, clubLeagueOf);
}

export function averageWageForClubId(
  clubId: string,
  league: string,
  clubLeagueOf: (id: string) => string | undefined,
): number | null {
  if (!usesPublishedWages(league)) return null;
  if (CLUB_AVERAGE_WEEKLY_WAGE[clubId] != null && clubLeagueOf(clubId) === league) {
    return CLUB_AVERAGE_WEEKLY_WAGE[clubId];
  }
  if (CLUB_TOP_WEEKLY_WAGE[clubId] != null && clubLeagueOf(clubId) === league) {
    return CLUB_TOP_WEEKLY_WAGE[clubId] * UNLISTED_AVERAGE_TO_TOP;
  }
  return unlistedAverageWage(league, clubLeagueOf);
}
