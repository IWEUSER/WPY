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

/** One-deck bowl for the opening Under-16 continental tournament. */
export const YOUTH_TOURNAMENT_CAPACITY = 12_000;
export const YOUTH_TOURNAMENT_GROUND: ClubGround = {
  name: 'Youth Stadium',
  capacity: YOUTH_TOURNAMENT_CAPACITY,
  tiers: 1,
};

export function groundForYouthTournament(): ClubGround {
  return YOUTH_TOURNAMENT_GROUND;
}

/** One-deck academy bowl for the three-game club trial. */
export const CLUB_TRIAL_CAPACITY = 12_000;
export const CLUB_TRIAL_GROUND: ClubGround = {
  name: 'Academy Ground',
  capacity: CLUB_TRIAL_CAPACITY,
  tiers: 1,
};

export function groundForClubTrial(): ClubGround {
  return CLUB_TRIAL_GROUND;
}

/** Shared bowls used by more than one club. */
const SAN_SIRO: ClubGround = { name: 'Milan Stadium', capacity: 75_710, tiers: 5 };
const OLIMPICO: ClubGround = { name: 'Rome Stadium', capacity: 70_634, tiers: 1 };

export const CLUB_GROUNDS: Record<string, ClubGround> = {
  barcelona: { name: 'Catalan Stadium', capacity: CAMP_NOU_CAPACITY, tiers: 5, unique: 'camp-nou' },
  'real-madrid': { name: 'Madrid Stadium', capacity: BERNABEU_CAPACITY, tiers: 5 },
  dortmund: { name: 'Dortmund Stadium', capacity: 81_365, tiers: 1 },
  'ac-milan': SAN_SIRO,
  inter: SAN_SIRO,
  bayern: { name: 'Munich Stadium', capacity: 75_000, tiers: 3 },
  'man-united': { name: 'Manchester North Stadium', capacity: 74_158, tiers: 3 },
  'atletico-madrid': { name: 'Madrid Athletic Stadium', capacity: 70_692, tiers: 3 },
  lazio: OLIMPICO,
  roma: OLIMPICO,
  'real-betis': { name: 'Seville Green Stadium', capacity: 70_000, tiers: 2 },
  marseille: { name: 'Marseille Stadium', capacity: 67_394, tiers: 1 },
  tottenham: { name: 'North London Stadium', capacity: 62_850, tiers: 1 },
  schalke: { name: 'Gelsenkirchen Stadium', capacity: 62_271, tiers: 2 },
  liverpool: { name: 'Merseyside Stadium', capacity: 61_276, tiers: 1 },
  'man-city': { name: 'Manchester Civic Stadium', capacity: 61_038, tiers: 3 },
  arsenal: { name: 'Northbank Stadium', capacity: 60_704, tiers: 3 },
  stuttgart: { name: 'Stuttgart Stadium', capacity: 60_058, tiers: 3 },
  frankfurt: { name: 'Frankfurt Stadium', capacity: 59_500, tiers: 3 },
  lyon: { name: 'Lyon Stadium', capacity: 59_186, tiers: 3 },
  hamburg: { name: 'Hamburg Stadium', capacity: 57_000, tiers: 2 },
  napoli: { name: 'Naples Stadium', capacity: 54_732, tiers: 3 },
  gladbach: { name: 'Monchengladbach Stadium', capacity: 54_057, tiers: 2 },
  everton: { name: 'Merseyside Blue Stadium', capacity: 52_769, tiers: 3 },
  newcastle: { name: 'Tyneside Stadium', capacity: 52_729, tiers: 3 },
  lille: { name: 'Lille Stadium', capacity: 50_186, tiers: 3 },
  koln: { name: 'Cologne Stadium', capacity: 49_698, tiers: 2 },
  sunderland: { name: 'Sunderland Stadium', capacity: 48_095, tiers: 3 },
  psg: { name: 'Paris Stadium', capacity: 47_926, tiers: 2 },
  leipzig: { name: 'Leipzig Stadium', capacity: 47_800, tiers: 2 },
  sevilla: { name: 'Seville Stadium', capacity: 43_883, tiers: 3 },
  fiorentina: { name: 'Florence Stadium', capacity: 43_118, tiers: 2 },
  werder: { name: 'Bremen Stadium', capacity: 42_100, tiers: 2 },
  juventus: { name: 'Turin Stadium', capacity: 41_507, tiers: 2 },
  chelsea: { name: 'West London Stadium', capacity: 40_044, tiers: 3 },
  'real-sociedad': { name: 'San Sebastian Stadium', capacity: LISTED_MIN_CAPACITY, tiers: 3 },
  benfica: { name: 'Lisbon Stadium', capacity: 64_642, tiers: 3 },
  ajax: { name: 'Amsterdam Stadium', capacity: 55_500, tiers: 2 },
  galatasaray: { name: 'Istanbul Gold Stadium', capacity: 52_223, tiers: 2 },
  feyenoord: { name: 'Rotterdam Stadium', capacity: 51_117, tiers: 2 },
  sporting: { name: 'Lisbon Green Stadium', capacity: 50_095, tiers: 2 },
  porto: { name: 'Porto Stadium', capacity: 50_033, tiers: 2 },
  fenerbahce: { name: 'Istanbul Yellow Stadium', capacity: 47_430, tiers: 2 },
  besiktas: { name: 'Istanbul Black Stadium', capacity: 42_590, tiers: 2 },
  konyaspor: { name: 'Konya Stadium', capacity: 42_000, tiers: 2 },
  trabzonspor: { name: 'Trabzon Stadium', capacity: 40_782, tiers: 2 },
  'club-brugge': { name: 'Bruges Stadium', capacity: 29_062, tiers: 2 },
  shakhtar: { name: 'Lviv Stadium', capacity: 34_915, tiers: 2 },
  'slavia-prague': { name: 'Prague Stadium', capacity: 19_370, tiers: 2 },
  'aek-athens': { name: 'Athens Stadium', capacity: 32_500, tiers: 2 },
  'slovan-bratislava': { name: 'Bratislava Stadium', capacity: 22_500, tiers: 2 },
  'bodo-glimt': { name: 'Bodo Stadium', capacity: 8_270, tiers: 1 },
  viking: { name: 'Stavanger Stadium', capacity: 15_900, tiers: 1 },
  lask: { name: 'Linz Stadium', capacity: 19_080, tiers: 2 },
  sabah: { name: 'Baku Stadium', capacity: 13_000, tiers: 1 },
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
