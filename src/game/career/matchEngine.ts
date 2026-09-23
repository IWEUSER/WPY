import type { ClubTier } from './data/clubs';
import { CLUBS, clubsInLeague, getClub } from './data/clubs';
import {
  clubContinentalCup,
  type ContinentalCupId,
} from './data/competitions';

/**
 * Probabilistic club-vs-club engine for seasons 2-20. Stronger squads
 * (`Club.strength`) win more often, never deterministically. Tier is only a
 * fallback when a test passes no explicit strength. Teammate and opponent
 * goals are rolled first and capped so remaining player chances still fit a
 * realistic score; the player's goals are then added on top. The board does
 * not re-roll when those goals change, so the overlay matches full time.
 */

export interface ClubMatchContext {
  clubTier?: ClubTier;
  opponentTier?: ClubTier;
  clubStrength?: number;
  opponentStrength?: number;
  isHome: boolean;
  /** One-off knockout (World Cup last 16, cup final). Caps blowout scorelines. */
  knockout?: boolean;
}

export interface ClubMatchResult {
  scoreFor: number;
  scoreAgainst: number;
  outcome: 'win' | 'draw' | 'loss';
  /** Set when a knockout draw was settled from the spot. 90-minute scores stay. */
  penalties?: { won: boolean; for: number; against: number };
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
 * lot; a single miss is a nudge. Kept for sit-out / briefing copy; live
 * boards no longer re-roll the match from this factor.
 */
export function missedChanceWinFactor(misses: number): number {
  if (misses <= 0) return 1;
  if (misses === 1) return 0.88;
  if (misses === 2) return 0.72;
  if (misses === 3) return 0.55;
  return 0.35;
}

/** Traditional scoreboard: home on the left, away on the right. Neutral uses player-left. */
export function formatHomeAwayScore(scoreFor: number, scoreAgainst: number, playerOnLeft: boolean): string {
  return playerOnLeft
    ? `${scoreFor}\u2013${scoreAgainst}`
    : `${scoreAgainst}\u2013${scoreFor}`;
}

/** A 6–0 is only on the table when the sides are a class apart. */
export function blowoutScorePossible(us: number, them: number): boolean {
  return us - them >= 18;
}

export function plausibleGoalCaps(
  us: number,
  them: number,
  knockout = false,
): { maxFor: number; maxAgainst: number } {
  if (knockout) return { maxFor: 3, maxAgainst: 3 };
  const gap = us - them;
  const maxFor = gap >= 18 ? 6 : gap >= 10 ? 5 : gap >= -4 ? 4 : 3;
  const maxAgainst = -gap >= 18 ? 6 : -gap >= 10 ? 5 : -gap >= -4 ? 4 : 3;
  return { maxFor, maxAgainst };
}

export interface NpcMatchScore {
  teammateGoals: number;
  goalsAgainst: number;
  us: number;
  them: number;
  eliteClash: boolean;
  knockout: boolean;
  gap: number;
}

export interface TimedNpcGoal {
  side: 'for' | 'against';
  minute: number;
}

export interface MatchTimeline {
  teammateGoals: number;
  goalsAgainst: number;
  goals: TimedNpcGoal[];
}

/** Teammate and opponent goals before the player's finishes are added. */
export function rollNpcScore(
  context: ClubMatchContext,
  rng: () => number = Math.random,
  playerChances?: number,
): NpcMatchScore {
  const us = resolveStrength(context.clubStrength, context.clubTier) + (context.isHome ? 3.5 : 0);
  const them = resolveStrength(context.opponentStrength, context.opponentTier);
  const diff = us - them;
  const expected = expectedScore(us, them);
  const pWin = expected * 0.92;
  const pDraw = 0.16 * Math.exp(-((diff / 16) ** 2));
  const roll = rng();
  let outcome: ClubMatchResult['outcome'];
  if (roll < pWin) outcome = 'win';
  else if (roll < pWin + pDraw) outcome = 'draw';
  else outcome = 'loss';

  const eliteClash = Math.min(us, them) >= 86 && Math.abs(us - them) <= 10;
  const knockout = Boolean(context.knockout);
  const gap = Math.abs(diff);
  const knockoutScale = knockout ? (gap >= 8 ? 0.7 : 0.82) : 1;
  const attack = ((eliteClash ? 0.78 : 1.05) + 0.035 * Math.max(-12, Math.min(12, diff / 3))) * knockoutScale;
  const defence = ((eliteClash ? 0.78 : 1.05) - 0.035 * Math.max(-12, Math.min(12, diff / 3))) * knockoutScale;
  let scoreFor = poisson(Math.max(0.28, attack), rng);
  let scoreAgainst = poisson(Math.max(0.28, defence), rng);
  if (outcome === 'win' && scoreFor <= scoreAgainst) scoreFor = scoreAgainst + 1 + (rng() < 0.35 ? 1 : 0);
  if (outcome === 'loss' && scoreAgainst <= scoreFor) scoreAgainst = scoreFor + 1 + (rng() < 0.35 ? 1 : 0);
  if (outcome === 'draw') {
    const tied = Math.max(scoreFor, scoreAgainst);
    scoreFor = tied;
    scoreAgainst = tied;
  }

  const reserved = Math.max(0, playerChances ?? 0);
  const caps = plausibleGoalCaps(us, them, knockout);
  const maxTeammate = Math.max(0, caps.maxFor - reserved);
  scoreFor = Math.min(scoreFor, maxTeammate);
  scoreAgainst = Math.min(6, scoreAgainst, caps.maxAgainst);

  const projected = scoreFor + reserved + scoreAgainst;
  if (projected >= 9 && rng() >= 0.012) {
    scoreAgainst = Math.min(scoreAgainst, Math.max(0, 7 - scoreFor - Math.min(reserved, 2)));
  }

  if (eliteClash) {
    scoreFor = Math.min(scoreFor, 4);
    scoreAgainst = Math.min(scoreAgainst, 3);
    if (scoreFor + reserved + scoreAgainst > 6) {
      scoreAgainst = Math.max(0, 6 - scoreFor - reserved);
    }
  }

  return { teammateGoals: scoreFor, goalsAgainst: scoreAgainst, us, them, eliteClash, knockout, gap };
}

function rollGoalMinute(rng: () => number): number {
  const secondHalf = rng() >= 0.42;
  return secondHalf ? 46 + Math.floor(rng() * 45) : 1 + Math.floor(rng() * 45);
}

export function assignNpcGoalMinutes(
  teammateGoals: number,
  goalsAgainst: number,
  rng: () => number,
): TimedNpcGoal[] {
  const goals: TimedNpcGoal[] = [];
  for (let i = 0; i < teammateGoals; i++) goals.push({ side: 'for', minute: rollGoalMinute(rng) });
  for (let i = 0; i < goalsAgainst; i++) goals.push({ side: 'against', minute: rollGoalMinute(rng) });
  return goals.sort((a, b) => a.minute - b.minute || (a.side === 'for' ? -1 : 1));
}

/** Same NPC totals as simulateClubMatch, plus a minute for each non-player goal. */
export function simulateMatchTimeline(
  context: ClubMatchContext,
  rng: () => number = Math.random,
  playerChances?: number,
): MatchTimeline {
  const npc = rollNpcScore(context, rng, playerChances);
  return {
    teammateGoals: npc.teammateGoals,
    goalsAgainst: npc.goalsAgainst,
    goals: assignNpcGoalMinutes(npc.teammateGoals, npc.goalsAgainst, rng),
  };
}

export function liveScoreFromTimeline(
  timeline: MatchTimeline,
  minute: number,
  playerGoals: number,
): { scoreFor: number; scoreAgainst: number } {
  let teammate = 0;
  let against = 0;
  for (const goal of timeline.goals) {
    if (goal.minute < minute) {
      if (goal.side === 'for') teammate += 1;
      else against += 1;
    }
  }
  return {
    scoreFor: teammate + Math.max(0, playerGoals),
    scoreAgainst: against,
  };
}

function finishClubMatch(npc: NpcMatchScore, playerGoals: number): ClubMatchResult {
  let scoreFor = npc.teammateGoals + Math.max(0, playerGoals);
  let scoreAgainst = Math.min(6, npc.goalsAgainst);
  if (npc.eliteClash) {
    scoreFor = Math.min(scoreFor, Math.max(playerGoals, 4));
    scoreAgainst = Math.min(scoreAgainst, 3);
    if (scoreFor + scoreAgainst > 6) {
      scoreAgainst = Math.max(0, 6 - scoreFor);
    }
  }
  if (npc.knockout) {
    const capped = capKnockoutScoreline(scoreFor, scoreAgainst, npc.gap, playerGoals);
    scoreFor = capped.scoreFor;
    scoreAgainst = capped.scoreAgainst;
  }
  return applyPlayerGoalsFloor({ scoreFor, scoreAgainst, outcome: outcomeOf(scoreFor, scoreAgainst) }, playerGoals);
}

export function simulateClubMatch(
  context: ClubMatchContext,
  rng: () => number = Math.random,
  playerGoals = 0,
  playerChances?: number,
): ClubMatchResult {
  return finishClubMatch(rollNpcScore(context, rng, playerChances), playerGoals);
}

/** World Cup last-16 blowouts like 5–0 vs a much weaker side are not realistic. */
function capKnockoutScoreline(
  scoreFor: number,
  scoreAgainst: number,
  gap: number,
  playerGoals: number,
): { scoreFor: number; scoreAgainst: number } {
  const maxMargin = gap >= 8 ? 2 : 3;
  let nextFor = Math.min(scoreFor, Math.max(playerGoals, 3));
  let nextAgainst = Math.min(scoreAgainst, 3);
  if (nextFor - nextAgainst > maxMargin) nextFor = nextAgainst + maxMargin;
  if (nextAgainst - nextFor > maxMargin) nextAgainst = nextFor + maxMargin;
  if (playerGoals > 0) nextFor = Math.max(nextFor, playerGoals);
  return { scoreFor: nextFor, scoreAgainst: nextAgainst };
}

/** The printed scoreline can never be below the goals the player actually scored. */
export function applyPlayerGoalsFloor(result: ClubMatchResult, playerGoals: number): ClubMatchResult {
  if (playerGoals <= 0 || result.scoreFor >= playerGoals) {
    if (result.penalties) return result;
    return { ...result, outcome: outcomeOf(result.scoreFor, result.scoreAgainst) };
  }
  const scoreFor = playerGoals;
  const scoreAgainst = result.scoreAgainst;
  if (result.penalties) return { ...result, scoreFor, scoreAgainst };
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

function pairingHash(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
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

/** Simulate the rest of a continental league-phase matchday. */
export function simulateRestOfEuropeanRound(
  table: LeagueStanding[],
  playerClubId: string,
  playerOpponentId: string,
  rng: () => number = Math.random,
  pairingSeed = '',
): LeagueStanding[] {
  return simulateRestOfLeagueRound(table, playerClubId, playerOpponentId, rng, pairingSeed);
}

export function emptyEuropeanTable(clubIds: string[]): LeagueStanding[] {
  return clubIds.map((id) => emptyStanding(id));
}

/** Simulate every *other* league fixture this matchweek so the table moves
 * as a whole, not just the player's own result. Leftover clubs are paired
 * from a week-seeded shuffle so 1st leftover does not always play 2nd. */
export function simulateRestOfLeagueRound(
  table: LeagueStanding[],
  playerClubId: string,
  playerOpponentId: string,
  rng: () => number = Math.random,
  pairingSeed = '',
): LeagueStanding[] {
  const others = table.map((r) => r.clubId).filter((id) => id !== playerClubId && id !== playerOpponentId);
  const ordered = pairingSeed
    ? [...others].sort((a, b) => {
        const ha = pairingHash(`${pairingSeed}|${a}`);
        const hb = pairingHash(`${pairingSeed}|${b}`);
        return ha - hb || a.localeCompare(b);
      })
    : others;
  let next = table;
  for (const [homeId, awayId] of pairClubs(ordered)) {
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
