import type { Club } from './data/clubs';
import { clubContinentalCup, type ContinentalCupId } from './data/competitions';

/**
 * UEFA / AFC spots from a finished league table. Extra coefficient berths
 * are ignored — each league uses a stable, published-style allocation.
 *
 * Premier League: 1–4 CL, 5 EL, 6 ECL
 * La Liga / Serie A: 1–4 CL, 5–6 EL, 7 ECL
 * Bundesliga: 1–4 CL, 5 EL, 6 ECL
 * Ligue 1: 1–3 CL, 4 EL, 5 ECL
 * Saudi Pro League: 1–4 AFC Champions League Elite
 */
const UEFA_PLACES: Record<string, { ucl: number; uel: number; uecl: number }> = {
  'Premier League': { ucl: 4, uel: 1, uecl: 1 },
  'La Liga': { ucl: 4, uel: 2, uecl: 1 },
  'Serie A': { ucl: 4, uel: 2, uecl: 1 },
  Bundesliga: { ucl: 4, uel: 1, uecl: 1 },
  'Ligue 1': { ucl: 3, uel: 1, uecl: 1 },
};

const CUP_RANK: Record<ContinentalCupId, number> = {
  ucl: 4,
  acle: 4,
  uel: 3,
  uecl: 2,
  'leagues-cup': 1,
};

function higherCup(
  a: ContinentalCupId | null | undefined,
  b: ContinentalCupId | null | undefined,
): ContinentalCupId | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return (CUP_RANK[a] ?? 0) >= (CUP_RANK[b] ?? 0) ? a : b;
}

/** UCL winner stays in the UCL; UEL winner is promoted into the UCL; UECL winner into the UEL. */
export function cupFromDefendingTitle(won: ContinentalCupId | null | undefined): ContinentalCupId | null {
  if (won === 'ucl' || won === 'uel') return 'ucl';
  if (won === 'uecl') return 'uel';
  if (won === 'acle') return 'acle';
  return null;
}

export function cupFromLeaguePosition(
  league: string,
  position: number | null | undefined,
): ContinentalCupId | null {
  if (position == null || position <= 0) return null;
  if (league === 'Saudi Pro League') return position <= 4 ? 'acle' : null;
  const places = UEFA_PLACES[league];
  if (!places) return null;
  if (position <= places.ucl) return 'ucl';
  if (position <= places.ucl + places.uel) return 'uel';
  if (position <= places.ucl + places.uel + places.uecl) return 'uecl';
  return null;
}

/**
 * Next season's continental campaign for the player's current club.
 *
 * A real table position beats the club's usual tier. Winning Europe can
 * still upgrade a side that finished outside the league places. When there
 * is no table (reserve year, missing sim) the club's typical status is used.
 */
export function continentalQualificationForNextSeason(params: {
  club: Club;
  league: string;
  position: number | null | undefined;
  defendingContinental?: ContinentalCupId | null;
}): ContinentalCupId | null {
  const fromTitle = cupFromDefendingTitle(params.defendingContinental);
  if (params.position == null || params.position <= 0) {
    return higherCup(clubContinentalCup(params.club), fromTitle);
  }
  return higherCup(cupFromLeaguePosition(params.league, params.position), fromTitle);
}
