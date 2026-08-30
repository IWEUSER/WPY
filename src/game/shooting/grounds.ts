/**
 * Home grounds: capacity drives stand height, `tiers` is how many decks
 * are stacked behind the goal. Camp Nou is unique — tallest, five decks.
 * Clubs not on this list get a basic two-deck municipal stand, always
 * shorter than Real Sociedad (the smallest listed ground).
 */

export type StandTiers = 1 | 2 | 3 | 4 | 5;

export interface ClubGround {
  name: string;
  capacity: number;
  tiers: StandTiers;
  /** Camp Nou only — extra height above every other bowl. */
  unique?: 'camp-nou';
}

export const CAMP_NOU_CAPACITY = 105_000;
export const BERNABEU_CAPACITY = 83_186;
/** Smallest capacity on the listed table (Reale Arena). */
export const LISTED_MIN_CAPACITY = 39_313;
export const UNLISTED_CAPACITY = 28_000;
export const UNLISTED_TIERS: StandTiers = 2;

export const UNLISTED_GROUND: ClubGround = {
  name: 'Municipal Stadium',
  capacity: UNLISTED_CAPACITY,
  tiers: UNLISTED_TIERS,
};

/** Neutral venue for domestic and European finals. */
export const CUP_FINAL_CAPACITY = 90_000;
export const CUP_FINAL_GROUND: ClubGround = {
  name: 'National Stadium',
  capacity: CUP_FINAL_CAPACITY,
  tiers: 4,
};

export function groundForCupFinal(): ClubGround {
  return CUP_FINAL_GROUND;
}

/** Neutral bowl for World Cup / continental / Nations League tournament games. */
export const INTERNATIONAL_TOURNAMENT_CAPACITY = 75_000;
export const INTERNATIONAL_TOURNAMENT_GROUND: ClubGround = {
  name: 'Tournament Stadium',
  capacity: INTERNATIONAL_TOURNAMENT_CAPACITY,
  tiers: 3,
};

export function groundForInternationalTournament(): ClubGround {
  return INTERNATIONAL_TOURNAMENT_GROUND;
}

/** Shared bowls used by more than one club. */
const SAN_SIRO: ClubGround = { name: 'San Siro', capacity: 75_710, tiers: 5 };
const OLIMPICO: ClubGround = { name: 'Stadio Olimpico', capacity: 70_634, tiers: 1 };

export const CLUB_GROUNDS: Record<string, ClubGround> = {
  barcelona: { name: 'Camp Nou', capacity: CAMP_NOU_CAPACITY, tiers: 5, unique: 'camp-nou' },
  'real-madrid': { name: 'Santiago Bernabéu', capacity: BERNABEU_CAPACITY, tiers: 5 },
  dortmund: { name: 'Signal Iduna Park', capacity: 81_365, tiers: 1 },
  'ac-milan': SAN_SIRO,
  inter: SAN_SIRO,
  bayern: { name: 'Allianz Arena', capacity: 75_000, tiers: 3 },
  'man-united': { name: 'Old Trafford', capacity: 74_158, tiers: 3 },
  'atletico-madrid': { name: 'Riyadh Air Metropolitano', capacity: 70_692, tiers: 3 },
  lazio: OLIMPICO,
  roma: OLIMPICO,
  'real-betis': { name: 'La Cartuja', capacity: 70_000, tiers: 2 },
  marseille: { name: 'Stade Vélodrome', capacity: 67_394, tiers: 1 },
  tottenham: { name: 'Tottenham Hotspur Stadium', capacity: 62_850, tiers: 1 },
  schalke: { name: 'Veltins-Arena', capacity: 62_271, tiers: 2 },
  liverpool: { name: 'Anfield', capacity: 61_276, tiers: 1 },
  'man-city': { name: 'Etihad Stadium', capacity: 61_038, tiers: 3 },
  arsenal: { name: 'Emirates Stadium', capacity: 60_704, tiers: 3 },
  stuttgart: { name: 'MHPArena', capacity: 60_058, tiers: 3 },
  frankfurt: { name: 'Deutsche Bank Park', capacity: 59_500, tiers: 3 },
  lyon: { name: 'Groupama Stadium', capacity: 59_186, tiers: 3 },
  hamburg: { name: 'Volksparkstadion', capacity: 57_000, tiers: 2 },
  napoli: { name: 'Stadio Diego Armando Maradona', capacity: 54_732, tiers: 3 },
  gladbach: { name: 'Borussia-Park', capacity: 54_057, tiers: 2 },
  everton: { name: 'Hill Dickinson Stadium', capacity: 52_769, tiers: 3 },
  newcastle: { name: "St James' Park", capacity: 52_729, tiers: 3 },
  lille: { name: 'Stade Pierre-Mauroy', capacity: 50_186, tiers: 3 },
  koln: { name: 'RheinEnergieStadion', capacity: 49_698, tiers: 2 },
  sunderland: { name: 'Stadium of Light', capacity: 48_095, tiers: 3 },
  psg: { name: 'Parc des Princes', capacity: 47_926, tiers: 3 },
  leipzig: { name: 'Red Bull Arena', capacity: 47_800, tiers: 2 },
  sevilla: { name: 'Ramón Sánchez-Pizjuán', capacity: 43_883, tiers: 3 },
  fiorentina: { name: 'Stadio Artemio Franchi', capacity: 43_118, tiers: 2 },
  werder: { name: 'Weserstadion', capacity: 42_100, tiers: 2 },
  juventus: { name: 'Allianz Stadium', capacity: 41_507, tiers: 2 },
  chelsea: { name: 'Stamford Bridge', capacity: 40_044, tiers: 3 },
  'real-sociedad': { name: 'Reale Arena', capacity: LISTED_MIN_CAPACITY, tiers: 3 },
};

function hashKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Unlisted clubs: two decks, medium height, always below the listed table.
 * A little per-club jitter so municipal grounds are not identical.
 */
export function unlistedGround(clubId: string): ClubGround {
  const jitter = hashKey(clubId) % 7001;
  return {
    name: UNLISTED_GROUND.name,
    capacity: 24_000 + jitter,
    tiers: UNLISTED_TIERS,
  };
}

export function groundForClub(clubId: string | undefined): ClubGround {
  if (!clubId) return UNLISTED_GROUND;
  return CLUB_GROUNDS[clubId] ?? unlistedGround(clubId);
}

export function isListedGround(clubId: string | undefined): boolean {
  return Boolean(clubId && CLUB_GROUNDS[clubId]);
}

/** International venues: FIFA rank stands in for a national stadium. */
export function groundForNationRank(rank: number | undefined): ClubGround {
  if (rank == null || !Number.isFinite(rank)) return UNLISTED_GROUND;
  if (rank <= 10) return { name: 'National Stadium', capacity: 80_000, tiers: 3 };
  if (rank <= 25) return { name: 'National Stadium', capacity: 62_000, tiers: 3 };
  if (rank <= 50) return { name: 'National Stadium', capacity: 45_000, tiers: 2 };
  return UNLISTED_GROUND;
}
