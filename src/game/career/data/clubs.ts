import { MLS_CONFERENCE_SIZE, MLS_REGULAR_SEASON_WEEKS, mlsConferenceOf } from './leagueFormat';

/**
 * The football pyramid this career mode plays out across: major European
 * leagues plus Saudi Arabia and MLS, each at its real division size.
 * Tiers 1 (elite) through 5 (smallest) exist so the trial and transfer
 * logic has real headroom.
 *
 * `strength` (roughly 50–95) drives match simulation. Tier still decides
 * trial/transfer pools and European qualification; strength decides who
 * actually wins leagues so a mid-table side cannot realistically take the title.
 */

/**
 * 1 = elite. Assigned globally from strength, then capped so MLS is never
 * elite and Saudi clubs sit above MLS but below Europe's top tier.
 */
export type ClubTier = 1 | 2 | 3 | 4 | 5;

export const TIER_LABEL: Record<ClubTier, string> = {
  1: 'Elite',
  2: 'Strong',
  3: 'Mid-table',
  4: 'Lower league',
  5: 'Smallest club in the game',
};

export const SECOND_DIVISIONS = new Set([
  'Championship',
  'La Liga 2',
  'Serie B',
  '2. Bundesliga',
  'Ligue 2',
]);

/** Second-tier league → the top flight it promotes into. */
export const PROMOTION_TARGET: Record<string, string> = {
  Championship: 'Premier League',
  'La Liga 2': 'La Liga',
  'Serie B': 'Serie A',
  '2. Bundesliga': 'Bundesliga',
  'Ligue 2': 'Ligue 1',
};

export function promotionTarget(league: string): string | null {
  return PROMOTION_TARGET[league] ?? null;
}

export function earnedPromotion(league: string, position: number | null | undefined): boolean {
  return Boolean(promotionTarget(league) && position != null && position <= 2);
}

/** MLS is a 28-club pool; a season uses 20 so the calendar stays ≤ 48 weeks. */
export const MLS_SEASON_CLUBS = 20;

/** Floor on the numeric tier (1 is best). MLS never 1–2; Saudi never 1. */
export function leagueTierFloor(country: string, league: string): ClubTier {
  if (league === 'MLS' || country === 'United States') return 3;
  if (country === 'Saudi Arabia' || league === 'Saudi Pro League') return 2;
  if (SECOND_DIVISIONS.has(league)) return 4;
  return 1;
}

/** One global strength scale — not a separate "elite" per country. */
export function tierFromStrength(strength: number): ClubTier {
  if (strength >= 88) return 1;
  if (strength >= 82) return 2;
  if (strength >= 74) return 3;
  if (strength >= 64) return 4;
  return 5;
}

export function assignClubTier(country: string, league: string, strength: number): ClubTier {
  const fromStrength = tierFromStrength(strength);
  const floor = leagueTierFloor(country, league);
  return Math.max(fromStrength, floor) as ClubTier;
}

export interface Club {
  id: string;
  name: string;
  country: string;
  league: string;
  /** MLS Eastern or Western Conference. */
  conference?: 'east' | 'west';
  /** False for cup-only guests (Liga MX, AFC) that are not career destinations. */
  playable?: boolean;
  tier: ClubTier;
  /**
   * Overall squad quality used by the match engine. Independent of `tier`
   * so two clubs in the same transfer band can still be miles apart in a
   * title race (Bayern vs Mainz).
   */
  strength: number;
  /** Accent color used for this club's cards/badges in the UI. */
  color: string;
  /**
   * Goals-per-game required in the reserves during Season 1 to earn
   * promotion to the first team. Bigger clubs demand more because
   * competition for a first-team place is fiercer.
   */
  reserveGoalRatio: number;
  /**
   * Goals-per-game a first-team player is expected to maintain to keep
   * their place / avoid being sold once established.
   */
  firstTeamGoalRatio: number;
}

/** Strength range of the current pyramid, used to scale ratios and chances. */
export const STRENGTH_FLOOR = 52;
export const STRENGTH_CEILING = 94;
export const MIN_GOAL_RATIO = 0.25;
export const MAX_GOAL_RATIO = 0.75;

export function clampStrength(strength: number): number {
  return Math.min(STRENGTH_CEILING, Math.max(STRENGTH_FLOOR, strength));
}

/**
 * First-team (and reserve) goals-per-game bar: 0.75 at the strongest clubs
 * down to 0.25 at the weakest.
 */
export function goalRatioFromStrength(strength: number): number {
  const t = (clampStrength(strength) - STRENGTH_FLOOR) / (STRENGTH_CEILING - STRENGTH_FLOOR);
  return Math.round((MIN_GOAL_RATIO + t * (MAX_GOAL_RATIO - MIN_GOAL_RATIO)) * 100) / 100;
}

const CLUB_SEED: Club[] = [
  // England - Premier League
  { id: 'man-city', name: 'Manchester City', country: 'England', league: 'Premier League', tier: 1, strength: 94, color: '#6CABDD', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'liverpool', name: 'Liverpool', country: 'England', league: 'Premier League', tier: 1, strength: 93, color: '#C8102E', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'arsenal', name: 'Arsenal', country: 'England', league: 'Premier League', tier: 2, strength: 88, color: '#EF0107', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'chelsea', name: 'Chelsea', country: 'England', league: 'Premier League', tier: 2, strength: 84, color: '#034694', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'newcastle', name: 'Newcastle United', country: 'England', league: 'Premier League', tier: 3, strength: 79, color: '#241F20', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'aston-villa', name: 'Aston Villa', country: 'England', league: 'Premier League', tier: 3, strength: 78, color: '#95BFE5', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'crystal-palace', name: 'Crystal Palace', country: 'England', league: 'Premier League', tier: 4, strength: 68, color: '#1B458F', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'everton', name: 'Everton', country: 'England', league: 'Premier League', tier: 4, strength: 67, color: '#003399', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'luton', name: 'Luton Town', country: 'England', league: 'Championship', tier: 5, strength: 52, color: '#F78F1E', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  // Spain - La Liga
  { id: 'real-madrid', name: 'Real Madrid', country: 'Spain', league: 'La Liga', tier: 1, strength: 94, color: '#FFFFFF', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'barcelona', name: 'Barcelona', country: 'Spain', league: 'La Liga', tier: 1, strength: 91, color: '#A50044', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'atletico-madrid', name: 'Atl\u00e9tico Madrid', country: 'Spain', league: 'La Liga', tier: 2, strength: 86, color: '#CB3524', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'real-sociedad', name: 'Real Sociedad', country: 'Spain', league: 'La Liga', tier: 2, strength: 80, color: '#0A3F87', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'villarreal', name: 'Villarreal', country: 'Spain', league: 'La Liga', tier: 3, strength: 76, color: '#FFE667', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'real-betis', name: 'Real Betis', country: 'Spain', league: 'La Liga', tier: 3, strength: 75, color: '#00954C', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'getafe', name: 'Getafe', country: 'Spain', league: 'La Liga', tier: 4, strength: 66, color: '#005999', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'celta-vigo', name: 'Celta Vigo', country: 'Spain', league: 'La Liga', tier: 4, strength: 65, color: '#8AC3EE', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'almeria', name: 'Almer\u00eda', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 52, color: '#D2122E', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  // Italy - Serie A
  { id: 'inter', name: 'Inter Milan', country: 'Italy', league: 'Serie A', tier: 1, strength: 90, color: '#03256C', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'napoli', name: 'Napoli', country: 'Italy', league: 'Serie A', tier: 1, strength: 86, color: '#12A0D7', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'ac-milan', name: 'AC Milan', country: 'Italy', league: 'Serie A', tier: 2, strength: 85, color: '#FB090B', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'juventus', name: 'Juventus', country: 'Italy', league: 'Serie A', tier: 2, strength: 84, color: '#000000', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'atalanta', name: 'Atalanta', country: 'Italy', league: 'Serie A', tier: 3, strength: 80, color: '#1E71B8', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'roma', name: 'Roma', country: 'Italy', league: 'Serie A', tier: 3, strength: 79, color: '#8E1F2F', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'torino', name: 'Torino', country: 'Italy', league: 'Serie A', tier: 4, strength: 70, color: '#881D23', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'fiorentina', name: 'Fiorentina', country: 'Italy', league: 'Serie A', tier: 4, strength: 72, color: '#492E7C', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'salernitana', name: 'Salernitana', country: 'Italy', league: 'Serie B', tier: 5, strength: 52, color: '#7B1E3A', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  // Germany - Bundesliga
  { id: 'bayern', name: 'Bayern Munich', country: 'Germany', league: 'Bundesliga', tier: 1, strength: 94, color: '#DC052D', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'leverkusen', name: 'Bayer Leverkusen', country: 'Germany', league: 'Bundesliga', tier: 1, strength: 86, color: '#E32219', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'leipzig', name: 'RB Leipzig', country: 'Germany', league: 'Bundesliga', tier: 2, strength: 83, color: '#DD0741', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'dortmund', name: 'Borussia Dortmund', country: 'Germany', league: 'Bundesliga', tier: 2, strength: 85, color: '#FDE100', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'frankfurt', name: 'Eintracht Frankfurt', country: 'Germany', league: 'Bundesliga', tier: 3, strength: 76, color: '#E1000F', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'stuttgart', name: 'VfB Stuttgart', country: 'Germany', league: 'Bundesliga', tier: 3, strength: 74, color: '#E32219', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'mainz', name: 'Mainz 05', country: 'Germany', league: 'Bundesliga', tier: 4, strength: 61, color: '#C3141E', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'freiburg', name: 'SC Freiburg', country: 'Germany', league: 'Bundesliga', tier: 4, strength: 68, color: '#000000', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'darmstadt', name: 'Darmstadt 98', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 52, color: '#004B9E', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  // France - Ligue 1
  { id: 'psg', name: 'Paris Saint-Germain', country: 'France', league: 'Ligue 1', tier: 1, strength: 93, color: '#DA001C', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'monaco', name: 'Monaco', country: 'France', league: 'Ligue 1', tier: 1, strength: 82, color: '#E51A22', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'lille', name: 'Lille', country: 'France', league: 'Ligue 1', tier: 2, strength: 80, color: '#E01D2B', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'marseille', name: 'Marseille', country: 'France', league: 'Ligue 1', tier: 2, strength: 79, color: '#2FA0DA', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'lyon', name: 'Lyon', country: 'France', league: 'Ligue 1', tier: 3, strength: 76, color: '#DA0025', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'rennes', name: 'Rennes', country: 'France', league: 'Ligue 1', tier: 3, strength: 74, color: '#E2001A', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'nice', name: 'Nice', country: 'France', league: 'Ligue 1', tier: 4, strength: 71, color: '#941C1F', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'lens', name: 'Lens', country: 'France', league: 'Ligue 1', tier: 4, strength: 72, color: '#FFD200', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'le-havre', name: 'Le Havre', country: 'France', league: 'Ligue 2', tier: 5, strength: 52, color: '#0072CE', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  // Saudi Arabia - Saudi Pro League
  { id: 'al-hilal', name: 'Al Hilal', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 1, strength: 84, color: '#1B3D8F', reserveGoalRatio: 0.6, firstTeamGoalRatio: 0.46 },
  { id: 'al-nassr', name: 'Al Nassr', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 1, strength: 82, color: '#FED034', reserveGoalRatio: 0.6, firstTeamGoalRatio: 0.46 },
  { id: 'al-ahli', name: 'Al Ahli', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 2, strength: 78, color: '#006233', reserveGoalRatio: 0.5, firstTeamGoalRatio: 0.4 },
  { id: 'al-ittihad', name: 'Al Ittihad', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 2, strength: 77, color: '#000000', reserveGoalRatio: 0.5, firstTeamGoalRatio: 0.4 },
  { id: 'al-taawoun', name: 'Al Taawoun', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 3, strength: 70, color: '#5A2D81', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'al-fateh', name: 'Al Fateh', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 3, strength: 68, color: '#00843D', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'al-fayha', name: 'Al Fayha', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 4, strength: 62, color: '#8DC63F', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'al-tai', name: 'Al Tai', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 4, strength: 60, color: '#6E6F72', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },

  // United States / Canada - MLS
  { id: 'lafc', name: 'LAFC', country: 'United States', league: 'MLS', tier: 1, strength: 78, color: '#000000', reserveGoalRatio: 0.6, firstTeamGoalRatio: 0.46 },
  { id: 'inter-miami', name: 'Inter Miami', country: 'United States', league: 'MLS', tier: 1, strength: 77, color: '#F7B5CD', reserveGoalRatio: 0.6, firstTeamGoalRatio: 0.46 },
  { id: 'seattle', name: 'Seattle Sounders', country: 'United States', league: 'MLS', tier: 2, strength: 74, color: '#5D9741', reserveGoalRatio: 0.5, firstTeamGoalRatio: 0.4 },
  { id: 'columbus', name: 'Columbus Crew', country: 'United States', league: 'MLS', tier: 2, strength: 73, color: '#FFF200', reserveGoalRatio: 0.5, firstTeamGoalRatio: 0.4 },
  { id: 'philadelphia', name: 'Philadelphia Union', country: 'United States', league: 'MLS', tier: 3, strength: 70, color: '#00A94F', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'cincinnati', name: 'FC Cincinnati', country: 'United States', league: 'MLS', tier: 3, strength: 69, color: '#FE5000', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'kansas-city', name: 'Sporting Kansas City', country: 'United States', league: 'MLS', tier: 4, strength: 64, color: '#93B1E4', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'nashville', name: 'Nashville SC', country: 'United States', league: 'MLS', tier: 4, strength: 63, color: '#ECE83A', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'atlanta', name: 'Atlanta United', country: 'United States', league: 'MLS', tier: 3, strength: 70, color: '#80000B', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'nycfc', name: 'New York City FC', country: 'United States', league: 'MLS', tier: 3, strength: 68, color: '#6CACE4', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'la-galaxy', name: 'LA Galaxy', country: 'United States', league: 'MLS', tier: 3, strength: 67, color: '#00245D', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'portland', name: 'Portland Timbers', country: 'United States', league: 'MLS', tier: 4, strength: 65, color: '#004812', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'chicago', name: 'Chicago Fire', country: 'United States', league: 'MLS', tier: 4, strength: 61, color: '#AF2626', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },

  { id: 'tottenham', name: 'Tottenham', country: 'England', league: 'Premier League', tier: 2, strength: 84, color: '#132257', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'man-united', name: 'Manchester United', country: 'England', league: 'Premier League', tier: 2, strength: 82, color: '#DA291C', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'brighton', name: 'Brighton', country: 'England', league: 'Premier League', tier: 3, strength: 74, color: '#0057B8', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'west-ham', name: 'West Ham', country: 'England', league: 'Premier League', tier: 4, strength: 71, color: '#7A263A', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'brentford', name: 'Brentford', country: 'England', league: 'Premier League', tier: 4, strength: 70, color: '#E30613', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },

  { id: 'leicester', name: 'Leicester City', country: 'England', league: 'Championship', tier: 4, strength: 72, color: '#003090', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'leeds', name: 'Leeds United', country: 'England', league: 'Premier League', tier: 3, strength: 74, color: '#FFCD00', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'southampton', name: 'Southampton', country: 'England', league: 'Championship', tier: 4, strength: 70, color: '#D71920', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'ipswich', name: 'Ipswich Town', country: 'England', league: 'Championship', tier: 4, strength: 68, color: '#0048A9', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'norwich', name: 'Norwich City', country: 'England', league: 'Championship', tier: 4, strength: 66, color: '#FFF200', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'sheff-utd', name: 'Sheffield United', country: 'England', league: 'Championship', tier: 4, strength: 65, color: '#EE2737', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'middlesbrough', name: 'Middlesbrough', country: 'England', league: 'Championship', tier: 4, strength: 64, color: '#E4000F', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'coventry', name: 'Coventry City', country: 'England', league: 'Championship', tier: 5, strength: 63, color: '#77C1E4', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'watford', name: 'Watford', country: 'England', league: 'Championship', tier: 5, strength: 62, color: '#FBEE23', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'hull', name: 'Hull City', country: 'England', league: 'Championship', tier: 5, strength: 61, color: '#F5A12D', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'preston', name: 'Preston North End', country: 'England', league: 'Championship', tier: 5, strength: 58, color: '#002F6C', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'blackburn', name: 'Blackburn Rovers', country: 'England', league: 'Championship', tier: 5, strength: 57, color: '#009EE0', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },

  { id: 'athletic', name: 'Athletic Club', country: 'Spain', league: 'La Liga', tier: 3, strength: 78, color: '#EE2523', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'sevilla', name: 'Sevilla', country: 'Spain', league: 'La Liga', tier: 3, strength: 76, color: '#D61921', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'girona', name: 'Girona', country: 'Spain', league: 'La Liga', tier: 3, strength: 73, color: '#C4122E', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'valencia', name: 'Valencia', country: 'Spain', league: 'La Liga', tier: 4, strength: 72, color: '#EE3524', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'mallorca', name: 'Mallorca', country: 'Spain', league: 'La Liga', tier: 4, strength: 64, color: '#E20613', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },

  { id: 'levante', name: 'Levante', country: 'Spain', league: 'La Liga 2', tier: 4, strength: 63, color: '#0033A0', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'valladolid', name: 'Valladolid', country: 'Spain', league: 'La Liga 2', tier: 4, strength: 62, color: '#7B2D8E', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'elche', name: 'Elche', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 61, color: '#007A33', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'oviedo', name: 'Real Oviedo', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 60, color: '#1B4E9B', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'zaragoza', name: 'Real Zaragoza', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 59, color: '#0067B1', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'eibar', name: 'Eibar', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 58, color: '#1D1D1B', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'sporting-gijon', name: 'Sporting Gijón', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 57, color: '#E20613', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'tenerife', name: 'Tenerife', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 56, color: '#003DA5', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'racing-santander', name: 'Racing Santander', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 55, color: '#0072CE', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'burgos', name: 'Burgos', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 54, color: '#FFFFFF', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },
  { id: 'albacete', name: 'Albacete', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 53, color: '#FFFFFF', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },
  { id: 'racing-ferrol', name: 'Racing Ferrol', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 52, color: '#007A33', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  { id: 'lazio', name: 'Lazio', country: 'Italy', league: 'Serie A', tier: 3, strength: 78, color: '#87D8F7', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'bologna', name: 'Bologna', country: 'Italy', league: 'Serie A', tier: 3, strength: 74, color: '#1B1B1B', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'udinese', name: 'Udinese', country: 'Italy', league: 'Serie A', tier: 4, strength: 68, color: '#8B1E21', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'genoa', name: 'Genoa', country: 'Italy', league: 'Serie A', tier: 4, strength: 67, color: '#AD1919', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'cagliari', name: 'Cagliari', country: 'Italy', league: 'Serie A', tier: 4, strength: 64, color: '#A00A2D', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },

  { id: 'parma', name: 'Parma', country: 'Italy', league: 'Serie B', tier: 4, strength: 70, color: '#FFE05C', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'como', name: 'Como', country: 'Italy', league: 'Serie A', tier: 3, strength: 72, color: '#003DA5', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'palermo', name: 'Palermo', country: 'Italy', league: 'Serie B', tier: 4, strength: 64, color: '#E5A4CB', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'cremonese', name: 'Cremonese', country: 'Italy', league: 'Serie B', tier: 5, strength: 61, color: '#D21034', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'bari', name: 'Bari', country: 'Italy', league: 'Serie B', tier: 5, strength: 60, color: '#FFFFFF', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'sampdoria', name: 'Sampdoria', country: 'Italy', league: 'Serie B', tier: 5, strength: 59, color: '#004B87', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'brescia', name: 'Brescia', country: 'Italy', league: 'Serie B', tier: 5, strength: 58, color: '#0054A6', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'frosinone', name: 'Frosinone', country: 'Italy', league: 'Serie B', tier: 5, strength: 58, color: '#FFD100', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'spezia', name: 'Spezia', country: 'Italy', league: 'Serie B', tier: 5, strength: 57, color: '#FFFFFF', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'catanzaro', name: 'Catanzaro', country: 'Italy', league: 'Serie B', tier: 5, strength: 56, color: '#E30613', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'cesena', name: 'Cesena', country: 'Italy', league: 'Serie B', tier: 5, strength: 54, color: '#FFFFFF', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },
  { id: 'sudtirol', name: 'Südtirol', country: 'Italy', league: 'Serie B', tier: 5, strength: 53, color: '#FFFFFF', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  { id: 'wolfsburg', name: 'Wolfsburg', country: 'Germany', league: 'Bundesliga', tier: 3, strength: 73, color: '#65B32E', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'union-berlin', name: 'Union Berlin', country: 'Germany', league: 'Bundesliga', tier: 4, strength: 72, color: '#EB1923', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'hoffenheim', name: 'Hoffenheim', country: 'Germany', league: 'Bundesliga', tier: 4, strength: 71, color: '#1C63B7', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'werder', name: 'Werder Bremen', country: 'Germany', league: 'Bundesliga', tier: 4, strength: 69, color: '#1D9053', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'augsburg', name: 'Augsburg', country: 'Germany', league: 'Bundesliga', tier: 4, strength: 64, color: '#BA3733', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },

  { id: 'hamburg', name: 'Hamburger SV', country: 'Germany', league: '2. Bundesliga', tier: 4, strength: 70, color: '#1C63B7', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'koln', name: 'Köln', country: 'Germany', league: 'Bundesliga', tier: 3, strength: 72, color: '#ED1C24', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'hertha', name: 'Hertha BSC', country: 'Germany', league: '2. Bundesliga', tier: 4, strength: 67, color: '#005CA9', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'schalke', name: 'Schalke 04', country: 'Germany', league: '2. Bundesliga', tier: 4, strength: 66, color: '#004D9D', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'hannover', name: 'Hannover 96', country: 'Germany', league: '2. Bundesliga', tier: 4, strength: 64, color: '#00993D', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'kiel', name: 'Holstein Kiel', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 62, color: '#005CA9', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'kaiserslautern', name: 'Kaiserslautern', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 61, color: '#E30613', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'magdeburg', name: 'Magdeburg', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 60, color: '#005CA9', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'nurnberg', name: 'Nürnberg', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 59, color: '#C4122E', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'paderborn', name: 'Paderborn', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 58, color: '#005CA9', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'greuther-furth', name: 'Greuther Fürth', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 57, color: '#007A33', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'braunschweig', name: 'Eintracht Braunschweig', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 55, color: '#FDE100', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },

  { id: 'brest', name: 'Brest', country: 'France', league: 'Ligue 1', tier: 4, strength: 71, color: '#E30613', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'strasbourg', name: 'Strasbourg', country: 'France', league: 'Ligue 1', tier: 4, strength: 70, color: '#009FE3', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'reims', name: 'Reims', country: 'France', league: 'Ligue 1', tier: 4, strength: 66, color: '#E30613', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'toulouse', name: 'Toulouse', country: 'France', league: 'Ligue 1', tier: 4, strength: 67, color: '#6C1D45', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'nantes', name: 'Nantes', country: 'France', league: 'Ligue 1', tier: 4, strength: 65, color: '#FFE200', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },

  { id: 'lorient', name: 'Lorient', country: 'France', league: 'Ligue 2', tier: 4, strength: 67, color: '#E87722', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'metz', name: 'Metz', country: 'France', league: 'Ligue 2', tier: 4, strength: 68, color: '#6F0F1C', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'bordeaux', name: 'Bordeaux', country: 'France', league: 'Ligue 2', tier: 5, strength: 63, color: '#001B49', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'paris-fc', name: 'Paris FC', country: 'France', league: 'Ligue 2', tier: 5, strength: 61, color: '#003DA5', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'caen', name: 'Caen', country: 'France', league: 'Ligue 2', tier: 5, strength: 60, color: '#E30613', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'guingamp', name: 'Guingamp', country: 'France', league: 'Ligue 2', tier: 5, strength: 59, color: '#E30613', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'grenoble', name: 'Grenoble', country: 'France', league: 'Ligue 2', tier: 5, strength: 58, color: '#003DA5', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'amiens', name: 'Amiens', country: 'France', league: 'Ligue 2', tier: 5, strength: 57, color: '#FFFFFF', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'bastia', name: 'Bastia', country: 'France', league: 'Ligue 2', tier: 5, strength: 56, color: '#003DA5', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'annecy', name: 'Annecy', country: 'France', league: 'Ligue 2', tier: 5, strength: 55, color: '#E30613', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'pau', name: 'Pau', country: 'France', league: 'Ligue 2', tier: 5, strength: 54, color: '#FFD100', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },
  { id: 'rodez', name: 'Rodez', country: 'France', league: 'Ligue 2', tier: 5, strength: 53, color: '#E30613', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  { id: 'al-shabab', name: 'Al Shabab', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 3, strength: 69, color: '#FFFFFF', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'al-ettifaq', name: 'Al Ettifaq', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 4, strength: 66, color: '#007A33', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'al-raed', name: 'Al Raed', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 5, strength: 58, color: '#E30613', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'al-khaleej', name: 'Al Khaleej', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 5, strength: 56, color: '#F5A12D', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'damac', name: 'Damac', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 5, strength: 55, color: '#E87722', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },

  { id: 'wolves', name: 'Wolves', country: 'England', league: 'Premier League', tier: 3, strength: 76, color: '#FDB913', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'fulham', name: 'Fulham', country: 'England', league: 'Premier League', tier: 3, strength: 74, color: '#FFFFFF', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'bournemouth', name: 'Bournemouth', country: 'England', league: 'Premier League', tier: 4, strength: 73, color: '#DA291C', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'nottingham-forest', name: 'Nottingham Forest', country: 'England', league: 'Premier League', tier: 3, strength: 75, color: '#E53233', reserveGoalRatio: 0.42, firstTeamGoalRatio: 0.34 },
  { id: 'burnley', name: 'Burnley', country: 'England', league: 'Premier League', tier: 4, strength: 69, color: '#6C1D45', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'sunderland', name: 'Sunderland', country: 'England', league: 'Premier League', tier: 4, strength: 70, color: '#EB172B', reserveGoalRatio: 0.38, firstTeamGoalRatio: 0.3 },

  { id: 'west-brom', name: 'West Brom', country: 'England', league: 'Championship', tier: 4, strength: 68, color: '#122F67', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'stoke', name: 'Stoke City', country: 'England', league: 'Championship', tier: 4, strength: 64, color: '#E03A3E', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'cardiff', name: 'Cardiff City', country: 'England', league: 'Championship', tier: 5, strength: 61, color: '#0070B5', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'swansea', name: 'Swansea City', country: 'England', league: 'Championship', tier: 4, strength: 63, color: '#FFFFFF', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'bristol-city', name: 'Bristol City', country: 'England', league: 'Championship', tier: 4, strength: 64, color: '#E30613', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'millwall', name: 'Millwall', country: 'England', league: 'Championship', tier: 5, strength: 62, color: '#002F6C', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'qpr', name: 'QPR', country: 'England', league: 'Championship', tier: 5, strength: 61, color: '#1D5BA4', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'derby', name: 'Derby County', country: 'England', league: 'Championship', tier: 4, strength: 64, color: '#FFFFFF', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'portsmouth', name: 'Portsmouth', country: 'England', league: 'Championship', tier: 5, strength: 60, color: '#003087', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'oxford', name: 'Oxford United', country: 'England', league: 'Championship', tier: 5, strength: 59, color: '#F5A12D', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'plymouth', name: 'Plymouth Argyle', country: 'England', league: 'Championship', tier: 5, strength: 58, color: '#007A33', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'sheffield-wed', name: 'Sheffield Wednesday', country: 'England', league: 'Championship', tier: 5, strength: 60, color: '#3775D5', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },

  { id: 'osasuna', name: 'Osasuna', country: 'Spain', league: 'La Liga', tier: 4, strength: 71, color: '#D91A2A', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'rayo', name: 'Rayo Vallecano', country: 'Spain', league: 'La Liga', tier: 4, strength: 70, color: '#E30613', reserveGoalRatio: 0.38, firstTeamGoalRatio: 0.3 },
  { id: 'las-palmas', name: 'Las Palmas', country: 'Spain', league: 'La Liga', tier: 4, strength: 68, color: '#FFD100', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'alaves', name: 'Alavés', country: 'Spain', league: 'La Liga', tier: 4, strength: 69, color: '#004B9D', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'espanyol', name: 'Espanyol', country: 'Spain', league: 'La Liga', tier: 4, strength: 70, color: '#0072CE', reserveGoalRatio: 0.38, firstTeamGoalRatio: 0.3 },
  { id: 'leganes', name: 'Leganés', country: 'Spain', league: 'La Liga', tier: 4, strength: 66, color: '#0055A5', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'cadiz', name: 'Cádiz', country: 'Spain', league: 'La Liga', tier: 4, strength: 65, color: '#FFD100', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },

  { id: 'huesca', name: 'Huesca', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 58, color: '#003DA5', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'cartagena', name: 'Cartagena', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 56, color: '#FFFFFF', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'eldense', name: 'Eldense', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 54, color: '#E30613', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },
  { id: 'castellon', name: 'Castellón', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 55, color: '#000000', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'deportivo', name: 'Deportivo La Coruña', country: 'Spain', league: 'La Liga 2', tier: 4, strength: 62, color: '#003DA5', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'malaga', name: 'Málaga', country: 'Spain', league: 'La Liga 2', tier: 4, strength: 61, color: '#005CB9', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'andorra', name: 'FC Andorra', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 53, color: '#FFD100', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },
  { id: 'mirandes', name: 'Mirandés', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 54, color: '#E30613', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },
  { id: 'cordoba', name: 'Córdoba', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 55, color: '#007A33', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },

  { id: 'sassuolo', name: 'Sassuolo', country: 'Italy', league: 'Serie A', tier: 4, strength: 70, color: '#00843D', reserveGoalRatio: 0.38, firstTeamGoalRatio: 0.3 },
  { id: 'empoli', name: 'Empoli', country: 'Italy', league: 'Serie A', tier: 4, strength: 66, color: '#0054A6', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'lecce', name: 'Lecce', country: 'Italy', league: 'Serie A', tier: 4, strength: 65, color: '#E30613', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'verona', name: 'Hellas Verona', country: 'Italy', league: 'Serie A', tier: 4, strength: 67, color: '#FFD100', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'monza', name: 'Monza', country: 'Italy', league: 'Serie A', tier: 4, strength: 68, color: '#E30613', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'venezia', name: 'Venezia', country: 'Italy', league: 'Serie A', tier: 4, strength: 64, color: '#F5A12D', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },

  { id: 'modena', name: 'Modena', country: 'Italy', league: 'Serie B', tier: 5, strength: 58, color: '#FFD100', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'pisa', name: 'Pisa', country: 'Italy', league: 'Serie B', tier: 4, strength: 63, color: '#001B49', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'ascoli', name: 'Ascoli', country: 'Italy', league: 'Serie B', tier: 5, strength: 56, color: '#000000', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'cosenza', name: 'Cosenza', country: 'Italy', league: 'Serie B', tier: 5, strength: 55, color: '#E30613', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'cittadella', name: 'Cittadella', country: 'Italy', league: 'Serie B', tier: 5, strength: 57, color: '#8B1E21', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'ternana', name: 'Ternana', country: 'Italy', league: 'Serie B', tier: 5, strength: 56, color: '#007A33', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'reggiana', name: 'Reggiana', country: 'Italy', league: 'Serie B', tier: 5, strength: 54, color: '#8B1E21', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },
  { id: 'avellino', name: 'Avellino', country: 'Italy', league: 'Serie B', tier: 5, strength: 53, color: '#007A33', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  { id: 'gladbach', name: 'Borussia Mönchengladbach', country: 'Germany', league: 'Bundesliga', tier: 3, strength: 74, color: '#000000', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'heidenheim', name: 'Heidenheim', country: 'Germany', league: 'Bundesliga', tier: 4, strength: 68, color: '#E30613', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'bochum', name: 'Bochum', country: 'Germany', league: 'Bundesliga', tier: 4, strength: 66, color: '#005CA9', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'st-pauli', name: 'St. Pauli', country: 'Germany', league: 'Bundesliga', tier: 4, strength: 67, color: '#8B4513', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },

  { id: 'dusseldorf', name: 'Fortuna Düsseldorf', country: 'Germany', league: '2. Bundesliga', tier: 4, strength: 66, color: '#E30613', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'karlsruhe', name: 'Karlsruhe', country: 'Germany', league: '2. Bundesliga', tier: 4, strength: 64, color: '#005CA9', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'elversberg', name: 'Elversberg', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 60, color: '#FFFFFF', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'munster', name: 'Preußen Münster', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 58, color: '#007A33', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'ulm', name: 'Ulm', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 57, color: '#000000', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'regensburg', name: 'Jahn Regensburg', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 56, color: '#E30613', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },

  { id: 'auxerre', name: 'Auxerre', country: 'France', league: 'Ligue 1', tier: 4, strength: 68, color: '#FFFFFF', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'montpellier', name: 'Montpellier', country: 'France', league: 'Ligue 1', tier: 4, strength: 67, color: '#E87722', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'angers', name: 'Angers', country: 'France', league: 'Ligue 1', tier: 4, strength: 66, color: '#FFFFFF', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'saint-etienne', name: 'Saint-Étienne', country: 'France', league: 'Ligue 1', tier: 4, strength: 69, color: '#007A33', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'clermont', name: 'Clermont', country: 'France', league: 'Ligue 1', tier: 4, strength: 64, color: '#E30613', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },

  { id: 'ajaccio', name: 'Ajaccio', country: 'France', league: 'Ligue 2', tier: 5, strength: 58, color: '#E30613', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'dunkerque', name: 'Dunkerque', country: 'France', league: 'Ligue 2', tier: 5, strength: 56, color: '#003DA5', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'troyes', name: 'Troyes', country: 'France', league: 'Ligue 2', tier: 4, strength: 62, color: '#005CA9', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'laval', name: 'Laval', country: 'France', league: 'Ligue 2', tier: 5, strength: 57, color: '#F5A12D', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'martigues', name: 'Martigues', country: 'France', league: 'Ligue 2', tier: 5, strength: 54, color: '#E30613', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  { id: 'al-wehda', name: 'Al Wehda', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 5, strength: 60, color: '#E30613', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'al-okhdood', name: 'Al Okhdood', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 5, strength: 57, color: '#007A33', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'al-riyadh', name: 'Al Riyadh', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 5, strength: 58, color: '#FFFFFF', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'abha', name: 'Abha', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 5, strength: 56, color: '#E30613', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'al-hazem', name: 'Al Hazem', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 5, strength: 55, color: '#FFD100', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },

  { id: 'austin', name: 'Austin FC', country: 'United States', league: 'MLS', tier: 4, strength: 66, color: '#00B140', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'orlando', name: 'Orlando City', country: 'United States', league: 'MLS', tier: 3, strength: 68, color: '#633492', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'minnesota', name: 'Minnesota United', country: 'United States', league: 'MLS', tier: 4, strength: 65, color: '#8CD2F4', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'dallas', name: 'FC Dallas', country: 'United States', league: 'MLS', tier: 4, strength: 64, color: '#E30613', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'houston', name: 'Houston Dynamo', country: 'United States', league: 'MLS', tier: 4, strength: 64, color: '#F68712', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'montreal', name: 'CF Montréal', country: 'United States', league: 'MLS', tier: 4, strength: 63, color: '#003DA5', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'toronto', name: 'Toronto FC', country: 'United States', league: 'MLS', tier: 4, strength: 62, color: '#B11226', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'vancouver', name: 'Vancouver Whitecaps', country: 'United States', league: 'MLS', tier: 4, strength: 66, color: '#00245D', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'colorado', name: 'Colorado Rapids', country: 'United States', league: 'MLS', tier: 4, strength: 63, color: '#91022D', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'salt-lake', name: 'Real Salt Lake', country: 'United States', league: 'MLS', tier: 4, strength: 65, color: '#B30838', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'new-england', name: 'New England Revolution', country: 'United States', league: 'MLS', tier: 4, strength: 64, color: '#0A2240', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'ny-red-bulls', name: 'New York Red Bulls', country: 'United States', league: 'MLS', tier: 3, strength: 67, color: '#ED1C24', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'charlotte', name: 'Charlotte FC', country: 'United States', league: 'MLS', tier: 4, strength: 63, color: '#1A85C8', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'st-louis', name: 'St. Louis City', country: 'United States', league: 'MLS', tier: 4, strength: 64, color: '#E30613', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'dc-united', name: 'D.C. United', country: 'United States', league: 'MLS', tier: 4, strength: 61, color: '#000000', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },

  // Mexico - Liga MX (Leagues Cup opponents)
  { id: 'club-america', name: 'Club América', country: 'Mexico', league: 'Liga MX', tier: 2, strength: 80, color: '#FFD100', reserveGoalRatio: 0.5, firstTeamGoalRatio: 0.4, playable: false },
  { id: 'monterrey', name: 'Monterrey', country: 'Mexico', league: 'Liga MX', tier: 2, strength: 79, color: '#003DA5', reserveGoalRatio: 0.5, firstTeamGoalRatio: 0.4, playable: false },
  { id: 'tigres', name: 'Tigres UANL', country: 'Mexico', league: 'Liga MX', tier: 2, strength: 78, color: '#F5A12D', reserveGoalRatio: 0.5, firstTeamGoalRatio: 0.4, playable: false },
  { id: 'chivas', name: 'Chivas', country: 'Mexico', league: 'Liga MX', tier: 2, strength: 77, color: '#E30613', reserveGoalRatio: 0.48, firstTeamGoalRatio: 0.38, playable: false },
  { id: 'cruz-azul', name: 'Cruz Azul', country: 'Mexico', league: 'Liga MX', tier: 2, strength: 76, color: '#003DA5', reserveGoalRatio: 0.48, firstTeamGoalRatio: 0.38, playable: false },
  { id: 'pumas', name: 'Pumas UNAM', country: 'Mexico', league: 'Liga MX', tier: 3, strength: 73, color: '#002D62', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32, playable: false },
  { id: 'toluca', name: 'Toluca', country: 'Mexico', league: 'Liga MX', tier: 3, strength: 74, color: '#E30613', reserveGoalRatio: 0.42, firstTeamGoalRatio: 0.34, playable: false },
  { id: 'leon', name: 'León', country: 'Mexico', league: 'Liga MX', tier: 3, strength: 72, color: '#007A33', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32, playable: false },
  { id: 'santos-laguna', name: 'Santos Laguna', country: 'Mexico', league: 'Liga MX', tier: 3, strength: 71, color: '#007A33', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32, playable: false },
  { id: 'pachuca', name: 'Pachuca', country: 'Mexico', league: 'Liga MX', tier: 3, strength: 73, color: '#003DA5', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32, playable: false },

  // AFC Champions League Elite opponents
  { id: 'urawa', name: 'Urawa Red Diamonds', country: 'Japan', league: 'J1 League', tier: 2, strength: 76, color: '#E30613', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.36, playable: false },
  { id: 'kawasaki', name: 'Kawasaki Frontale', country: 'Japan', league: 'J1 League', tier: 2, strength: 75, color: '#87CEEB', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.36, playable: false },
  { id: 'yokohama-fm', name: 'Yokohama F. Marinos', country: 'Japan', league: 'J1 League', tier: 2, strength: 74, color: '#003DA5', reserveGoalRatio: 0.42, firstTeamGoalRatio: 0.34, playable: false },
  { id: 'ulsan', name: 'Ulsan HD', country: 'South Korea', league: 'K League 1', tier: 2, strength: 76, color: '#003DA5', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.36, playable: false },
  { id: 'jeonbuk', name: 'Jeonbuk Hyundai', country: 'South Korea', league: 'K League 1', tier: 2, strength: 74, color: '#007A33', reserveGoalRatio: 0.42, firstTeamGoalRatio: 0.34, playable: false },
  { id: 'al-ain', name: 'Al Ain', country: 'United Arab Emirates', league: 'UAE Pro League', tier: 2, strength: 75, color: '#8B1E21', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.36, playable: false },
  { id: 'al-wasl', name: 'Al Wasl', country: 'United Arab Emirates', league: 'UAE Pro League', tier: 3, strength: 70, color: '#FFD100', reserveGoalRatio: 0.38, firstTeamGoalRatio: 0.3, playable: false },
  { id: 'al-sadd', name: 'Al Sadd', country: 'Qatar', league: 'Qatar Stars League', tier: 2, strength: 76, color: '#000000', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.36, playable: false },
  { id: 'al-duhail', name: 'Al-Duhail', country: 'Qatar', league: 'Qatar Stars League', tier: 2, strength: 74, color: '#E30613', reserveGoalRatio: 0.42, firstTeamGoalRatio: 0.34, playable: false },
  { id: 'persepolis', name: 'Persepolis', country: 'Iran', league: 'Persian Gulf Pro League', tier: 2, strength: 73, color: '#E30613', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32, playable: false },
  { id: 'esteghlal', name: 'Esteghlal', country: 'Iran', league: 'Persian Gulf Pro League', tier: 2, strength: 72, color: '#003DA5', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32, playable: false },
  { id: 'shanghai-port', name: 'Shanghai Port', country: 'China PR', league: 'Chinese Super League', tier: 2, strength: 73, color: '#E30613', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32, playable: false },
];

export const CLUBS: Club[] = CLUB_SEED.map((club) => {
  const ratio = goalRatioFromStrength(club.strength);
  return {
    ...club,
    conference: club.conference ?? mlsConferenceOf(club.id) ?? undefined,
    playable: club.playable !== false,
    tier: assignClubTier(club.country, club.league, club.strength),
    firstTeamGoalRatio: ratio,
    reserveGoalRatio: ratio,
  };
});

export function getClub(id: string): Club | undefined {
  return CLUBS.find((c) => c.id === id);
}

export function clubsByTier(tier: ClubTier): Club[] {
  return CLUBS.filter((c) => c.tier === tier && c.playable !== false);
}

export function clubsInLeague(league: string): Club[] {
  return CLUBS.filter((c) => c.league === league);
}

/**
 * Clubs that share a table with the player this season. A promoted
 * Championship side is inserted into the Premier League (the weakest
 * top-flight club drops out). MLS is capped at 20 so the year cannot
 * run past 48 weeks.
 */
export function clubsForSeason(playerClub: Club, league: string): Club[] {
  if (league === 'MLS') return mlsSeasonClubs(playerClub);
  let pool = clubsInLeague(league);
  if (!pool.some((c) => c.id === playerClub.id)) {
    const weakest = [...pool].sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id))[0];
    pool = [playerClub, ...pool.filter((c) => c.id !== weakest?.id)];
  }
  return pool;
}

/** 10 Eastern + 10 Western, always including the player. */
export function mlsSeasonClubs(playerClub: Club): Club[] {
  const playerConf = mlsConferenceOf(playerClub.id) ?? 'west';
  const otherConf = playerConf === 'east' ? 'west' : 'east';
  const take = (conference: 'east' | 'west', include?: Club): Club[] => {
    const pool = CLUBS.filter(
      (c) => c.league === 'MLS' && mlsConferenceOf(c.id) === conference && c.id !== include?.id,
    ).sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id));
    if (include && mlsConferenceOf(include.id) === conference) {
      return [include, ...pool.slice(0, MLS_CONFERENCE_SIZE - 1)];
    }
    return pool.slice(0, MLS_CONFERENCE_SIZE);
  };
  return [...take(playerConf, playerClub), ...take(otherConf)];
}

/** Real division sizes. A season is home and away against every other club. */
export const TARGET_LEAGUE_SIZE: Record<string, number> = {
  'Premier League': 20,
  Championship: 24,
  'La Liga': 20,
  'La Liga 2': 22,
  'Serie A': 20,
  'Serie B': 20,
  Bundesliga: 18,
  '2. Bundesliga': 18,
  'Ligue 1': 18,
  'Ligue 2': 18,
  'Saudi Pro League': 18,
  MLS: 28,
};

export function leagueMatchWeeks(league: string, playerClub?: Club): number {
  if (league === 'MLS') return MLS_REGULAR_SEASON_WEEKS;
  const n = playerClub ? clubsForSeason(playerClub, league).length : clubsInLeague(league).length;
  return Math.max(2, (n - 1) * 2);
}

export function playableClubsGroupedByLeague(): { league: string; clubs: Club[] }[] {
  const order = Object.keys(TARGET_LEAGUE_SIZE);
  const groups = new Map<string, Club[]>();
  for (const club of CLUBS) {
    if (club.playable === false) continue;
    const list = groups.get(club.league) ?? [];
    list.push(club);
    groups.set(club.league, list);
  }
  for (const clubs of groups.values()) {
    clubs.sort((a, b) => b.strength - a.strength || a.name.localeCompare(b.name));
  }
  const known = order
    .filter((league) => groups.has(league))
    .map((league) => ({ league, clubs: groups.get(league)! }));
  const extra = [...groups.keys()]
    .filter((league) => !order.includes(league))
    .sort()
    .map((league) => ({ league, clubs: groups.get(league)! }));
  return [...known, ...extra];
}

export function clubsInCountry(country: string): Club[] {
  return CLUBS.filter((c) => c.country === country);
}

/** Clubs strictly weaker than the given club - candidates for a loan spell. */
export function qualifiesForSaudiSuperCup(club: Club): boolean {
  return CLUBS.filter((c) => c.league === 'Saudi Pro League')
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))
    .slice(0, 4)
    .some((c) => c.id === club.id);
}

export function ligaMxClubs(): Club[] {
  return CLUBS.filter((c) => c.league === 'Liga MX');
}

export function loanCandidates(club: Club): Club[] {
  const targetTier = Math.min(5, club.tier + 1) as ClubTier;
  return CLUBS.filter((c) => c.tier === targetTier && c.id !== club.id);
}
