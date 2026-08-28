import type { ClubTier } from './data/clubs';
import { CLUBS, getClub } from './data/clubs';
import {
  confederationForCountry,
  continentalCupForClub,
  type ContinentalCupId,
} from './data/competitions';

/**
 * Probabilistic club-vs-club engine for seasons 2-20. Better clubs (lower
 * tier number) win more often, never deterministically. Regular league and
 * group fixtures use this independently of the player's chances; the
 * player's goals are then added as one extra input. Semi-finals and finals
 * bypass this entirely (see chanceEngine.resolveDecisiveMatch).
 */

export interface ClubMatchContext {
  clubTier: ClubTier;
  opponentTier: ClubTier;
  isHome: boolean;
}

export interface ClubMatchResult {
  scoreFor: number;
  scoreAgainst: number;
  outcome: 'win' | 'draw' | 'loss';
}

function rating(tier: ClubTier): number {
  return 5 - (tier - 1); // 5,4,3,2,1 - used only as a gap, not a multiplier
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function simulateClubMatch(
  context: ClubMatchContext,
  rng: () => number = Math.random,
  playerGoals = 0,
): ClubMatchResult {
  const diff = rating(context.clubTier) - rating(context.opponentTier) + (context.isHome ? 0.35 : -0.35);
  const pWin = sigmoid(0.55 * diff) * 0.82;
  const pDraw = 0.27 * Math.exp(-0.18 * diff * diff);
  const roll = rng();
  let outcome: ClubMatchResult['outcome'];
  if (roll < pWin) outcome = 'win';
  else if (roll < pWin + pDraw) outcome = 'draw';
  else outcome = 'loss';

  const base = 1.1 + 0.12 * Math.abs(diff);
  let scoreFor = poisson(base, rng);
  let scoreAgainst = poisson(base * 0.85, rng);
  if (outcome === 'win' && scoreFor <= scoreAgainst) scoreFor = scoreAgainst + 1 + (rng() < 0.35 ? 1 : 0);
  if (outcome === 'loss' && scoreAgainst <= scoreFor) scoreAgainst = scoreFor + 1 + (rng() < 0.35 ? 1 : 0);
  if (outcome === 'draw') {
    const tied = Math.max(scoreFor, scoreAgainst);
    scoreFor = tied;
    scoreAgainst = tied;
  }
  scoreFor = Math.min(6, scoreFor + Math.max(0, playerGoals));
  scoreAgainst = Math.min(6, scoreAgainst);
  if (playerGoals > 0 && scoreFor <= scoreAgainst && outcome !== 'draw') {
    // A player goal can still turn a simulated loss into a draw/win - teammates aren't the whole story.
    scoreFor = scoreAgainst + (rng() < 0.55 ? 1 : 0);
  }
  return { scoreFor, scoreAgainst, outcome: outcomeOf(scoreFor, scoreAgainst) };
}

/** Knuth's Poisson sampler - used for a realistic low-scoring scoreline. */
export function poisson(lambda: number, rng: () => number = Math.random): number {
  const limit = Math.exp(-Math.max(0.05, lambda));
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng();
  } while (p > limit);
  return k - 1;
}

function outcomeOf(scoreFor: number, scoreAgainst: number): ClubMatchResult['outcome'] {
  if (scoreFor > scoreAgainst) return 'win';
  if (scoreFor < scoreAgainst) return 'loss';
  return 'draw';
}

/** Decisive semi/final scoreline: the player's one chance is the whole match. */
export function decisiveScoreline(scored: boolean): ClubMatchResult {
  return scored
    ? { scoreFor: 1, scoreAgainst: 0, outcome: 'win' }
    : { scoreFor: 0, scoreAgainst: 1, outcome: 'loss' };
}

export interface LeagueStanding {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  position: number;
}

export type EuropeanStage =
  | 'group'
  | 'round-of-16'
  | 'quarter-final'
  | 'semi-final'
  | 'final'
  | 'eliminated'
  | 'champion';

export interface EuropeanStanding {
  cup: ContinentalCupId;
  stage: EuropeanStage;
}

export interface SeasonStandings {
  league: LeagueStanding[];
  europeanStanding: EuropeanStanding | null;
}

export function emptyStanding(clubId: string): LeagueStanding {
  return {
    clubId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
    position: 1,
  };
}

export function applyMatchToTable(
  table: LeagueStanding[],
  clubId: string,
  opponentId: string,
  result: ClubMatchResult,
): LeagueStanding[] {
  const next = table.map((row) => ({ ...row }));
  const us = next.find((r) => r.clubId === clubId);
  const them = next.find((r) => r.clubId === opponentId);
  if (!us || !them) return rankLeagueTable(next);

  us.played += 1;
  them.played += 1;
  us.goalsFor += result.scoreFor;
  us.goalsAgainst += result.scoreAgainst;
  them.goalsFor += result.scoreAgainst;
  them.goalsAgainst += result.scoreFor;

  if (result.outcome === 'win') {
    us.won += 1;
    us.points += 3;
    them.lost += 1;
  } else if (result.outcome === 'loss') {
    us.lost += 1;
    them.won += 1;
    them.points += 3;
  } else {
    us.drawn += 1;
    us.points += 1;
    them.drawn += 1;
    them.points += 1;
  }
  return rankLeagueTable(next);
}

export function rankLeagueTable(rows: LeagueStanding[]): LeagueStanding[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.clubId.localeCompare(b.clubId);
  });
  return sorted.map((row, i) => ({ ...row, position: i + 1 }));
}

export function buildSeasonStandings(
  league: LeagueStanding[],
  europeanStanding: EuropeanStanding | null,
): SeasonStandings {
  return { league: rankLeagueTable(league), europeanStanding };
}

export function clubsForContinentalCup(cup: ContinentalCupId): string[] {
  return CLUBS.filter((c) => continentalCupForClub(c.tier, confederationForCountry(c.country)) === cup).map((c) => c.id);
}

/** Pair leftover clubs for a matchweek (first of each pair is treated as home). */
export function pairClubs(clubIds: string[]): [string, string][] {
  const ids = [...clubIds];
  const pairs: [string, string][] = [];
  while (ids.length >= 2) {
    const a = ids.shift();
    const b = ids.shift();
    if (a && b) pairs.push([a, b]);
  }
  return pairs;
}

/** Simulate every *other* league fixture this matchweek so the table moves
 * as a whole, not just the player's own result. */
export function simulateRestOfLeagueRound(
  table: LeagueStanding[],
  playerClubId: string,
  playerOpponentId: string,
  rng: () => number = Math.random,
): LeagueStanding[] {
  const others = table.map((r) => r.clubId).filter((id) => id !== playerClubId && id !== playerOpponentId);
  let next = table;
  for (const [homeId, awayId] of pairClubs(others)) {
    const home = getClub(homeId);
    const away = getClub(awayId);
    if (!home || !away) continue;
    const result = simulateClubMatch({ clubTier: home.tier, opponentTier: away.tier, isHome: true }, rng);
    next = applyMatchToTable(next, homeId, awayId, result);
  }
  return next;
}
