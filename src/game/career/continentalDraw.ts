import { CLUBS, getClub, type Club } from './data/clubs';
import {
  clubContinentalCup,
  confederationForCountry,
  continentalCupForClub,
  type ContinentalCupId,
} from './data/competitions';
import { shuffle } from './util';

const UEFA_CUPS: ContinentalCupId[] = ['ucl', 'uel', 'uecl'];

/**
 * Real Champions League league-phase field: 36 clubs, four pots of nine.
 * Strength stands in for the five-year UEFA club coefficient.
 */
export const CHAMPIONS_LEAGUE_FIELD_IDS: readonly string[] = [
  'arsenal',
  'aston-villa',
  'liverpool',
  'man-city',
  'man-united',
  'atletico-madrid',
  'barcelona',
  'real-betis',
  'real-madrid',
  'villarreal',
  'bayern',
  'dortmund',
  'leipzig',
  'stuttgart',
  'como',
  'inter',
  'napoli',
  'roma',
  'lens',
  'lille',
  'psg',
  'feyenoord',
  'psv',
  'porto',
  'sporting',
  'bodo-glimt',
  'viking',
  'fenerbahce',
  'galatasaray',
  'lask',
  'sabah',
  'club-brugge',
  'slavia-prague',
  'aek-athens',
  'slovan-bratislava',
  'shakhtar',
];

export const CHAMPIONS_LEAGUE_FIELD_SIZE = 36;
const UCL_POT_SIZE = 9;
const UCL_PER_POT = 2;
const UCL_MAX_FROM_COUNTRY = 2;
const DEFAULT_UCL_TITLEHOLDER = 'real-madrid';

export function championsLeagueField(playerClubId?: string | null): string[] {
  const field = [...CHAMPIONS_LEAGUE_FIELD_IDS];
  if (!playerClubId || field.includes(playerClubId)) return field;
  const ranked = field
    .map((id) => getClub(id))
    .filter((c): c is Club => Boolean(c))
    .sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id));
  const drop = ranked[0]?.id;
  return [playerClubId, ...field.filter((id) => id !== drop)].slice(0, CHAMPIONS_LEAGUE_FIELD_SIZE);
}

export function championsLeagueClubs(playerClubId?: string | null): Club[] {
  return championsLeagueField(playerClubId)
    .map((id) => getClub(id))
    .filter((c): c is Club => Boolean(c));
}

/** Pot 1 starts with the titleholder, then clubs by strength (coefficient proxy). */
export function seedChampionsLeaguePots(
  clubs: Club[],
  titleholderId?: string | null,
): Club[][] {
  const holder = titleholderId && clubs.some((c) => c.id === titleholderId)
    ? titleholderId
    : clubs.some((c) => c.id === DEFAULT_UCL_TITLEHOLDER)
      ? DEFAULT_UCL_TITLEHOLDER
      : [...clubs].sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))[0]?.id;
  const sorted = [...clubs].sort((a, b) => {
    if (a.id === holder) return -1;
    if (b.id === holder) return 1;
    return b.strength - a.strength || a.id.localeCompare(b.id);
  });
  return [0, 1, 2, 3].map((i) => sorted.slice(i * UCL_POT_SIZE, (i + 1) * UCL_POT_SIZE));
}

function countryCount(clubs: Club[], country: string): number {
  return clubs.filter((c) => c.country === country).length;
}

/**
 * Two opponents from one pot. Same-country sides are banned; at most two
 * opponents from any other association. Constraints relax only if a legal
 * pair cannot be found.
 */
function drawFromPot(pot: Club[], self: Club, picked: Club[], want: number): Club[] {
  const taken = () => [...picked];
  const tryDraw = (relaxCountry: boolean, relaxLimit: boolean): Club[] => {
    const chosen: Club[] = [];
    for (const c of shuffle(pot)) {
      if (chosen.length >= want) break;
      if (c.id === self.id) continue;
      if (picked.some((p) => p.id === c.id) || chosen.some((p) => p.id === c.id)) continue;
      if (!relaxCountry && c.country === self.country) continue;
      if (!relaxLimit && countryCount([...taken(), ...chosen], c.country) >= UCL_MAX_FROM_COUNTRY) continue;
      chosen.push(c);
    }
    return chosen;
  };
  for (let attempt = 0; attempt < 18; attempt++) {
    const strict = tryDraw(false, false);
    if (strict.length >= want) return strict.slice(0, want);
  }
  for (let attempt = 0; attempt < 12; attempt++) {
    const relaxedLimit = tryDraw(false, true);
    if (relaxedLimit.length >= want) return relaxedLimit.slice(0, want);
  }
  return tryDraw(true, true).slice(0, want);
}

function clubsInCup(cup: ContinentalCupId): Club[] {
  return CLUBS.filter((c) => clubContinentalCup(c) === cup);
}

/** One cup below is allowed when the true pool is short. Never two cups below — Wolves (UECL) stay out of the Champions League. */
function padCups(cup: ContinentalCupId): ContinentalCupId[] {
  if (cup === 'ucl') return ['ucl', 'uel'];
  if (cup === 'uel') return ['uel', 'uecl'];
  return [cup];
}

function leaguePhaseFromPots(_club: Club, pool: Club[], count: number): Club[] {
  const ranked = [...pool].sort((a, b) => b.strength - a.strength);
  const potSize = Math.max(1, Math.ceil(ranked.length / 4));
  const pots = [0, 1, 2, 3].map((i) => ranked.slice(i * potSize, (i + 1) * potSize));
  const picked: Club[] = [];
  const seen = new Set<string>();
  for (const pot of pots) {
    for (const c of shuffle(pot)) {
      if (picked.length >= count) break;
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      picked.push(c);
    }
  }
  for (const c of shuffle(pool)) {
    if (picked.length >= count) break;
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    picked.push(c);
  }
  return picked.slice(0, count);
}

/**
 * UEFA league-phase draw: 8 different opponents, two from each ranking pot.
 * Champions League uses the 36-club Swiss field, same-country protection,
 * and a maximum of two opponents from any other association.
 */
export function leaguePhaseOpponents(
  club: Club,
  cup: ContinentalCupId,
  count = 8,
  opts?: { titleholderId?: string | null },
): Club[] {
  if (cup === 'ucl') {
    const field = championsLeagueClubs(club.id);
    const pots = seedChampionsLeaguePots(field, opts?.titleholderId);
    const picked: Club[] = [];
    for (const pot of pots) {
      picked.push(...drawFromPot(pot, club, picked, UCL_PER_POT));
    }
    if (picked.length < count) {
      const extra = field.filter((c) => c.id !== club.id && !picked.some((p) => p.id === c.id));
      picked.push(...shuffle(extra).slice(0, count - picked.length));
    }
    return picked.slice(0, count);
  }

  let pool = clubsInCup(cup).filter((c) => c.id !== club.id);
  if (pool.length < count) {
    const allowed = new Set(padCups(cup));
    const extra = CLUBS.filter((c) => {
      const other = clubContinentalCup(c);
      return (
        c.id !== club.id &&
        !pool.some((p) => p.id === c.id) &&
        other != null &&
        allowed.has(other)
      );
    }).sort((a, b) => b.strength - a.strength);
    pool = [...pool, ...extra];
  }
  return leaguePhaseFromPots(club, pool, count);
}

/** Chance a newly joined UEFA club won last season's CL or EL (without the player). */
export function newClubWonEuropeanSuperCup(club: Club, rng: () => number = Math.random): boolean {
  if (confederationForCountry(club.country) !== 'UEFA') return false;
  const cup = continentalCupForClub(club.tier, 'UEFA');
  if (cup !== 'ucl' && cup !== 'uel') return false;
  const p = club.strength >= 90 ? 0.28 : club.strength >= 84 ? 0.12 : 0.05;
  return rng() < p;
}

export function pickSuperCupOpponent(
  club: Club,
  wonCup: ContinentalCupId,
  rng: () => number = Math.random,
  excludeId?: string | null,
): Club | undefined {
  const other: ContinentalCupId = wonCup === 'ucl' ? 'uel' : 'ucl';
  const pool = clubsInCup(other).filter((c) => c.id !== club.id);
  const ranked = [...pool].sort((a, b) => b.strength - a.strength);
  const top = ranked.slice(0, 5);
  const varied = top.filter((c) => c.id !== excludeId);
  const pickFrom = varied.length > 0 ? varied : top;
  if (pickFrom.length === 0) {
    return ranked[0] ?? getClub(club.id === 'real-madrid' ? 'bayern' : 'real-madrid');
  }
  return pickFrom[Math.floor(rng() * pickFrom.length)];
}

export function planSuperCup(params: {
  nextClub: Club;
  previousClubId: string | null;
  previousCup: ContinentalCupId | null;
  rng?: () => number;
  excludeOpponentId?: string | null;
}): { include: boolean; opponentId?: string } {
  const { nextClub, previousClubId, previousCup, rng = Math.random } = params;
  if (confederationForCountry(nextClub.country) !== 'UEFA') return { include: false };
  const stayedAndWon =
    Boolean(previousCup) &&
    (previousCup === 'ucl' || previousCup === 'uel') &&
    previousClubId === nextClub.id;
  const transferredAndNewClubWon =
    previousClubId !== nextClub.id && newClubWonEuropeanSuperCup(nextClub, rng);
  if (!stayedAndWon && !transferredAndNewClubWon) return { include: false };
  const cup: ContinentalCupId =
    stayedAndWon && previousCup ? previousCup : nextClub.tier === 1 ? 'ucl' : 'uel';
  return { include: true, opponentId: pickSuperCupOpponent(nextClub, cup, rng, params.excludeOpponentId)?.id };
}

export { UEFA_CUPS };
