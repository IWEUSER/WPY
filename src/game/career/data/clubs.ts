/**
 * The football pyramid this career mode plays out across: major European
 * leagues plus Saudi Arabia and MLS, as requested. This is a representative
 * slice rather than every club in every division - tiers 1 (elite) through 5
 * (smallest) exist so the trial and transfer logic has real headroom, but the
 * exact roster of clubs/leagues can be expanded later without touching any
 * of the game logic that reads this data.
 */

/** 1 = elite (Champions League regulars), 5 = smallest clubs in the game. */
export type ClubTier = 1 | 2 | 3 | 4 | 5;

export interface Club {
  id: string;
  name: string;
  country: string;
  league: string;
  tier: ClubTier;
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

export const CLUBS: Club[] = [
  // England - Premier League
  { id: 'man-city', name: 'Manchester City', country: 'England', league: 'Premier League', tier: 1, color: '#6CABDD', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'liverpool', name: 'Liverpool', country: 'England', league: 'Premier League', tier: 1, color: '#C8102E', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'arsenal', name: 'Arsenal', country: 'England', league: 'Premier League', tier: 2, color: '#EF0107', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'chelsea', name: 'Chelsea', country: 'England', league: 'Premier League', tier: 2, color: '#034694', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'newcastle', name: 'Newcastle United', country: 'England', league: 'Premier League', tier: 3, color: '#241F20', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'aston-villa', name: 'Aston Villa', country: 'England', league: 'Premier League', tier: 3, color: '#95BFE5', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'crystal-palace', name: 'Crystal Palace', country: 'England', league: 'Premier League', tier: 4, color: '#1B458F', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'everton', name: 'Everton', country: 'England', league: 'Premier League', tier: 4, color: '#003399', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'luton', name: 'Luton Town', country: 'England', league: 'Championship', tier: 5, color: '#F78F1E', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  // Spain - La Liga
  { id: 'real-madrid', name: 'Real Madrid', country: 'Spain', league: 'La Liga', tier: 1, color: '#FEBE10', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'barcelona', name: 'Barcelona', country: 'Spain', league: 'La Liga', tier: 1, color: '#A50044', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'atletico-madrid', name: 'Atl\u00e9tico Madrid', country: 'Spain', league: 'La Liga', tier: 2, color: '#CB3524', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'real-sociedad', name: 'Real Sociedad', country: 'Spain', league: 'La Liga', tier: 2, color: '#0A3F87', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'villarreal', name: 'Villarreal', country: 'Spain', league: 'La Liga', tier: 3, color: '#FFE667', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'real-betis', name: 'Real Betis', country: 'Spain', league: 'La Liga', tier: 3, color: '#00954C', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'getafe', name: 'Getafe', country: 'Spain', league: 'La Liga', tier: 4, color: '#005999', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'celta-vigo', name: 'Celta Vigo', country: 'Spain', league: 'La Liga', tier: 4, color: '#8AC3EE', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'almeria', name: 'Almer\u00eda', country: 'Spain', league: 'La Liga 2', tier: 5, color: '#D2122E', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  // Italy - Serie A
  { id: 'inter', name: 'Inter Milan', country: 'Italy', league: 'Serie A', tier: 1, color: '#03256C', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'napoli', name: 'Napoli', country: 'Italy', league: 'Serie A', tier: 1, color: '#12A0D7', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'ac-milan', name: 'AC Milan', country: 'Italy', league: 'Serie A', tier: 2, color: '#FB090B', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'juventus', name: 'Juventus', country: 'Italy', league: 'Serie A', tier: 2, color: '#000000', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'atalanta', name: 'Atalanta', country: 'Italy', league: 'Serie A', tier: 3, color: '#1E71B8', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'roma', name: 'Roma', country: 'Italy', league: 'Serie A', tier: 3, color: '#8E1F2F', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'torino', name: 'Torino', country: 'Italy', league: 'Serie A', tier: 4, color: '#881D23', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'fiorentina', name: 'Fiorentina', country: 'Italy', league: 'Serie A', tier: 4, color: '#492E7C', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'salernitana', name: 'Salernitana', country: 'Italy', league: 'Serie B', tier: 5, color: '#7B1E3A', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  // Germany - Bundesliga
  { id: 'bayern', name: 'Bayern Munich', country: 'Germany', league: 'Bundesliga', tier: 1, color: '#DC052D', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'leverkusen', name: 'Bayer Leverkusen', country: 'Germany', league: 'Bundesliga', tier: 1, color: '#E32219', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'leipzig', name: 'RB Leipzig', country: 'Germany', league: 'Bundesliga', tier: 2, color: '#DD0741', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'dortmund', name: 'Borussia Dortmund', country: 'Germany', league: 'Bundesliga', tier: 2, color: '#FDE100', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'frankfurt', name: 'Eintracht Frankfurt', country: 'Germany', league: 'Bundesliga', tier: 3, color: '#E1000F', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'stuttgart', name: 'VfB Stuttgart', country: 'Germany', league: 'Bundesliga', tier: 3, color: '#E32219', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'mainz', name: 'Mainz 05', country: 'Germany', league: 'Bundesliga', tier: 4, color: '#C3141E', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'freiburg', name: 'SC Freiburg', country: 'Germany', league: 'Bundesliga', tier: 4, color: '#000000', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'darmstadt', name: 'Darmstadt 98', country: 'Germany', league: '2. Bundesliga', tier: 5, color: '#004B9E', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  // France - Ligue 1
  { id: 'psg', name: 'Paris Saint-Germain', country: 'France', league: 'Ligue 1', tier: 1, color: '#004170', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'monaco', name: 'Monaco', country: 'France', league: 'Ligue 1', tier: 1, color: '#E51A22', reserveGoalRatio: 0.65, firstTeamGoalRatio: 0.5 },
  { id: 'lille', name: 'Lille', country: 'France', league: 'Ligue 1', tier: 2, color: '#E01D2B', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'marseille', name: 'Marseille', country: 'France', league: 'Ligue 1', tier: 2, color: '#2FA0DA', reserveGoalRatio: 0.55, firstTeamGoalRatio: 0.42 },
  { id: 'lyon', name: 'Lyon', country: 'France', league: 'Ligue 1', tier: 3, color: '#DA0025', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'rennes', name: 'Rennes', country: 'France', league: 'Ligue 1', tier: 3, color: '#E2001A', reserveGoalRatio: 0.45, firstTeamGoalRatio: 0.35 },
  { id: 'nice', name: 'Nice', country: 'France', league: 'Ligue 1', tier: 4, color: '#941C1F', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'lens', name: 'Lens', country: 'France', league: 'Ligue 1', tier: 4, color: '#FFD200', reserveGoalRatio: 0.35, firstTeamGoalRatio: 0.28 },
  { id: 'le-havre', name: 'Le Havre', country: 'France', league: 'Ligue 2', tier: 5, color: '#0072CE', reserveGoalRatio: 0.25, firstTeamGoalRatio: 0.22 },

  // Saudi Arabia - Saudi Pro League
  { id: 'al-hilal', name: 'Al Hilal', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 1, color: '#1B3D8F', reserveGoalRatio: 0.6, firstTeamGoalRatio: 0.46 },
  { id: 'al-nassr', name: 'Al Nassr', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 1, color: '#FED034', reserveGoalRatio: 0.6, firstTeamGoalRatio: 0.46 },
  { id: 'al-ahli', name: 'Al Ahli', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 2, color: '#006233', reserveGoalRatio: 0.5, firstTeamGoalRatio: 0.4 },
  { id: 'al-ittihad', name: 'Al Ittihad', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 2, color: '#000000', reserveGoalRatio: 0.5, firstTeamGoalRatio: 0.4 },
  { id: 'al-taawoun', name: 'Al Taawoun', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 3, color: '#5A2D81', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'al-fateh', name: 'Al Fateh', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 3, color: '#00843D', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'al-fayha', name: 'Al Fayha', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 4, color: '#8DC63F', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'al-tai', name: 'Al Tai', country: 'Saudi Arabia', league: 'Saudi Pro League', tier: 4, color: '#6E6F72', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },

  // United States / Canada - MLS
  { id: 'lafc', name: 'LAFC', country: 'United States', league: 'MLS', tier: 1, color: '#000000', reserveGoalRatio: 0.6, firstTeamGoalRatio: 0.46 },
  { id: 'inter-miami', name: 'Inter Miami', country: 'United States', league: 'MLS', tier: 1, color: '#F7B5CD', reserveGoalRatio: 0.6, firstTeamGoalRatio: 0.46 },
  { id: 'seattle', name: 'Seattle Sounders', country: 'United States', league: 'MLS', tier: 2, color: '#5D9741', reserveGoalRatio: 0.5, firstTeamGoalRatio: 0.4 },
  { id: 'columbus', name: 'Columbus Crew', country: 'United States', league: 'MLS', tier: 2, color: '#FFF200', reserveGoalRatio: 0.5, firstTeamGoalRatio: 0.4 },
  { id: 'philadelphia', name: 'Philadelphia Union', country: 'United States', league: 'MLS', tier: 3, color: '#00A94F', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'cincinnati', name: 'FC Cincinnati', country: 'United States', league: 'MLS', tier: 3, color: '#FE5000', reserveGoalRatio: 0.4, firstTeamGoalRatio: 0.32 },
  { id: 'kansas-city', name: 'Sporting Kansas City', country: 'United States', league: 'MLS', tier: 4, color: '#93B1E4', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
  { id: 'nashville', name: 'Nashville SC', country: 'United States', league: 'MLS', tier: 4, color: '#ECE83A', reserveGoalRatio: 0.32, firstTeamGoalRatio: 0.26 },
];

export function getClub(id: string): Club | undefined {
  return CLUBS.find((c) => c.id === id);
}

export function clubsByTier(tier: ClubTier): Club[] {
  return CLUBS.filter((c) => c.tier === tier);
}

/** Clubs strictly weaker than the given club - candidates for a loan spell. */
export function loanCandidates(club: Club): Club[] {
  const targetTier = Math.min(5, club.tier + 1) as ClubTier;
  return CLUBS.filter((c) => c.tier === targetTier && c.id !== club.id);
}
