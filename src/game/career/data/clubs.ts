import { MLS_CONFERENCE_SIZE, MLS_REGULAR_SEASON_WEEKS, leagueDisplayName, mlsConferenceOf } from './leagueFormat';

/**
 * The football pyramid this career mode plays out across: the big five
 * European leagues, Primeira Liga, Eredivisie, Super Lig, Saudi Arabia,
 * MLS, Liga MX, Brasileirao, Liga Profesional, Primera A, and J1 League.
 * Tiers 1 (elite) through 5 (lower level) exist so the trial and transfer
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
  4: 'Medium',
  5: 'Lower level',
};

/**
 * Transfer-card band. Second-division clubs sit below first-division
 * Medium — Leicester is English Championship, Palace is Medium.
 */
export function clubQualityLabel(club: { tier: ClubTier; league: string }): string {
  if (SECOND_DIVISIONS.has(club.league)) {
    return leagueDisplayName(club.league);
  }
  return TIER_LABEL[club.tier];
}

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

/** Top flight → the second-tier league that feeds it, when that pyramid exists. */
export function secondDivisionOf(topLeague: string): string | null {
  for (const [second, top] of Object.entries(PROMOTION_TARGET)) {
    if (top === topLeague) return second;
  }
  return null;
}

export function earnedPromotion(league: string, position: number | null | undefined): boolean {
  return Boolean(promotionTarget(league) && position != null && position <= 2);
}

/** Full 28-club MLS pool. Regular season is 34 weeks (26 conference + 8 inter). */
export const MLS_SEASON_CLUBS = 28;

/** Floor on the numeric tier (1 is best). MLS never 1–2; Saudi never 1. */
export function leagueTierFloor(country: string, league: string): ClubTier {
  if (league === 'MLS' || country === 'United States') return 3;
  if (country === 'Saudi Arabia' || league === 'Saudi Pro League') return 2;
  if (league === 'Liga MX' || country === 'Mexico') return 2;
  if (league === 'J1 League' || country === 'Japan') return 2;
  if (league === 'Primera A' || country === 'Colombia') return 3;
  if (SECOND_DIVISIONS.has(league)) return 5;
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
  /** False for cup-only guests (AFC / extra UEFA sides) that are not career destinations. */
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
  { id: 'man-city', name: 'Manchester Civic', country: 'England', league: 'Premier League', tier: 1, strength: 94, color: '#6CABDD', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'liverpool', name: 'Merseyside', country: 'England', league: 'Premier League', tier: 1, strength: 93, color: '#C8102E', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'man-united', name: 'Manchester North', country: 'England', league: 'Premier League', tier: 1, strength: 88, color: '#DA291C', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'tottenham', name: 'North London', country: 'England', league: 'Premier League', tier: 1, strength: 88, color: '#132257', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'arsenal', name: 'Northbank', country: 'England', league: 'Premier League', tier: 2, strength: 88, color: '#EF0107', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'chelsea', name: 'West London', country: 'England', league: 'Premier League', tier: 2, strength: 84, color: '#034694', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'newcastle', name: 'Tyneside', country: 'England', league: 'Premier League', tier: 3, strength: 79, color: '#241F20', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'aston-villa', name: 'Birmingham', country: 'England', league: 'Premier League', tier: 3, strength: 78, color: '#95BFE5', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'crystal-palace', name: 'South London', country: 'England', league: 'Premier League', tier: 4, strength: 68, color: '#1B458F', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'everton', name: 'Merseyside Blue', country: 'England', league: 'Premier League', tier: 4, strength: 67, color: '#003399', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'luton', name: 'Luton', country: 'England', league: 'Championship', tier: 5, strength: 52, color: '#F78F1E', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  // Spain - La Liga
  { id: 'real-madrid', name: 'Madrid', country: 'Spain', league: 'La Liga', tier: 1, strength: 94, color: '#FFFFFF', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'barcelona', name: 'Barcino', country: 'Spain', league: 'La Liga', tier: 1, strength: 91, color: '#A50044', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'atletico-madrid', name: 'Madrid Athletic', country: 'Spain', league: 'La Liga', tier: 2, strength: 86, color: '#CB3524', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'real-sociedad', name: 'San Sebastian', country: 'Spain', league: 'La Liga', tier: 2, strength: 80, color: '#0A3F87', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'villarreal', name: 'Vila-real', country: 'Spain', league: 'La Liga', tier: 3, strength: 76, color: '#FFE667', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'real-betis', name: 'Seville Green', country: 'Spain', league: 'La Liga', tier: 3, strength: 75, color: '#00954C', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'getafe', name: 'Getafe', country: 'Spain', league: 'La Liga', tier: 4, strength: 66, color: '#005999', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'celta-vigo', name: 'Vigo', country: 'Spain', league: 'La Liga', tier: 4, strength: 65, color: '#8AC3EE', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'almeria', name: 'Almeria', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 52, color: '#D2122E', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  // Italy - Serie A
  { id: 'inter', name: 'Milan Blue', country: 'Italy', league: 'Serie A', tier: 1, strength: 90, color: '#03256C', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'napoli', name: 'Naples', country: 'Italy', league: 'Serie A', tier: 1, strength: 86, color: '#12A0D7', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'ac-milan', name: 'Milan Red', country: 'Italy', league: 'Serie A', tier: 2, strength: 85, color: '#FB090B', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'juventus', name: 'Turin', country: 'Italy', league: 'Serie A', tier: 2, strength: 84, color: '#000000', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'atalanta', name: 'Bergamo', country: 'Italy', league: 'Serie A', tier: 3, strength: 80, color: '#1E71B8', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'roma', name: 'Rome', country: 'Italy', league: 'Serie A', tier: 3, strength: 79, color: '#8E1F2F', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'torino', name: 'Turin Maroon', country: 'Italy', league: 'Serie A', tier: 4, strength: 70, color: '#881D23', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'fiorentina', name: 'Florence', country: 'Italy', league: 'Serie A', tier: 4, strength: 72, color: '#492E7C', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'salernitana', name: 'Salerno', country: 'Italy', league: 'Serie B', tier: 5, strength: 52, color: '#7B1E3A', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  // Germany - Bundesliga
  { id: 'bayern', name: 'Munich', country: 'Germany', league: 'Bundesliga', tier: 1, strength: 94, color: '#DC052D', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'leverkusen', name: 'Leverkusen', country: 'Germany', league: 'Bundesliga', tier: 1, strength: 86, color: '#E32219', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'leipzig', name: 'Leipzig', country: 'Germany', league: 'Bundesliga', tier: 2, strength: 83, color: '#DD0741', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'dortmund', name: 'Dortmund', country: 'Germany', league: 'Bundesliga', tier: 2, strength: 85, color: '#FDE100', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'frankfurt', name: 'Frankfurt', country: 'Germany', league: 'Bundesliga', tier: 3, strength: 76, color: '#E1000F', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'stuttgart', name: 'Stuttgart', country: 'Germany', league: 'Bundesliga', tier: 3, strength: 74, color: '#E32219', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'mainz', name: 'Mainz', country: 'Germany', league: 'Bundesliga', tier: 4, strength: 61, color: '#C3141E', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'freiburg', name: 'Freiburg', country: 'Germany', league: 'Bundesliga', tier: 4, strength: 68, color: '#000000', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'darmstadt', name: 'Darmstadt', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 52, color: '#004B9E', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  // France - Ligue 1
  { id: 'psg', name: 'Paris', country: 'France', league: 'Ligue 1', tier: 1, strength: 93, color: '#DA001C', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'monaco', name: 'Monaco', country: 'France', league: 'Ligue 1', tier: 1, strength: 82, color: '#E51A22', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'lille', name: 'Lille', country: 'France', league: 'Ligue 1', tier: 2, strength: 80, color: '#E01D2B', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'marseille', name: 'Marseille', country: 'France', league: 'Ligue 1', tier: 2, strength: 79, color: '#2FA0DA', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'lyon', name: 'Lyon', country: 'France', league: 'Ligue 1', tier: 3, strength: 76, color: '#DA0025', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'rennes', name: 'Rennes', country: 'France', league: 'Ligue 1', tier: 3, strength: 74, color: '#E2001A', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'nice', name: 'Nice', country: 'France', league: 'Ligue 1', tier: 4, strength: 71, color: '#941C1F', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'lens', name: 'Lens', country: 'France', league: 'Ligue 1', tier: 4, strength: 72, color: '#FFD200', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'le-havre', name: 'Le Havre', country: 'France', league: 'Ligue 2', tier: 5, strength: 52, color: '#0072CE', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  // Saudi Arabia - Saudi Pro League
  { id: 'al-hilal', name: 'Riyadh Blue', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 1, strength: 84, color: '#1B3D8F', reserveGoalRatio: 0.6, firstTeamGoalRatio: 0.46 },
  { id: 'al-nassr', name: 'Riyadh Gold', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 1, strength: 82, color: '#FED034', reserveGoalRatio: 0.6, firstTeamGoalRatio: 0.46 },
  { id: 'al-ahli', name: 'Jeddah Green', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 2, strength: 78, color: '#006233', reserveGoalRatio: 0.5, firstTeamGoalRatio: 0.4 },
  { id: 'al-ittihad', name: 'Jeddah', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 2, strength: 77, color: '#000000', reserveGoalRatio: 0.5, firstTeamGoalRatio: 0.4 },
  { id: 'al-taawoun', name: 'Buraidah', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 3, strength: 70, color: '#5A2D81', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'al-fateh', name: 'Al-Hasa', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 3, strength: 68, color: '#00843D', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'al-fayha', name: 'Al Majmaah', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 4, strength: 62, color: '#8DC63F', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'al-tai', name: 'Hail', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 4, strength: 60, color: '#6E6F72', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },

  // United States / Canada - MLS
  { id: 'lafc', name: 'Los Angeles', country: 'United States', league: 'MLS', tier: 1, strength: 78, color: '#000000', reserveGoalRatio: 0.6, firstTeamGoalRatio: 0.46 },
  { id: 'inter-miami', name: 'Miami', country: 'United States', league: 'MLS', tier: 1, strength: 77, color: '#F7B5CD', reserveGoalRatio: 0.6, firstTeamGoalRatio: 0.46 },
  { id: 'seattle', name: 'Seattle', country: 'United States', league: 'MLS', tier: 2, strength: 74, color: '#5D9741', reserveGoalRatio: 0.5, firstTeamGoalRatio: 0.4 },
  { id: 'columbus', name: 'Columbus', country: 'United States', league: 'MLS', tier: 2, strength: 73, color: '#FFF200', reserveGoalRatio: 0.5, firstTeamGoalRatio: 0.4 },
  { id: 'philadelphia', name: 'Philadelphia', country: 'United States', league: 'MLS', tier: 3, strength: 70, color: '#00A94F', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'cincinnati', name: 'Cincinnati', country: 'United States', league: 'MLS', tier: 3, strength: 69, color: '#FE5000', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'kansas-city', name: 'Kansas City', country: 'United States', league: 'MLS', tier: 4, strength: 64, color: '#93B1E4', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'nashville', name: 'Nashville', country: 'United States', league: 'MLS', tier: 4, strength: 63, color: '#ECE83A', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'atlanta', name: 'Atlanta', country: 'United States', league: 'MLS', tier: 3, strength: 70, color: '#80000B', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'nycfc', name: 'New York', country: 'United States', league: 'MLS', tier: 3, strength: 68, color: '#6CACE4', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'la-galaxy', name: 'Los Angeles Gold', country: 'United States', league: 'MLS', tier: 3, strength: 67, color: '#00245D', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'portland', name: 'Portland', country: 'United States', league: 'MLS', tier: 4, strength: 65, color: '#004812', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'chicago', name: 'Chicago', country: 'United States', league: 'MLS', tier: 4, strength: 61, color: '#AF2626', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },

  { id: 'brighton', name: 'Brighton', country: 'England', league: 'Premier League', tier: 3, strength: 74, color: '#0057B8', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'west-ham', name: 'East London', country: 'England', league: 'Premier League', tier: 4, strength: 71, color: '#7A263A', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'brentford', name: 'West Thames', country: 'England', league: 'Premier League', tier: 4, strength: 70, color: '#E30613', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },

  { id: 'leicester', name: 'Leicester', country: 'England', league: 'Championship', tier: 4, strength: 72, color: '#003090', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'leeds', name: 'Leeds', country: 'England', league: 'Premier League', tier: 3, strength: 74, color: '#FFCD00', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'southampton', name: 'Southampton', country: 'England', league: 'Championship', tier: 4, strength: 70, color: '#D71920', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'ipswich', name: 'Ipswich', country: 'England', league: 'Championship', tier: 4, strength: 68, color: '#0048A9', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'norwich', name: 'Norwich', country: 'England', league: 'Championship', tier: 4, strength: 66, color: '#FFF200', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'sheff-utd', name: 'Sheffield', country: 'England', league: 'Championship', tier: 4, strength: 65, color: '#EE2737', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'middlesbrough', name: 'Middlesbrough', country: 'England', league: 'Championship', tier: 4, strength: 64, color: '#E4000F', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'coventry', name: 'Coventry', country: 'England', league: 'Championship', tier: 5, strength: 63, color: '#77C1E4', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'watford', name: 'Watford', country: 'England', league: 'Championship', tier: 5, strength: 62, color: '#FBEE23', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'hull', name: 'Hull', country: 'England', league: 'Championship', tier: 5, strength: 61, color: '#F5A12D', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'preston', name: 'Preston', country: 'England', league: 'Championship', tier: 5, strength: 58, color: '#002F6C', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'blackburn', name: 'Blackburn', country: 'England', league: 'Championship', tier: 5, strength: 57, color: '#009EE0', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },

  { id: 'athletic', name: 'Bilbao', country: 'Spain', league: 'La Liga', tier: 3, strength: 78, color: '#EE2523', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'sevilla', name: 'Seville', country: 'Spain', league: 'La Liga', tier: 3, strength: 76, color: '#D61921', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'girona', name: 'Girona', country: 'Spain', league: 'La Liga', tier: 3, strength: 73, color: '#C4122E', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'valencia', name: 'Valencia', country: 'Spain', league: 'La Liga', tier: 4, strength: 72, color: '#EE3524', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'mallorca', name: 'Mallorca', country: 'Spain', league: 'La Liga', tier: 4, strength: 64, color: '#E20613', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },

  { id: 'levante', name: 'Valencia East', country: 'Spain', league: 'La Liga 2', tier: 4, strength: 63, color: '#0033A0', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'valladolid', name: 'Valladolid', country: 'Spain', league: 'La Liga 2', tier: 4, strength: 62, color: '#7B2D8E', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'elche', name: 'Elche', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 61, color: '#007A33', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'oviedo', name: 'Oviedo', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 60, color: '#1B4E9B', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'zaragoza', name: 'Zaragoza', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 59, color: '#0067B1', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'eibar', name: 'Eibar', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 58, color: '#1D1D1B', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'sporting-gijon', name: 'Gijon', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 57, color: '#E20613', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'tenerife', name: 'Tenerife', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 56, color: '#003DA5', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'racing-santander', name: 'Santander', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 55, color: '#0072CE', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'burgos', name: 'Burgos', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 54, color: '#FFFFFF', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },
  { id: 'albacete', name: 'Albacete', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 53, color: '#FFFFFF', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },
  { id: 'racing-ferrol', name: 'Ferrol', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 52, color: '#007A33', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  { id: 'lazio', name: 'Rome Sky', country: 'Italy', league: 'Serie A', tier: 3, strength: 78, color: '#87D8F7', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'bologna', name: 'Bologna', country: 'Italy', league: 'Serie A', tier: 3, strength: 74, color: '#1B1B1B', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'udinese', name: 'Udine', country: 'Italy', league: 'Serie A', tier: 4, strength: 68, color: '#8B1E21', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'genoa', name: 'Genoa', country: 'Italy', league: 'Serie A', tier: 4, strength: 67, color: '#AD1919', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'cagliari', name: 'Cagliari', country: 'Italy', league: 'Serie A', tier: 4, strength: 64, color: '#A00A2D', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },

  { id: 'parma', name: 'Parma', country: 'Italy', league: 'Serie B', tier: 4, strength: 70, color: '#FFE05C', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'como', name: 'Como', country: 'Italy', league: 'Serie A', tier: 3, strength: 72, color: '#003DA5', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'palermo', name: 'Palermo', country: 'Italy', league: 'Serie B', tier: 4, strength: 64, color: '#E5A4CB', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'cremonese', name: 'Cremona', country: 'Italy', league: 'Serie B', tier: 5, strength: 61, color: '#D21034', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'bari', name: 'Bari', country: 'Italy', league: 'Serie B', tier: 5, strength: 60, color: '#FFFFFF', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'sampdoria', name: 'Genoa Doria', country: 'Italy', league: 'Serie B', tier: 5, strength: 59, color: '#004B87', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'brescia', name: 'Brescia', country: 'Italy', league: 'Serie B', tier: 5, strength: 58, color: '#0054A6', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'frosinone', name: 'Frosinone', country: 'Italy', league: 'Serie B', tier: 5, strength: 58, color: '#FFD100', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'spezia', name: 'Spezia', country: 'Italy', league: 'Serie B', tier: 5, strength: 57, color: '#FFFFFF', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'catanzaro', name: 'Catanzaro', country: 'Italy', league: 'Serie B', tier: 5, strength: 56, color: '#E30613', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'cesena', name: 'Cesena', country: 'Italy', league: 'Serie B', tier: 5, strength: 54, color: '#FFFFFF', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },
  { id: 'sudtirol', name: 'Bolzano', country: 'Italy', league: 'Serie B', tier: 5, strength: 53, color: '#FFFFFF', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  { id: 'wolfsburg', name: 'Wolfsburg', country: 'Germany', league: 'Bundesliga', tier: 3, strength: 73, color: '#65B32E', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'union-berlin', name: 'Berlin East', country: 'Germany', league: 'Bundesliga', tier: 4, strength: 72, color: '#EB1923', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'hoffenheim', name: 'Hoffenheim', country: 'Germany', league: 'Bundesliga', tier: 4, strength: 71, color: '#1C63B7', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'werder', name: 'Bremen', country: 'Germany', league: 'Bundesliga', tier: 4, strength: 69, color: '#1D9053', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'augsburg', name: 'Augsburg', country: 'Germany', league: 'Bundesliga', tier: 4, strength: 64, color: '#BA3733', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },

  { id: 'hamburg', name: 'Hamburg', country: 'Germany', league: '2. Bundesliga', tier: 4, strength: 70, color: '#1C63B7', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'koln', name: 'Cologne', country: 'Germany', league: 'Bundesliga', tier: 3, strength: 72, color: '#ED1C24', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'hertha', name: 'Berlin', country: 'Germany', league: '2. Bundesliga', tier: 4, strength: 67, color: '#005CA9', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'schalke', name: 'Gelsenkirchen', country: 'Germany', league: '2. Bundesliga', tier: 4, strength: 66, color: '#004D9D', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'hannover', name: 'Hanover', country: 'Germany', league: '2. Bundesliga', tier: 4, strength: 64, color: '#00993D', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'kiel', name: 'Kiel', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 62, color: '#005CA9', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'kaiserslautern', name: 'Kaiserslautern', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 61, color: '#E30613', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'magdeburg', name: 'Magdeburg', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 60, color: '#005CA9', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'nurnberg', name: 'Nuremberg', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 59, color: '#C4122E', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'paderborn', name: 'Paderborn', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 58, color: '#005CA9', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'greuther-furth', name: 'Furth', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 57, color: '#007A33', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'braunschweig', name: 'Brunswick', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 55, color: '#FDE100', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },

  { id: 'brest', name: 'Brest', country: 'France', league: 'Ligue 1', tier: 4, strength: 71, color: '#E30613', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'strasbourg', name: 'Strasbourg', country: 'France', league: 'Ligue 1', tier: 4, strength: 70, color: '#009FE3', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'reims', name: 'Reims', country: 'France', league: 'Ligue 1', tier: 4, strength: 66, color: '#E30613', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'toulouse', name: 'Toulouse', country: 'France', league: 'Ligue 1', tier: 4, strength: 67, color: '#6C1D45', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'nantes', name: 'Nantes', country: 'France', league: 'Ligue 1', tier: 4, strength: 65, color: '#FFE200', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },

  { id: 'lorient', name: 'Lorient', country: 'France', league: 'Ligue 2', tier: 4, strength: 67, color: '#E87722', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'metz', name: 'Metz', country: 'France', league: 'Ligue 2', tier: 4, strength: 68, color: '#6F0F1C', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'bordeaux', name: 'Bordeaux', country: 'France', league: 'Ligue 2', tier: 5, strength: 63, color: '#001B49', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'paris-fc', name: 'Paris East', country: 'France', league: 'Ligue 2', tier: 5, strength: 61, color: '#003DA5', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'caen', name: 'Caen', country: 'France', league: 'Ligue 2', tier: 5, strength: 60, color: '#E30613', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'guingamp', name: 'Guingamp', country: 'France', league: 'Ligue 2', tier: 5, strength: 59, color: '#E30613', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'grenoble', name: 'Grenoble', country: 'France', league: 'Ligue 2', tier: 5, strength: 58, color: '#003DA5', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'amiens', name: 'Amiens', country: 'France', league: 'Ligue 2', tier: 5, strength: 57, color: '#FFFFFF', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'bastia', name: 'Bastia', country: 'France', league: 'Ligue 2', tier: 5, strength: 56, color: '#003DA5', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'annecy', name: 'Annecy', country: 'France', league: 'Ligue 2', tier: 5, strength: 55, color: '#E30613', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'pau', name: 'Pau', country: 'France', league: 'Ligue 2', tier: 5, strength: 54, color: '#FFD100', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },
  { id: 'rodez', name: 'Rodez', country: 'France', league: 'Ligue 2', tier: 5, strength: 53, color: '#E30613', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  { id: 'al-shabab', name: 'Riyadh White', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 3, strength: 69, color: '#FFFFFF', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'al-ettifaq', name: 'Dammam', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 4, strength: 66, color: '#007A33', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'al-raed', name: 'Buraidah East', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 5, strength: 58, color: '#E30613', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'al-khaleej', name: 'Saihat', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 5, strength: 56, color: '#F5A12D', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'damac', name: 'Khamis Mushait', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 5, strength: 55, color: '#E87722', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },

  { id: 'wolves', name: 'Wolverhampton', country: 'England', league: 'Premier League', tier: 3, strength: 76, color: '#FDB913', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'fulham', name: 'Fulham', country: 'England', league: 'Premier League', tier: 3, strength: 74, color: '#FFFFFF', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'bournemouth', name: 'Bournemouth', country: 'England', league: 'Premier League', tier: 4, strength: 73, color: '#DA291C', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'nottingham-forest', name: 'Nottingham', country: 'England', league: 'Premier League', tier: 3, strength: 75, color: '#E53233', reserveGoalRatio: 0.42, firstTeamGoalRatio: 0.34 },
  { id: 'burnley', name: 'Burnley', country: 'England', league: 'Premier League', tier: 4, strength: 69, color: '#6C1D45', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'sunderland', name: 'Sunderland', country: 'England', league: 'Premier League', tier: 4, strength: 70, color: '#EB172B', reserveGoalRatio: 0.38, firstTeamGoalRatio: 0.3 },

  { id: 'west-brom', name: 'West Bromwich', country: 'England', league: 'Championship', tier: 4, strength: 68, color: '#122F67', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'stoke', name: 'Stoke', country: 'England', league: 'Championship', tier: 4, strength: 64, color: '#E03A3E', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'cardiff', name: 'Cardiff', country: 'England', league: 'Championship', tier: 5, strength: 61, color: '#0070B5', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'swansea', name: 'Swansea', country: 'England', league: 'Championship', tier: 4, strength: 63, color: '#FFFFFF', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'bristol-city', name: 'Bristol', country: 'England', league: 'Championship', tier: 4, strength: 64, color: '#E30613', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'millwall', name: 'Millwall', country: 'England', league: 'Championship', tier: 5, strength: 62, color: '#002F6C', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'qpr', name: 'Shepherds Bush', country: 'England', league: 'Championship', tier: 5, strength: 61, color: '#1D5BA4', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'derby', name: 'Derby', country: 'England', league: 'Championship', tier: 4, strength: 64, color: '#FFFFFF', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'portsmouth', name: 'Portsmouth', country: 'England', league: 'Championship', tier: 5, strength: 60, color: '#003087', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'oxford', name: 'Oxford', country: 'England', league: 'Championship', tier: 5, strength: 59, color: '#F5A12D', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'plymouth', name: 'Plymouth', country: 'England', league: 'Championship', tier: 5, strength: 58, color: '#007A33', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'sheffield-wed', name: 'Sheffield West', country: 'England', league: 'Championship', tier: 5, strength: 60, color: '#3775D5', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },

  { id: 'osasuna', name: 'Pamplona', country: 'Spain', league: 'La Liga', tier: 4, strength: 71, color: '#D91A2A', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'rayo', name: 'Vallecas', country: 'Spain', league: 'La Liga', tier: 4, strength: 70, color: '#E30613', reserveGoalRatio: 0.38, firstTeamGoalRatio: 0.3 },
  { id: 'las-palmas', name: 'Las Palmas', country: 'Spain', league: 'La Liga', tier: 4, strength: 68, color: '#FFD100', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'alaves', name: 'Vitoria', country: 'Spain', league: 'La Liga', tier: 4, strength: 69, color: '#004B9D', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'espanyol', name: 'Barcino Blue', country: 'Spain', league: 'La Liga', tier: 4, strength: 70, color: '#0072CE', reserveGoalRatio: 0.38, firstTeamGoalRatio: 0.3 },
  { id: 'leganes', name: 'Leganes', country: 'Spain', league: 'La Liga', tier: 4, strength: 66, color: '#0055A5', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'cadiz', name: 'Cadiz', country: 'Spain', league: 'La Liga', tier: 4, strength: 65, color: '#FFD100', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },

  { id: 'huesca', name: 'Huesca', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 58, color: '#003DA5', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'cartagena', name: 'Cartagena', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 56, color: '#FFFFFF', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'eldense', name: 'Elda', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 54, color: '#E30613', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },
  { id: 'castellon', name: 'Castellon', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 55, color: '#000000', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'deportivo', name: 'Coruna', country: 'Spain', league: 'La Liga 2', tier: 4, strength: 62, color: '#003DA5', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'malaga', name: 'Malaga', country: 'Spain', league: 'La Liga 2', tier: 4, strength: 61, color: '#005CB9', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'andorra', name: 'Andorra', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 53, color: '#FFD100', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },
  { id: 'mirandes', name: 'Miranda', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 54, color: '#E30613', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },
  { id: 'cordoba', name: 'Cordoba', country: 'Spain', league: 'La Liga 2', tier: 5, strength: 55, color: '#007A33', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },

  { id: 'sassuolo', name: 'Sassuolo', country: 'Italy', league: 'Serie A', tier: 4, strength: 70, color: '#00843D', reserveGoalRatio: 0.38, firstTeamGoalRatio: 0.3 },
  { id: 'empoli', name: 'Empoli', country: 'Italy', league: 'Serie A', tier: 4, strength: 66, color: '#0054A6', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'lecce', name: 'Lecce', country: 'Italy', league: 'Serie A', tier: 4, strength: 65, color: '#E30613', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'verona', name: 'Verona', country: 'Italy', league: 'Serie A', tier: 4, strength: 67, color: '#FFD100', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'monza', name: 'Monza', country: 'Italy', league: 'Serie A', tier: 4, strength: 68, color: '#E30613', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'venezia', name: 'Venice', country: 'Italy', league: 'Serie A', tier: 4, strength: 64, color: '#F5A12D', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },

  { id: 'modena', name: 'Modena', country: 'Italy', league: 'Serie B', tier: 5, strength: 58, color: '#FFD100', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'pisa', name: 'Pisa', country: 'Italy', league: 'Serie B', tier: 4, strength: 63, color: '#001B49', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'ascoli', name: 'Ascoli', country: 'Italy', league: 'Serie B', tier: 5, strength: 56, color: '#000000', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'cosenza', name: 'Cosenza', country: 'Italy', league: 'Serie B', tier: 5, strength: 55, color: '#E30613', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'cittadella', name: 'Cittadella', country: 'Italy', league: 'Serie B', tier: 5, strength: 57, color: '#8B1E21', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'ternana', name: 'Terni', country: 'Italy', league: 'Serie B', tier: 5, strength: 56, color: '#007A33', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'reggiana', name: 'Reggio', country: 'Italy', league: 'Serie B', tier: 5, strength: 54, color: '#8B1E21', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },
  { id: 'avellino', name: 'Avellino', country: 'Italy', league: 'Serie B', tier: 5, strength: 53, color: '#007A33', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  { id: 'gladbach', name: 'Monchengladbach', country: 'Germany', league: 'Bundesliga', tier: 3, strength: 74, color: '#000000', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'heidenheim', name: 'Heidenheim', country: 'Germany', league: 'Bundesliga', tier: 4, strength: 68, color: '#E30613', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'bochum', name: 'Bochum', country: 'Germany', league: 'Bundesliga', tier: 4, strength: 66, color: '#005CA9', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'st-pauli', name: 'Hamburg Harbour', country: 'Germany', league: 'Bundesliga', tier: 4, strength: 67, color: '#8B4513', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },

  { id: 'dusseldorf', name: 'Dusseldorf', country: 'Germany', league: '2. Bundesliga', tier: 4, strength: 66, color: '#E30613', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'karlsruhe', name: 'Karlsruhe', country: 'Germany', league: '2. Bundesliga', tier: 4, strength: 64, color: '#005CA9', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'elversberg', name: 'Elversberg', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 60, color: '#FFFFFF', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'munster', name: 'Munster', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 58, color: '#007A33', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'ulm', name: 'Ulm', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 57, color: '#000000', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'regensburg', name: 'Regensburg', country: 'Germany', league: '2. Bundesliga', tier: 5, strength: 56, color: '#E30613', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },

  { id: 'auxerre', name: 'Auxerre', country: 'France', league: 'Ligue 1', tier: 4, strength: 68, color: '#FFFFFF', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'montpellier', name: 'Montpellier', country: 'France', league: 'Ligue 1', tier: 4, strength: 67, color: '#E87722', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'angers', name: 'Angers', country: 'France', league: 'Ligue 1', tier: 4, strength: 66, color: '#FFFFFF', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'saint-etienne', name: 'Saint-Etienne', country: 'France', league: 'Ligue 1', tier: 4, strength: 69, color: '#007A33', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'clermont', name: 'Clermont', country: 'France', league: 'Ligue 1', tier: 4, strength: 64, color: '#E30613', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },

  { id: 'ajaccio', name: 'Ajaccio', country: 'France', league: 'Ligue 2', tier: 5, strength: 58, color: '#E30613', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'dunkerque', name: 'Dunkirk', country: 'France', league: 'Ligue 2', tier: 5, strength: 56, color: '#003DA5', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'troyes', name: 'Troyes', country: 'France', league: 'Ligue 2', tier: 4, strength: 62, color: '#005CA9', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'laval', name: 'Laval', country: 'France', league: 'Ligue 2', tier: 5, strength: 57, color: '#F5A12D', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'martigues', name: 'Martigues', country: 'France', league: 'Ligue 2', tier: 5, strength: 54, color: '#E30613', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  { id: 'al-wehda', name: 'Mecca', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 5, strength: 60, color: '#E30613', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'al-okhdood', name: 'Najran', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 5, strength: 57, color: '#007A33', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'al-riyadh', name: 'Riyadh', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 5, strength: 58, color: '#FFFFFF', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'abha', name: 'Abha', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 5, strength: 56, color: '#E30613', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },
  { id: 'al-hazem', name: 'Al-Rass', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 5, strength: 55, color: '#FFD100', reserveGoalRatio: 0.26, firstTeamGoalRatio: 0.23 },

  { id: 'austin', name: 'Austin', country: 'United States', league: 'MLS', tier: 4, strength: 66, color: '#00B140', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'orlando', name: 'Orlando', country: 'United States', league: 'MLS', tier: 3, strength: 68, color: '#633492', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'minnesota', name: 'Minnesota', country: 'United States', league: 'MLS', tier: 4, strength: 65, color: '#8CD2F4', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'dallas', name: 'Dallas', country: 'United States', league: 'MLS', tier: 4, strength: 64, color: '#E30613', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'houston', name: 'Houston', country: 'United States', league: 'MLS', tier: 4, strength: 64, color: '#F68712', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'montreal', name: 'Montreal', country: 'United States', league: 'MLS', tier: 4, strength: 63, color: '#003DA5', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'toronto', name: 'Toronto', country: 'United States', league: 'MLS', tier: 4, strength: 62, color: '#B11226', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'vancouver', name: 'Vancouver', country: 'United States', league: 'MLS', tier: 4, strength: 66, color: '#00245D', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'colorado', name: 'Colorado', country: 'United States', league: 'MLS', tier: 4, strength: 63, color: '#91022D', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'salt-lake', name: 'Salt Lake', country: 'United States', league: 'MLS', tier: 4, strength: 65, color: '#B30838', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'new-england', name: 'New England', country: 'United States', league: 'MLS', tier: 4, strength: 64, color: '#0A2240', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'ny-red-bulls', name: 'Harrison', country: 'United States', league: 'MLS', tier: 3, strength: 67, color: '#ED1C24', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'charlotte', name: 'Charlotte', country: 'United States', league: 'MLS', tier: 4, strength: 63, color: '#1A85C8', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'st-louis', name: 'St. Louis', country: 'United States', league: 'MLS', tier: 4, strength: 64, color: '#E30613', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'dc-united', name: 'Washington', country: 'United States', league: 'MLS', tier: 4, strength: 61, color: '#000000', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },

  // Portugal - Primeira Liga
  { id: 'benfica', name: 'Lisbon', country: 'Portugal', league: 'Primeira Liga', tier: 2, strength: 84, color: '#E30613', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'porto', name: 'Porto', country: 'Portugal', league: 'Primeira Liga', tier: 2, strength: 83, color: '#003087', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'sporting', name: 'Lisbon Green', country: 'Portugal', league: 'Primeira Liga', tier: 2, strength: 82, color: '#008057', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'braga', name: 'Braga', country: 'Portugal', league: 'Primeira Liga', tier: 3, strength: 76, color: '#E30613', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'vitoria-guimaraes', name: 'Guimaraes', country: 'Portugal', league: 'Primeira Liga', tier: 4, strength: 70, color: '#FFFFFF', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'famalicao', name: 'Famalicao', country: 'Portugal', league: 'Primeira Liga', tier: 4, strength: 67, color: '#003DA5', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'casa-pia', name: 'Lisbon Black', country: 'Portugal', league: 'Primeira Liga', tier: 4, strength: 64, color: '#111111', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'rio-ave', name: 'Vila do Conde', country: 'Portugal', league: 'Primeira Liga', tier: 4, strength: 65, color: '#007A33', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'gil-vicente', name: 'Barcelos', country: 'Portugal', league: 'Primeira Liga', tier: 4, strength: 64, color: '#E30613', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'moreirense', name: 'Moreira', country: 'Portugal', league: 'Primeira Liga', tier: 4, strength: 63, color: '#007A33', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'estoril', name: 'Estoril', country: 'Portugal', league: 'Primeira Liga', tier: 4, strength: 63, color: '#FFD100', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'santa-clara', name: 'Ponta Delgada', country: 'Portugal', league: 'Primeira Liga', tier: 4, strength: 64, color: '#E30613', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'arouca', name: 'Arouca', country: 'Portugal', league: 'Primeira Liga', tier: 5, strength: 62, color: '#F5C518', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'boavista', name: 'Porto Chequered', country: 'Portugal', league: 'Primeira Liga', tier: 5, strength: 62, color: '#111111', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'nacional', name: 'Funchal', country: 'Portugal', league: 'Primeira Liga', tier: 5, strength: 61, color: '#111111', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'estrela', name: 'Amadora', country: 'Portugal', league: 'Primeira Liga', tier: 5, strength: 60, color: '#E30613', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'avs', name: 'Vila das Aves', country: 'Portugal', league: 'Primeira Liga', tier: 5, strength: 59, color: '#6B1E3A', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'farense', name: 'Faro', country: 'Portugal', league: 'Primeira Liga', tier: 5, strength: 59, color: '#111111', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },

  // Netherlands - Eredivisie
  { id: 'ajax', name: 'Amsterdam', country: 'Netherlands', league: 'Eredivisie', tier: 2, strength: 85, color: '#D2122E', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'psv', name: 'Eindhoven', country: 'Netherlands', league: 'Eredivisie', tier: 2, strength: 84, color: '#E30613', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'feyenoord', name: 'Rotterdam', country: 'Netherlands', league: 'Eredivisie', tier: 2, strength: 83, color: '#E30613', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'az', name: 'Alkmaar', country: 'Netherlands', league: 'Eredivisie', tier: 3, strength: 76, color: '#E30613', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'twente', name: 'Enschede', country: 'Netherlands', league: 'Eredivisie', tier: 4, strength: 73, color: '#E30613', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'utrecht', name: 'Utrecht', country: 'Netherlands', league: 'Eredivisie', tier: 4, strength: 70, color: '#E30613', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'sparta-rotterdam', name: 'Rotterdam North', country: 'Netherlands', league: 'Eredivisie', tier: 4, strength: 66, color: '#E30613', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'heerenveen', name: 'Heerenveen', country: 'Netherlands', league: 'Eredivisie', tier: 4, strength: 65, color: '#003DA5', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'groningen', name: 'Groningen', country: 'Netherlands', league: 'Eredivisie', tier: 4, strength: 65, color: '#007A33', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'go-ahead-eagles', name: 'Deventer', country: 'Netherlands', league: 'Eredivisie', tier: 4, strength: 64, color: '#F5C518', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'nec', name: 'Nijmegen', country: 'Netherlands', league: 'Eredivisie', tier: 4, strength: 64, color: '#E30613', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'nac-breda', name: 'Breda', country: 'Netherlands', league: 'Eredivisie', tier: 4, strength: 63, color: '#F5C518', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'pec-zwolle', name: 'Zwolle', country: 'Netherlands', league: 'Eredivisie', tier: 5, strength: 62, color: '#003DA5', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'fortuna-sittard', name: 'Sittard', country: 'Netherlands', league: 'Eredivisie', tier: 5, strength: 62, color: '#F5C518', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'heracles', name: 'Almelo', country: 'Netherlands', league: 'Eredivisie', tier: 5, strength: 61, color: '#111111', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'willem-ii', name: 'Tilburg', country: 'Netherlands', league: 'Eredivisie', tier: 5, strength: 61, color: '#003DA5', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'almere', name: 'Almere', country: 'Netherlands', league: 'Eredivisie', tier: 5, strength: 59, color: '#E30613', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'volendam', name: 'Volendam', country: 'Netherlands', league: 'Eredivisie', tier: 5, strength: 58, color: '#F5A12D', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },

  // Turkey - Super Lig
  { id: 'galatasaray', name: 'Istanbul Gold', country: 'Turkey', league: 'Super Lig', tier: 2, strength: 84, color: '#F68B1F', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'fenerbahce', name: 'Istanbul Yellow', country: 'Turkey', league: 'Super Lig', tier: 2, strength: 83, color: '#003399', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'besiktas', name: 'Istanbul Black', country: 'Turkey', league: 'Super Lig', tier: 3, strength: 80, color: '#111111', reserveGoalRatio: 0.5, firstTeamGoalRatio: 0.4 },
  { id: 'trabzonspor', name: 'Trabzon', country: 'Turkey', league: 'Super Lig', tier: 3, strength: 76, color: '#6B1E3A', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'istanbul-basaksehir', name: 'Istanbul East', country: 'Turkey', league: 'Super Lig', tier: 4, strength: 72, color: '#F68B1F', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'samsunspor', name: 'Samsun', country: 'Turkey', league: 'Super Lig', tier: 4, strength: 70, color: '#E30613', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'goztepe', name: 'Izmir', country: 'Turkey', league: 'Super Lig', tier: 4, strength: 68, color: '#F5C518', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'konyaspor', name: 'Konya', country: 'Turkey', league: 'Super Lig', tier: 4, strength: 67, color: '#007A33', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'antalyaspor', name: 'Antalya', country: 'Turkey', league: 'Super Lig', tier: 4, strength: 66, color: '#E30613', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'alanyaspor', name: 'Alanya', country: 'Turkey', league: 'Super Lig', tier: 4, strength: 66, color: '#F68B1F', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'kasimpasa', name: 'Istanbul Shore', country: 'Turkey', league: 'Super Lig', tier: 4, strength: 65, color: '#003DA5', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'gaziantep', name: 'Gaziantep', country: 'Turkey', league: 'Super Lig', tier: 4, strength: 65, color: '#E30613', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'eyupspor', name: 'Istanbul Eyup', country: 'Turkey', league: 'Super Lig', tier: 4, strength: 65, color: '#5B2C6F', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'rizespor', name: 'Rize', country: 'Turkey', league: 'Super Lig', tier: 4, strength: 64, color: '#003DA5', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'sivasspor', name: 'Sivas', country: 'Turkey', league: 'Super Lig', tier: 4, strength: 64, color: '#E30613', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'kayserispor', name: 'Kayseri', country: 'Turkey', league: 'Super Lig', tier: 5, strength: 63, color: '#E30613', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'hatayspor', name: 'Hatay', country: 'Turkey', league: 'Super Lig', tier: 5, strength: 62, color: '#6B1E3A', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'kocaelispor', name: 'Kocaeli', country: 'Turkey', league: 'Super Lig', tier: 5, strength: 61, color: '#007A33', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },

  // Mexico - Liga MX
  { id: 'club-america', name: 'Mexico City', country: 'Mexico', league: 'Liga MX', tier: 2, strength: 80, color: '#FFD100', reserveGoalRatio: 0.5, firstTeamGoalRatio: 0.4 },
  { id: 'monterrey', name: 'Monterrey', country: 'Mexico', league: 'Liga MX', tier: 2, strength: 79, color: '#003DA5', reserveGoalRatio: 0.5, firstTeamGoalRatio: 0.4 },
  { id: 'tigres', name: 'Monterrey Gold', country: 'Mexico', league: 'Liga MX', tier: 2, strength: 78, color: '#F5A12D', reserveGoalRatio: 0.5, firstTeamGoalRatio: 0.4 },
  { id: 'chivas', name: 'Guadalajara', country: 'Mexico', league: 'Liga MX', tier: 2, strength: 77, color: '#E30613', reserveGoalRatio: 0.48, firstTeamGoalRatio: 0.38 },
  { id: 'cruz-azul', name: 'Mexico City Blue', country: 'Mexico', league: 'Liga MX', tier: 2, strength: 76, color: '#003DA5', reserveGoalRatio: 0.48, firstTeamGoalRatio: 0.38 },
  { id: 'pumas', name: 'Mexico City South', country: 'Mexico', league: 'Liga MX', tier: 3, strength: 73, color: '#002D62', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'toluca', name: 'Toluca', country: 'Mexico', league: 'Liga MX', tier: 3, strength: 74, color: '#E30613', reserveGoalRatio: 0.42, firstTeamGoalRatio: 0.34 },
  { id: 'leon', name: 'Leon', country: 'Mexico', league: 'Liga MX', tier: 3, strength: 72, color: '#007A33', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'santos-laguna', name: 'Torreon', country: 'Mexico', league: 'Liga MX', tier: 3, strength: 71, color: '#007A33', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'pachuca', name: 'Pachuca', country: 'Mexico', league: 'Liga MX', tier: 3, strength: 73, color: '#003DA5', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'tijuana', name: 'Tijuana', country: 'Mexico', league: 'Liga MX', tier: 3, strength: 70, color: '#E30613', reserveGoalRatio: 0.38, firstTeamGoalRatio: 0.3 },
  { id: 'atlas', name: 'Guadalajara Red', country: 'Mexico', league: 'Liga MX', tier: 3, strength: 70, color: '#6B1E3A', reserveGoalRatio: 0.38, firstTeamGoalRatio: 0.3 },
  { id: 'puebla', name: 'Puebla', country: 'Mexico', league: 'Liga MX', tier: 4, strength: 67, color: '#003DA5', reserveGoalRatio: 0.34, firstTeamGoalRatio: 0.28 },
  { id: 'queretaro', name: 'Queretaro', country: 'Mexico', league: 'Liga MX', tier: 4, strength: 66, color: '#003DA5', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'necaxa', name: 'Aguascalientes', country: 'Mexico', league: 'Liga MX', tier: 4, strength: 66, color: '#E30613', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'mazatlan', name: 'Mazatlan', country: 'Mexico', league: 'Liga MX', tier: 4, strength: 64, color: '#6B1E3A', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'juarez', name: 'Ciudad Juarez', country: 'Mexico', league: 'Liga MX', tier: 4, strength: 64, color: '#007A33', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'san-luis', name: 'San Luis Potosi', country: 'Mexico', league: 'Liga MX', tier: 4, strength: 63, color: '#003DA5', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },

  // Brazil - Brasileirao
  { id: 'flamengo-rj', name: 'Rio Red', country: 'Brazil', league: 'Brasileirao', tier: 2, strength: 86, color: '#E30613', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.44 },
  { id: 'palmeiras-sp', name: 'Sao Paulo Green', country: 'Brazil', league: 'Brasileirao', tier: 2, strength: 85, color: '#007A33', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.44 },
  { id: 'botafogo', name: 'Rio Black', country: 'Brazil', league: 'Brasileirao', tier: 2, strength: 83, color: '#111111', reserveGoalRatio: 0.52, firstTeamGoalRatio: 0.42 },
  { id: 'fluminense', name: 'Rio Green', country: 'Brazil', league: 'Brasileirao', tier: 2, strength: 82, color: '#006400', reserveGoalRatio: 0.5, firstTeamGoalRatio: 0.4 },
  { id: 'sao-paulo', name: 'Sao Paulo White', country: 'Brazil', league: 'Brasileirao', tier: 2, strength: 82, color: '#E30613', reserveGoalRatio: 0.5, firstTeamGoalRatio: 0.4 },
  { id: 'corinthians-sp', name: 'Sao Paulo Black', country: 'Brazil', league: 'Brasileirao', tier: 2, strength: 81, color: '#111111', reserveGoalRatio: 0.48, firstTeamGoalRatio: 0.38 },
  { id: 'atletico-mg', name: 'Belo Horizonte', country: 'Brazil', league: 'Brasileirao', tier: 2, strength: 80, color: '#111111', reserveGoalRatio: 0.48, firstTeamGoalRatio: 0.38 },
  { id: 'internacional', name: 'Porto Alegre Red', country: 'Brazil', league: 'Brasileirao', tier: 3, strength: 79, color: '#E30613', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.36 },
  { id: 'gremio', name: 'Porto Alegre Blue', country: 'Brazil', league: 'Brasileirao', tier: 3, strength: 78, color: '#003DA5', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.36 },
  { id: 'cruzeiro', name: 'Belo Horizonte Blue', country: 'Brazil', league: 'Brasileirao', tier: 3, strength: 77, color: '#003DA5', reserveGoalRatio: 0.42, firstTeamGoalRatio: 0.34 },
  { id: 'athletico-pr', name: 'Curitiba', country: 'Brazil', league: 'Brasileirao', tier: 3, strength: 76, color: '#E30613', reserveGoalRatio: 0.42, firstTeamGoalRatio: 0.34 },
  { id: 'bahia', name: 'Salvador Blue', country: 'Brazil', league: 'Brasileirao', tier: 3, strength: 75, color: '#003DA5', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'fortaleza', name: 'Fortaleza', country: 'Brazil', league: 'Brasileirao', tier: 3, strength: 74, color: '#E30613', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'vasco', name: 'Rio Cross', country: 'Brazil', league: 'Brasileirao', tier: 3, strength: 73, color: '#111111', reserveGoalRatio: 0.38, firstTeamGoalRatio: 0.3 },
  { id: 'santos', name: 'Santos', country: 'Brazil', league: 'Brasileirao', tier: 3, strength: 73, color: '#111111', reserveGoalRatio: 0.38, firstTeamGoalRatio: 0.3 },
  { id: 'bragantino', name: 'Braganca', country: 'Brazil', league: 'Brasileirao', tier: 4, strength: 72, color: '#E30613', reserveGoalRatio: 0.36, firstTeamGoalRatio: 0.3 },
  { id: 'cuiaba', name: 'Cuiaba', country: 'Brazil', league: 'Brasileirao', tier: 4, strength: 68, color: '#007A33', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'goias', name: 'Goiania', country: 'Brazil', league: 'Brasileirao', tier: 4, strength: 67, color: '#007A33', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },

  // Argentina - Liga Profesional
  { id: 'river-plate', name: 'Buenos Aires Red', country: 'Argentina', league: 'Liga Profesional', tier: 2, strength: 85, color: '#E30613', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.44 },
  { id: 'boca-juniors', name: 'Buenos Aires Blue', country: 'Argentina', league: 'Liga Profesional', tier: 2, strength: 84, color: '#003DA5', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.44 },
  { id: 'racing-club', name: 'Avellaneda Blue', country: 'Argentina', league: 'Liga Profesional', tier: 2, strength: 80, color: '#6EC1E4', reserveGoalRatio: 0.48, firstTeamGoalRatio: 0.38 },
  { id: 'independiente', name: 'Avellaneda Red', country: 'Argentina', league: 'Liga Profesional', tier: 2, strength: 79, color: '#E30613', reserveGoalRatio: 0.48, firstTeamGoalRatio: 0.38 },
  { id: 'san-lorenzo', name: 'Buenos Aires Green', country: 'Argentina', league: 'Liga Profesional', tier: 3, strength: 77, color: '#003DA5', reserveGoalRatio: 0.42, firstTeamGoalRatio: 0.34 },
  { id: 'estudiantes', name: 'La Plata', country: 'Argentina', league: 'Liga Profesional', tier: 3, strength: 76, color: '#E30613', reserveGoalRatio: 0.42, firstTeamGoalRatio: 0.34 },
  { id: 'velez', name: 'Buenos Aires White', country: 'Argentina', league: 'Liga Profesional', tier: 3, strength: 76, color: '#FFFFFF', reserveGoalRatio: 0.42, firstTeamGoalRatio: 0.34 },
  { id: 'talleres', name: 'Cordoba', country: 'Argentina', league: 'Liga Profesional', tier: 3, strength: 75, color: '#003DA5', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'rosario-central', name: 'Rosario Yellow', country: 'Argentina', league: 'Liga Profesional', tier: 3, strength: 73, color: '#F5C518', reserveGoalRatio: 0.38, firstTeamGoalRatio: 0.3 },
  { id: 'newells', name: 'Rosario Red', country: 'Argentina', league: 'Liga Profesional', tier: 3, strength: 73, color: '#E30613', reserveGoalRatio: 0.38, firstTeamGoalRatio: 0.3 },
  { id: 'lanus', name: 'Lanus', country: 'Argentina', league: 'Liga Profesional', tier: 3, strength: 72, color: '#6B1E3A', reserveGoalRatio: 0.36, firstTeamGoalRatio: 0.3 },
  { id: 'huracan', name: 'Buenos Aires Balloon', country: 'Argentina', league: 'Liga Profesional', tier: 4, strength: 70, color: '#E30613', reserveGoalRatio: 0.34, firstTeamGoalRatio: 0.28 },
  { id: 'gimnasia-lp', name: 'La Plata Wolf', country: 'Argentina', league: 'Liga Profesional', tier: 4, strength: 69, color: '#003DA5', reserveGoalRatio: 0.34, firstTeamGoalRatio: 0.28 },
  { id: 'belgrano', name: 'Cordoba Green', country: 'Argentina', league: 'Liga Profesional', tier: 4, strength: 68, color: '#6EC1E4', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'argentinos', name: 'Buenos Aires Bajo', country: 'Argentina', league: 'Liga Profesional', tier: 4, strength: 68, color: '#E30613', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'defensa', name: 'Florencio Varela', country: 'Argentina', league: 'Liga Profesional', tier: 4, strength: 67, color: '#007A33', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'instituto', name: 'Cordoba Red', country: 'Argentina', league: 'Liga Profesional', tier: 4, strength: 66, color: '#E30613', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'tigre', name: 'Victoria', country: 'Argentina', league: 'Liga Profesional', tier: 4, strength: 65, color: '#003DA5', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },

  // Colombia - Primera A
  { id: 'atletico-nacional', name: 'Medellin Green', country: 'Colombia', league: 'Primera A', tier: 3, strength: 78, color: '#007A33', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.36 },
  { id: 'millonarios', name: 'Bogota Blue', country: 'Colombia', league: 'Primera A', tier: 3, strength: 77, color: '#003DA5', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.36 },
  { id: 'america-cali', name: 'Cali Red', country: 'Colombia', league: 'Primera A', tier: 3, strength: 76, color: '#E30613', reserveGoalRatio: 0.42, firstTeamGoalRatio: 0.34 },
  { id: 'independiente-medellin', name: 'Medellin Red', country: 'Colombia', league: 'Primera A', tier: 3, strength: 75, color: '#E30613', reserveGoalRatio: 0.42, firstTeamGoalRatio: 0.34 },
  { id: 'junior-baq', name: 'Barranquilla', country: 'Colombia', league: 'Primera A', tier: 3, strength: 75, color: '#E30613', reserveGoalRatio: 0.42, firstTeamGoalRatio: 0.34 },
  { id: 'santa-fe', name: 'Bogota Red', country: 'Colombia', league: 'Primera A', tier: 3, strength: 74, color: '#E30613', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'deportivo-cali', name: 'Cali Green', country: 'Colombia', league: 'Primera A', tier: 3, strength: 73, color: '#007A33', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'deportes-tolima', name: 'Ibague', country: 'Colombia', league: 'Primera A', tier: 3, strength: 73, color: '#F5C518', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'once-caldas', name: 'Manizales', country: 'Colombia', league: 'Primera A', tier: 4, strength: 70, color: '#FFFFFF', reserveGoalRatio: 0.34, firstTeamGoalRatio: 0.28 },
  { id: 'atletico-bucaramanga', name: 'Bucaramanga', country: 'Colombia', league: 'Primera A', tier: 4, strength: 69, color: '#FFD100', reserveGoalRatio: 0.34, firstTeamGoalRatio: 0.28 },
  { id: 'aguilas-doradas', name: 'Pereira', country: 'Colombia', league: 'Primera A', tier: 4, strength: 68, color: '#F5A12D', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'la-equidad', name: 'Bogota White', country: 'Colombia', league: 'Primera A', tier: 4, strength: 67, color: '#007A33', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'envigado', name: 'Envigado', country: 'Colombia', league: 'Primera A', tier: 4, strength: 66, color: '#F5A12D', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'alianza-fc', name: 'Valledupar', country: 'Colombia', league: 'Primera A', tier: 4, strength: 65, color: '#FFD100', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'jaguares', name: 'Monteria', country: 'Colombia', league: 'Primera A', tier: 4, strength: 64, color: '#007A33', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'fortaleza-ce', name: 'Bogota Fort', country: 'Colombia', league: 'Primera A', tier: 4, strength: 63, color: '#003DA5', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'patriotas', name: 'Tunja', country: 'Colombia', league: 'Primera A', tier: 4, strength: 62, color: '#E30613', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },
  { id: 'boyaca-chico', name: 'Tunja Green', country: 'Colombia', league: 'Primera A', tier: 4, strength: 61, color: '#007A33', reserveGoalRatio: 0.28, firstTeamGoalRatio: 0.24 },

  // Japan - J1 League
  { id: 'urawa', name: 'Saitama', country: 'Japan', league: 'J1 League', tier: 2, strength: 76, color: '#E30613', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.36 },
  { id: 'kawasaki', name: 'Kawasaki', country: 'Japan', league: 'J1 League', tier: 2, strength: 75, color: '#87CEEB', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.36 },
  { id: 'yokohama-fm', name: 'Yokohama', country: 'Japan', league: 'J1 League', tier: 2, strength: 74, color: '#003DA5', reserveGoalRatio: 0.42, firstTeamGoalRatio: 0.34 },
  { id: 'vissel-kobe', name: 'Kobe', country: 'Japan', league: 'J1 League', tier: 2, strength: 74, color: '#6B1E3A', reserveGoalRatio: 0.42, firstTeamGoalRatio: 0.34 },
  { id: 'kashima', name: 'Kashima', country: 'Japan', league: 'J1 League', tier: 2, strength: 73, color: '#E30613', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'sanfrecce', name: 'Hiroshima', country: 'Japan', league: 'J1 League', tier: 3, strength: 72, color: '#6B1E3A', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'gamba-osaka', name: 'Osaka Blue', country: 'Japan', league: 'J1 League', tier: 3, strength: 72, color: '#003DA5', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'nagoya', name: 'Nagoya', country: 'Japan', league: 'J1 League', tier: 3, strength: 71, color: '#E30613', reserveGoalRatio: 0.38, firstTeamGoalRatio: 0.3 },
  { id: 'fc-tokyo', name: 'Tokyo Blue', country: 'Japan', league: 'J1 League', tier: 3, strength: 71, color: '#003DA5', reserveGoalRatio: 0.38, firstTeamGoalRatio: 0.3 },
  { id: 'cerezo-osaka', name: 'Osaka Pink', country: 'Japan', league: 'J1 League', tier: 3, strength: 70, color: '#E75480', reserveGoalRatio: 0.38, firstTeamGoalRatio: 0.3 },
  { id: 'tokyo-verdy', name: 'Tokyo Green', country: 'Japan', league: 'J1 League', tier: 3, strength: 69, color: '#007A33', reserveGoalRatio: 0.36, firstTeamGoalRatio: 0.28 },
  { id: 'kashiwa', name: 'Kashiwa', country: 'Japan', league: 'J1 League', tier: 3, strength: 69, color: '#FFD100', reserveGoalRatio: 0.36, firstTeamGoalRatio: 0.28 },
  { id: 'kyoto', name: 'Kyoto', country: 'Japan', league: 'J1 League', tier: 4, strength: 67, color: '#6B1E3A', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'shimizu', name: 'Shizuoka', country: 'Japan', league: 'J1 League', tier: 4, strength: 66, color: '#F68B1F', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'machida', name: 'Machida', country: 'Japan', league: 'J1 League', tier: 4, strength: 66, color: '#003DA5', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'consadole', name: 'Sapporo', country: 'Japan', league: 'J1 League', tier: 4, strength: 65, color: '#E30613', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'shonan', name: 'Hiratsuka', country: 'Japan', league: 'J1 League', tier: 4, strength: 64, color: '#007A33', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },
  { id: 'albirex', name: 'Niigata', country: 'Japan', league: 'J1 League', tier: 4, strength: 63, color: '#F68B1F', reserveGoalRatio: 0.3, firstTeamGoalRatio: 0.25 },

  // AFC Champions League Elite opponents
  { id: 'ulsan', name: 'Ulsan', country: 'South Korea', league: 'K League 1', tier: 2, strength: 76, color: '#003DA5', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.36, playable: false },
  { id: 'jeonbuk', name: 'Jeonju', country: 'South Korea', league: 'K League 1', tier: 2, strength: 74, color: '#007A33', reserveGoalRatio: 0.42, firstTeamGoalRatio: 0.34, playable: false },
  { id: 'al-ain', name: 'Al Ain', country: 'United Arab Emirates', league: 'UAE Pro League', tier: 2, strength: 75, color: '#8B1E21', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.36, playable: false },
  { id: 'al-wasl', name: 'Dubai', country: 'United Arab Emirates', league: 'UAE Pro League', tier: 3, strength: 70, color: '#FFD100', reserveGoalRatio: 0.38, firstTeamGoalRatio: 0.3, playable: false },
  { id: 'al-sadd', name: 'Doha', country: 'Qatar', league: 'Qatar Stars League', tier: 2, strength: 76, color: '#000000', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.36, playable: false },
  { id: 'al-duhail', name: 'Doha Red', country: 'Qatar', league: 'Qatar Stars League', tier: 2, strength: 74, color: '#E30613', reserveGoalRatio: 0.42, firstTeamGoalRatio: 0.34, playable: false },
  { id: 'persepolis', name: 'Tehran Red', country: 'Iran', league: 'Persian Gulf Pro League', tier: 2, strength: 73, color: '#E30613', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32, playable: false },
  { id: 'esteghlal', name: 'Tehran Blue', country: 'Iran', league: 'Persian Gulf Pro League', tier: 2, strength: 72, color: '#003DA5', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32, playable: false },
  { id: 'shanghai-port', name: 'Shanghai', country: 'China PR', league: 'Chinese Super League', tier: 2, strength: 73, color: '#E30613', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32, playable: false },

  // Champions League guests from associations outside the playable pyramid
  { id: 'bodo-glimt', name: 'Bodo', country: 'Norway', league: 'Eliteserien', tier: 3, strength: 76, color: '#FFD100', reserveGoalRatio: 0.42, firstTeamGoalRatio: 0.34, playable: false },
  { id: 'viking', name: 'Stavanger', country: 'Norway', league: 'Eliteserien', tier: 4, strength: 68, color: '#111111', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28, playable: false },
  { id: 'lask', name: 'Linz', country: 'Austria', league: 'Austrian Bundesliga', tier: 3, strength: 72, color: '#111111', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32, playable: false },
  { id: 'sabah', name: 'Baku', country: 'Azerbaijan', league: 'Azerbaijan Premier League', tier: 4, strength: 64, color: '#E30613', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26, playable: false },
  { id: 'club-brugge', name: 'Bruges', country: 'Belgium', league: 'Belgian Pro League', tier: 2, strength: 80, color: '#003DA5', reserveGoalRatio: 0.5, firstTeamGoalRatio: 0.4, playable: false },
  { id: 'slavia-prague', name: 'Prague', country: 'Czechia', league: 'Czech First League', tier: 3, strength: 78, color: '#E30613', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.36, playable: false },
  { id: 'aek-athens', name: 'Athens', country: 'Greece', league: 'Super League Greece', tier: 3, strength: 74, color: '#FFD100', reserveGoalRatio: 0.42, firstTeamGoalRatio: 0.34, playable: false },
  { id: 'slovan-bratislava', name: 'Bratislava', country: 'Slovakia', league: 'Slovak Super Liga', tier: 4, strength: 70, color: '#6EC1E4', reserveGoalRatio: 0.38, firstTeamGoalRatio: 0.3, playable: false },
  { id: 'shakhtar', name: 'Donetsk', country: 'Ukraine', league: 'Ukrainian Premier League', tier: 2, strength: 79, color: '#F68712', reserveGoalRatio: 0.48, firstTeamGoalRatio: 0.38, playable: false },
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
 * top-flight club drops out). MLS uses the full 28-club pool.
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

/** 14 Eastern + 14 Western, always including the player. */
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
  'Primeira Liga': 18,
  Eredivisie: 18,
  'Super Lig': 18,
  'Saudi Pro League': 18,
  MLS: 28,
  'Liga MX': 18,
  Brasileirao: 18,
  'Liga Profesional': 18,
  'Primera A': 18,
  'J1 League': 18,
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
