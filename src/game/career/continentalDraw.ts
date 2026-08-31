import { CLUBS, getClub, type Club } from './data/clubs';
import {
  clubContinentalCup,
  confederationForCountry,
  continentalCupForClub,
  type ContinentalCupId,
} from './data/competitions';
import { shuffle } from './util';

const UEFA_CUPS: ContinentalCupId[] = ['ucl', 'uel', 'uecl'];

function clubsInCup(cup: ContinentalCupId): Club[] {
  return CLUBS.filter((c) => clubContinentalCup(c) === cup);
}

/**
 * Current UEFA league-phase draw: 8 different opponents, two from each
 * ranking pot, never the same club twice. Never pads with a club from
 * another cup — Wolves stay in the Conference League, not the Champions League.
 */
export function leaguePhaseOpponents(club: Club, cup: ContinentalCupId, count = 8): Club[] {
  const pool = clubsInCup(cup)
    .filter((c) => c.id !== club.id)
    .sort((a, b) => b.strength - a.strength);
  const potSize = Math.max(1, Math.ceil(pool.length / 4));
  const pots = [0, 1, 2, 3].map((i) => pool.slice(i * potSize, (i + 1) * potSize));
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

/** Chance a newly joined UEFA club won last season's CL or EL (without the player). */
export function newClubWonEuropeanSuperCup(club: Club, rng: () => number = Math.random): boolean {
  if (confederationForCountry(club.country) !== 'UEFA') return false;
  const cup = continentalCupForClub(club.tier, 'UEFA');
  if (cup !== 'ucl' && cup !== 'uel') return false;
  const p = club.strength >= 90 ? 0.28 : club.strength >= 84 ? 0.12 : 0.05;
  return rng() < p;
}

export function pickSuperCupOpponent(club: Club, wonCup: ContinentalCupId): Club | undefined {
  const other: ContinentalCupId = wonCup === 'ucl' ? 'uel' : 'ucl';
  const pool = clubsInCup(other).filter((c) => c.id !== club.id);
  const ranked = [...pool].sort((a, b) => b.strength - a.strength);
  return ranked[0] ?? getClub(club.id === 'real-madrid' ? 'bayern' : 'real-madrid');
}

export function planSuperCup(params: {
  nextClub: Club;
  previousClubId: string | null;
  previousCup: ContinentalCupId | null;
  rng?: () => number;
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
  return { include: true, opponentId: pickSuperCupOpponent(nextClub, cup)?.id };
}

export { UEFA_CUPS };
