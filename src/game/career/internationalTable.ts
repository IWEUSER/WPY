import { fifaRank, nationStrength } from './data/fifaRankings';
import { NATIONS_LEAGUE_GROUPS, NATIONS_LEAGUE_QF_GROUPS, nationLabel } from './data/nationsLeague';
import { mulberry32 } from './util';

export interface IntlTableRow {
  nationId: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface IntlGroupState {
  letter: string;
  teamIds: string[];
  rows: IntlTableRow[];
}

function emptyRow(nationId: string): IntlTableRow {
  return {
    nationId,
    name: nationLabel(nationId),
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  };
}

export function createGroupState(letter: string, teamIds: string[]): IntlGroupState {
  return {
    letter,
    teamIds: [...teamIds],
    rows: teamIds.map(emptyRow),
  };
}

function applyResult(rows: IntlTableRow[], homeId: string, awayId: string, hg: number, ag: number): IntlTableRow[] {
  return rows.map((row) => {
    if (row.nationId !== homeId && row.nationId !== awayId) return row;
    const forUs = row.nationId === homeId ? hg : ag;
    const against = row.nationId === homeId ? ag : hg;
    const won = forUs > against;
    const drawn = forUs === against;
    return {
      ...row,
      played: row.played + 1,
      won: row.won + (won ? 1 : 0),
      drawn: row.drawn + (drawn ? 1 : 0),
      lost: row.lost + (!won && !drawn ? 1 : 0),
      goalsFor: row.goalsFor + forUs,
      goalsAgainst: row.goalsAgainst + against,
      points: row.points + (won ? 3 : drawn ? 1 : 0),
    };
  });
}

export function sortGroupTable(rows: IntlTableRow[]): IntlTableRow[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return fifaRank(a.nationId) - fifaRank(b.nationId);
  });
}

function simulateScore(homeId: string, awayId: string, rng: () => number): [number, number] {
  const us = nationStrength(homeId);
  const them = nationStrength(awayId);
  const pHome = 1 / (1 + 10 ** ((them - us) / 18));
  const roll = rng();
  if (roll < pHome * 0.55) return [1 + (rng() < 0.35 ? 1 : 0), rng() < 0.25 ? 1 : 0];
  if (roll < pHome * 0.55 + 0.22) return [rng() < 0.4 ? 1 : 0, rng() < 0.4 ? 1 : 0];
  return [rng() < 0.25 ? 1 : 0, 1 + (rng() < 0.35 ? 1 : 0)];
}

/** Fill every pairing except those involving `playerId` (those are live fixtures). */
export function simulateRestOfGroup(state: IntlGroupState, playerId: string, seed: string): IntlGroupState {
  const rng = mulberry32(hashSeed(seed));
  let rows = state.rows.map((r) => ({ ...r }));
  const ids = state.teamIds;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i];
      const b = ids[j];
      if (a === playerId || b === playerId) continue;
      const [hg, ag] = simulateScore(a, b, rng);
      rows = applyResult(rows, a, b, hg, ag);
    }
  }
  return { ...state, rows: sortGroupTable(rows) };
}

export function applyPlayerGroupResult(
  state: IntlGroupState,
  playerId: string,
  opponentId: string,
  scoreFor: number,
  scoreAgainst: number,
  isHome: boolean,
): IntlGroupState {
  const home = isHome ? playerId : opponentId;
  const away = isHome ? opponentId : playerId;
  const hg = isHome ? scoreFor : scoreAgainst;
  const ag = isHome ? scoreAgainst : scoreFor;
  return { ...state, rows: sortGroupTable(applyResult(state.rows, home, away, hg, ag)) };
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function groupPosition(state: IntlGroupState | null | undefined, nationId: string): number {
  if (!state) return 0;
  const sorted = sortGroupTable(state.rows);
  return sorted.findIndex((r) => r.nationId === nationId) + 1;
}

/**
 * Quarter-final pairing: A1–B2, B1–A2, C1–D2, D1–C2 so no group rematch.
 */
export function nationsLeagueQuarterFinalOpponent(
  playerId: string,
  playerGroup: IntlGroupState,
  seasonSeed: string,
): string | null {
  const letter = playerGroup.letter;
  if (!(NATIONS_LEAGUE_QF_GROUPS as readonly string[]).includes(letter)) return null;
  const pos = groupPosition(playerGroup, playerId);
  if (pos !== 1 && pos !== 2) return null;
  const pair: Record<string, string> = { A: 'B', B: 'A', C: 'D', D: 'C' };
  const otherLetter = pair[letter];
  if (!otherLetter) return null;
  const otherTeams = [...NATIONS_LEAGUE_GROUPS[otherLetter]];
  const other = simulateRestOfGroup(createGroupState(otherLetter, otherTeams), '', `${seasonSeed}-nl-${otherLetter}`);
  const ranked = sortGroupTable(other.rows);
  const want = pos === 1 ? 2 : 1;
  return ranked[want - 1]?.nationId ?? ranked[0]?.nationId ?? null;
}

/** FIFA top 5 can win a major without extra player goals. Top 20 need 3 knockout scores. */
export function nationCanWinMajor(nationId: string, knockoutGamesScored: number): boolean {
  const rank = fifaRank(nationId);
  if (rank <= 5) return true;
  if (rank <= 20 && knockoutGamesScored >= 3) return true;
  return false;
}

/** Progress a knockout without a player goal only for the very top sides in early rounds. */
export function nationCanProgressKnockout(
  nationId: string,
  playerScored: boolean,
  round: string,
): boolean {
  if (playerScored) return true;
  const rank = fifaRank(nationId);
  if (rank <= 5 && (round === 'round-of-32' || round === 'round-of-16')) return true;
  return false;
}
