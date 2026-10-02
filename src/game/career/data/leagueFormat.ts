import { LEAGUE_DISPLAY_NAMES } from './displayNames';

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

/** Full 14-club conferences so the regular season uses every MLS side. */
export const MLS_CONFERENCE_SIZE = 14;
/** Home-and-away in conference (26) plus 8 interconference games. */
export const MLS_REGULAR_SEASON_WEEKS = 34;
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
  return 'American League';
}

export function leagueDisplayName(league: string | null | undefined): string {
  if (!league) return '';
  return LEAGUE_DISPLAY_NAMES[league] ?? league;
}

export function isMlsLeague(league: string | null | undefined): boolean {
  return league === 'MLS';
}

export function isSaudiLeague(league: string | null | undefined): boolean {
  return league === 'Saudi Pro League';
}

export type ArgentinaGroup = 'A' | 'B';

/** Group A of the 30-club Argentine league. */
export const ARGENTINA_GROUP_A = new Set([
  'instituto',
  'velez',
  'defensa',
  'gimnasia-mza',
  'boca-juniors',
  'independiente',
  'lanus',
  'newells',
  'union-sf',
  'san-lorenzo',
  'estudiantes',
  'riestra',
  'platense',
  'talleres',
  'central-cordoba',
]);

/** Group B of the 30-club Argentine league. */
export const ARGENTINA_GROUP_B = new Set([
  'argentinos',
  'rosario-central',
  'independiente-riv',
  'gimnasia-lp',
  'belgrano',
  'huracan',
  'sarmiento',
  'river-plate',
  'atletico-tucuman',
  'tigre',
  'barracas',
  'banfield',
  'aldosivi',
  'racing-club',
  'estudiantes-rc',
]);

/** 14 intra-group games plus 2 interzonal games. */
export const ARGENTINA_GROUP_WEEKS = 16;
/** Top eight from each group reach the knockout. */
export const ARGENTINA_KNOCKOUT_SPOTS = 8;

export function argentinaGroupOf(id: string): ArgentinaGroup | null {
  if (ARGENTINA_GROUP_A.has(id)) return 'A';
  if (ARGENTINA_GROUP_B.has(id)) return 'B';
  return null;
}

export function isArgentineLeague(league: string | null | undefined): boolean {
  return league === 'Liga Profesional';
}

export function argentinaGroupLabel(group: ArgentinaGroup | null | undefined): string {
  if (group === 'A') return 'Group A';
  if (group === 'B') return 'Group B';
  return 'Argentine League';
}
