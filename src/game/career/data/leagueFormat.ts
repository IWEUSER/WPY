export type MlsConference = 'east' | 'west';

export const MLS_EAST = new Set([
  'inter-miami',
  'columbus',
  'philadelphia',
  'cincinnati',
  'atlanta',
  'nycfc',
  'chicago',
  'orlando',
  'montreal',
  'toronto',
  'new-england',
  'ny-red-bulls',
  'charlotte',
  'dc-united',
]);

export const MLS_WEST = new Set([
  'lafc',
  'seattle',
  'kansas-city',
  'nashville',
  'la-galaxy',
  'portland',
  'austin',
  'minnesota',
  'dallas',
  'houston',
  'vancouver',
  'colorado',
  'salt-lake',
  'st-louis',
]);

/** 10 per conference so the regular season stays compact. */
export const MLS_CONFERENCE_SIZE = 10;
/** Home-and-away in conference (18) plus 8 interconference games. */
export const MLS_REGULAR_SEASON_WEEKS = 26;
export const MLS_PLAYOFF_SPOTS = 6;

export function mlsConferenceOf(id: string): MlsConference | null {
  if (MLS_EAST.has(id)) return 'east';
  if (MLS_WEST.has(id)) return 'west';
  return null;
}

export function conferenceLabel(conference: MlsConference | null | undefined): string {
  if (conference === 'east') return 'Eastern Conference';
  if (conference === 'west') return 'Western Conference';
  return 'MLS';
}

export function leagueDisplayName(league: string | null | undefined): string {
  if (league === 'Saudi Pro League') return 'Roshn Saudi League';
  if (league === 'MLS') return 'MLS';
  return league ?? '';
}

export function isMlsLeague(league: string | null | undefined): boolean {
  return league === 'MLS';
}

export function isSaudiLeague(league: string | null | undefined): boolean {
  return league === 'Saudi Pro League';
}
