import type { ClubTier } from './data/clubs';
import { CLUBS, clubsInLeague, getClub } from './data/clubs';
import {
  clubContinentalCup,
  type ContinentalCupId,
} from './data/competitions';

/**
 * Probabilistic club-vs-club engine for seasons 2-20. Stronger squads
 * (`Club.strength`) win more often, never deterministically. Tier is only a
 * fallback when a test passes no explicit strength. Regular league and group
 * fixtures use this independently of the player's chances; the player's
 * goals are then added as one extra input. Missed chances scale P(win)
 * down so finishing is linked to the result without a 1-chance lock.
 */

export interface ClubMatchContext {
  clubTier?: ClubTier;
  opponentTier?: ClubTier;
  clubStrength?: number;
  opponentStrength?: number;
  isHome: boolean;
}

export interface ClubMatchResult {
  scoreFor: number;
  scoreAgainst: number;
  outcome: 'win' | 'draw' | 'loss';
}

/** Typical squad quality when a caller only knows tier. */
export const TIER_STRENGTH: Record<ClubTier, number> = {
  1: 90,
  2: 81,
  3: 73,
  4: 64,
  5: 52,
};

export function resolveStrength(strength: number | undefined, tier: ClubTier | undefined): number {
  if (strength != null) return strength;
  if (tier != null) return TIER_STRENGTH[tier];
  return 70;
}

/**
 * Elo-style win expectancy. Scale 14 is steeper than classic 20 so a 30-point
 * gap (Bayern 94 vs Mainz 61) is close to a lock, while a 6-point gap is still
 * a real contest.
 */
export function expectedScore(us: number, them: number): number {
  return 1 / (1 + 10 ** ((them - us) / 14));
}

/**
 * Multiplier on P(win) from missed finishing chances. Four blanks hurt a
 * lot; a single miss is a nudge. Scoring still adds to the scoreline.
 */
export function missedChanceWinFactor(misses: number): number {
  if (misses <= 0) return 1;
  if (misses === 1) return 0.88;
  if (misses === 2) return 0.72;
  if (misses === 3) return 0.55;
  return 0.35;
}

export function simulateClubMatch(
  context: ClubMatchContext,
  rng: () => number = Math.random,
  playerGoals = 0,
  playerChances?: number,
): ClubMatchResult {
  const us = resolveStrength(context.clubStrength, context.clubTier) + (context.isHome ? 3.5 : 0);
  const them = resolveStrength(context.opponentStrength, context.opponentTier);
  const diff = us - them;
  const expected = expectedScore(us, them);
  const misses =
    playerChances != null && playerChances > 0
      ? Math.max(0, playerChances - Math.max(0, playerGoals))
      : 0;
  const pWin = expected * 0.78 * missedChanceWinFactor(misses);
  const pDraw = 0.24 * Math.exp(-((diff / 22) ** 2));
  const roll = rng();
  let outcome: ClubMatchResult['outcome'];
  if (roll < pWin) outcome = 'win';
  else if (roll < pWin + pDraw) outcome = 'draw';
  else outcome = 'loss';

  const attack = 1.05 + 0.035 * Math.max(-12, Math.min(12, diff / 3));
  const defence = 1.05 - 0.035 * Math.max(-12, Math.min(12, diff / 3));
  let scoreFor = poisson(Math.max(0.35, attack), rng);
  let scoreAgainst = poisson(Math.max(0.35, defence), rng);
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

/** @deprecated Finals use simulateClubMatch. Kept so older calls still compile. */
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
  return CLUBS.filter((c) => clubContinentalCup(c) === cup).map((c) => c.id);
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
    const result = simulateClubMatch(
      { clubStrength: home.strength, opponentStrength: away.strength, clubTier: home.tier, opponentTier: away.tier, isHome: true },
      rng,
    );
    next = applyMatchToTable(next, homeId, awayId, result);
  }
  return next;
}

/**
 * Circle-method pairings for one round of a single round-robin. Odd-sized
 * leagues get a bye so nobody is paired with themselves.
 */
export function roundRobinPairs(clubIds: string[], round: number): [string, string][] {
  const n = clubIds.length;
  if (n < 2) return [];
  const ids = n % 2 === 1 ? [...clubIds, '__bye__'] : [...clubIds];
  const m = ids.length;
  const rotation = [...ids];
  const cycle = m - 1;
  const r = ((round % cycle) + cycle) % cycle;
  for (let i = 0; i < r; i++) {
    const last = rotation.pop();
    if (last) rotation.splice(1, 0, last);
  }
  const pairs: [string, string][] = [];
  for (let i = 0; i < m / 2; i++) {
    const a = rotation[i];
    const b = rotation[m - 1 - i];
    if (a === '__bye__' || b === '__bye__') continue;
    const homeFirst = Math.floor(round / cycle) % 2 === 0;
    pairs.push(homeFirst ? [a, b] : [b, a]);
  }
  return pairs;
}

/** Full NPC league season used to sanity-check title odds. Home and away
 * against every other club — 24 games in a 13-team league. */
export function simulateLeagueSeason(
  league: string,
  _rounds = 24,
  rng: () => number = Math.random,
): LeagueStanding[] {
  const clubs = clubsInLeague(league);
  let table = clubs.map((c) => emptyStanding(c.id));
  for (const home of clubs) {
    for (const away of clubs) {
      if (home.id === away.id) continue;
      const result = simulateClubMatch(
        { clubStrength: home.strength, opponentStrength: away.strength, clubTier: home.tier, opponentTier: away.tier, isHome: true },
        rng,
      );
      table = applyMatchToTable(table, home.id, away.id, result);
    }
  }
  return rankLeagueTable(table);
}
