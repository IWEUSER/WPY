import { championsLeagueField } from './continentalDraw';
import { getClub, type Club } from './data/clubs';
import type { LeagueStanding } from './matchEngine';
import { rankLeagueTable } from './matchEngine';
import { mulberry32 } from './util';

export const UCL_BYE_CUTOFF = 8;
export const UCL_PLAY_OFF_CUTOFF = 24;
/** Porto (83) is strong in Portugal but not a Champions League final side. */
export const UCL_FINALIST_MIN_STRENGTH = 86;

export function isUclFinalistClub(club: Club | undefined | null): boolean {
  if (!club) return false;
  return club.tier <= 2 && club.strength >= UCL_FINALIST_MIN_STRENGTH;
}

export function pickUclFinalOpponent(
  playerId: string,
  field: string[],
  seed: string,
  excludeIds: string[] = [],
): string | null {
  const blocked = new Set([playerId, ...excludeIds]);
  const pickEligible = (ids: string[], label: string): string | null => {
    const eligible = ids.filter((id) => !blocked.has(id) && isUclFinalistClub(getClub(id)));
    return eligible.length > 0 ? pickWeightedOpponent(playerId, eligible, `${seed}-${label}`) : null;
  };
  const fromKnockout = pickEligible(field, 'final');
  if (fromKnockout) return fromKnockout;
  const fromLeague = pickEligible(championsLeagueField(playerId), 'final-field');
  if (fromLeague) return fromLeague;
  const giants = [...field, ...championsLeagueField(playerId)]
    .filter((id, i, arr) => arr.indexOf(id) === i && !blocked.has(id))
    .map((id) => getClub(id))
    .filter((club): club is Club => Boolean(club))
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id));
  return giants[0]?.id ?? pickWeightedOpponent(playerId, field, `${seed}-final-any`, excludeIds);
}

export type ChampionsLeagueBand = 'bye' | 'play-off' | 'eliminated';

export function championsLeagueBand(position: number): ChampionsLeagueBand {
  if (position <= 0) return 'eliminated';
  if (position <= UCL_BYE_CUTOFF) return 'bye';
  if (position <= UCL_PLAY_OFF_CUTOFF) return 'play-off';
  return 'eliminated';
}

/** 9v24, 10v23, …, 16v17. */
export function playOffPairPosition(position: number): number {
  return 33 - position;
}

/**
 * Seed 1 plays the winner of 16/17, seed 8 plays the winner of 9/24.
 * Player in a play-off pair (9–24) then meets seed `17 - min(pos, pair)`.
 */
export function roundOf16SeedForPlayOffPosition(position: number): number {
  return 17 - Math.min(position, playOffPairPosition(position));
}

export function tablePosition(table: LeagueStanding[], clubId: string): number {
  const ranked = rankLeagueTable(table);
  return ranked.findIndex((row) => row.clubId === clubId) + 1;
}

export function clubAtPosition(table: LeagueStanding[], position: number): string | null {
  const ranked = rankLeagueTable(table);
  return ranked[position - 1]?.clubId ?? null;
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function twoLeggedWinner(homeId: string, awayId: string, rng: () => number): string {
  const home = getClub(homeId);
  const away = getClub(awayId);
  const hs = home?.strength ?? 70;
  const as = away?.strength ?? 70;
  const pHome = 1 / (1 + 10 ** ((as - hs) / 16));
  let homeGoals = 0;
  let awayGoals = 0;
  for (let leg = 0; leg < 2; leg++) {
    const homeLeg = leg === 0;
    const p = homeLeg ? pHome : 1 - pHome;
    const roll = rng();
    if (roll < p * 0.55) {
      homeGoals += homeLeg ? 1 + (rng() < 0.35 ? 1 : 0) : rng() < 0.25 ? 1 : 0;
      awayGoals += homeLeg ? (rng() < 0.25 ? 1 : 0) : 1 + (rng() < 0.35 ? 1 : 0);
    } else if (roll < p * 0.55 + 0.22) {
      homeGoals += rng() < 0.4 ? 1 : 0;
      awayGoals += rng() < 0.4 ? 1 : 0;
    } else {
      homeGoals += homeLeg ? (rng() < 0.25 ? 1 : 0) : 1 + (rng() < 0.35 ? 1 : 0);
      awayGoals += homeLeg ? 1 + (rng() < 0.35 ? 1 : 0) : rng() < 0.25 ? 1 : 0;
    }
  }
  if (homeGoals !== awayGoals) return homeGoals > awayGoals ? homeId : awayId;
  return rng() < pHome ? homeId : awayId;
}

export function simulatePlayOffWinners(
  table: LeagueStanding[],
  playerId: string,
  seed: string,
): Map<number, string> {
  const rng = mulberry32(hashSeed(seed));
  const winners = new Map<number, string>();
  for (let pos = 9; pos <= 16; pos++) {
    const a = clubAtPosition(table, pos);
    const b = clubAtPosition(table, playOffPairPosition(pos));
    if (!a || !b) continue;
    if (a === playerId || b === playerId) continue;
    winners.set(pos, twoLeggedWinner(a, b, rng));
  }
  return winners;
}

/** Top eight plus the eight play-off winners. Player is included when they belong. */
export function uclRoundOf16Field(
  table: LeagueStanding[],
  playerId: string,
  playerAdvancedFromPlayOff: boolean,
  seed: string,
): string[] {
  const ranked = rankLeagueTable(table);
  const bye = ranked.slice(0, UCL_BYE_CUTOFF).map((row) => row.clubId);
  const winners = simulatePlayOffWinners(table, playerId, seed);
  const playOff: string[] = [];
  for (let pos = 9; pos <= 16; pos++) {
    const a = ranked[pos - 1]?.clubId;
    const b = ranked[playOffPairPosition(pos) - 1]?.clubId;
    if (a === playerId || b === playerId) {
      if (playerAdvancedFromPlayOff) playOff.push(playerId);
      continue;
    }
    const winner = winners.get(pos);
    if (winner) playOff.push(winner);
  }
  return [...bye, ...playOff].filter((id, i, arr) => arr.indexOf(id) === i);
}

export function uclPlayOffOpponentId(table: LeagueStanding[], playerId: string): string | null {
  const pos = tablePosition(table, playerId);
  if (championsLeagueBand(pos) !== 'play-off') return null;
  const other = clubAtPosition(table, playOffPairPosition(pos));
  return other && other !== playerId ? other : null;
}

export function uclRoundOf16OpponentId(
  table: LeagueStanding[],
  playerId: string,
  field: string[],
  seed: string,
): string | null {
  const pos = tablePosition(table, playerId);
  const band = championsLeagueBand(pos);
  const winners = simulatePlayOffWinners(table, playerId, seed);
  if (band === 'bye') {
    const pairLow = 17 - pos;
    const winner = winners.get(pairLow);
    if (winner && winner !== playerId && field.includes(winner)) return winner;
  } else if (band === 'play-off') {
    const seedPos = roundOf16SeedForPlayOffPosition(pos);
    const seeded = clubAtPosition(table, seedPos);
    if (seeded && seeded !== playerId && field.includes(seeded)) return seeded;
  }
  return pickWeightedOpponent(playerId, field, seed);
}

export function pickWeightedOpponent(
  playerId: string,
  field: string[],
  seed: string,
  excludeIds: string[] = [],
): string | null {
  const blocked = new Set([playerId, ...excludeIds]);
  const pool = field.filter((id) => !blocked.has(id));
  if (pool.length === 0) return null;
  const rng = mulberry32(hashSeed(`${seed}-${playerId}-pick`));
  const clubs = pool
    .map((id) => getClub(id))
    .filter((club): club is Club => Boolean(club));
  if (clubs.length === 0) return pool[Math.floor(rng() * pool.length)] ?? null;
  const weights = clubs.map((club) => Math.max(0.05, (club.strength / 80) ** 3));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < clubs.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return clubs[i].id;
  }
  return clubs[clubs.length - 1]?.id ?? null;
}

/** Simulate the other ties in a knockout round; return the survivors plus the player. */
export function simulateKnockoutSurvivors(
  field: string[],
  playerId: string,
  opponentId: string | null,
  seed: string,
): string[] {
  const rng = mulberry32(hashSeed(`${seed}-survive`));
  const others = field.filter((id) => id !== playerId && id !== opponentId);
  const survivors = [playerId];
  for (let i = 0; i + 1 < others.length; i += 2) {
    survivors.push(twoLeggedWinner(others[i], others[i + 1], rng));
  }
  if (others.length % 2 === 1) survivors.push(others[others.length - 1]);
  return survivors.filter((id, i, arr) => arr.indexOf(id) === i);
}

export function clubsThatWouldAdvanceFromLeague(
  table: LeagueStanding[],
  minPoints: number,
  minPlaces = 16,
): string[] {
  const ranked = rankLeagueTable(table);
  const byPoints = ranked.filter((row) => row.points >= minPoints).map((row) => row.clubId);
  if (byPoints.length >= minPlaces) return byPoints;
  return ranked.slice(0, minPlaces).map((row) => row.clubId);
}
