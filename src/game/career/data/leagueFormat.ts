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
/** Top six in each conference reach the playoffs. */
export const MLS_PLAYOFF_SPOTS = 6;
/** Seeds 5–6 play a single wild-card; 1–4 go straight to the first round. */
export const MLS_PLAYOFF_WILDCARD_FROM = 5;

export type MlsPlayoffOpening = 'wild-card' | 'first-round' | 'not-qualified';

/** How the MLS bracket opens from conference position (10-team conference). */
export function playoffOpeningForPosition(position: number): MlsPlayoffOpening {
  if (position < 1 || position > MLS_PLAYOFF_SPOTS) return 'not-qualified';
  if (position >= MLS_PLAYOFF_WILDCARD_FROM) return 'wild-card';
  return 'first-round';
}

/** Games left if the player wins every remaining tie from this opening. */
export function playoffGamesFromOpening(opening: MlsPlayoffOpening): number {
  if (opening === 'not-qualified') return 0;
  if (opening === 'wild-card') return 5;
  return 4;
}

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
