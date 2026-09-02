import type { CalendarFixture, SeasonCalendar } from './calendar';
import type { Confederation } from './data/competitions';
import { getNation } from './data/nations';
import { fifaRank, nationStrength, nationsInConfederation } from './data/fifaRankings';
import { chancesForLeagueMatch } from './chanceEngine';
import { simulateClubMatch } from './matchEngine';

export const YOUTH_TOURNAMENTS: Record<Confederation, { id: string; name: string }> = {
  UEFA: { id: 'uefa-u16', name: 'UEFA Youth Championship' },
  CONMEBOL: { id: 'conmebol-u16', name: 'South American Youth Championship' },
  CONCACAF: { id: 'concacaf-u16', name: 'CONCACAF Youth Championship' },
  CAF: { id: 'caf-u16', name: 'Africa Youth Cup of Nations' },
  AFC: { id: 'afc-u16', name: 'AFC Youth Asian Cup' },
  OFC: { id: 'ofc-u16', name: 'OFC Youth Championship' },
};

export type YouthKnockoutRound = 'round-of-16' | 'quarter-final' | 'semi-final' | 'final' | 'third-place';

const KNOCKOUT_AFTER_GROUP: YouthKnockoutRound[] = ['round-of-16', 'quarter-final', 'semi-final'];

export interface YouthGroupRow {
  id: string;
  points: number;
  gd: number;
}

export function youthTournamentForNation(nationId: string): { id: string; name: string; confederation: Confederation } {
  const nation = getNation(nationId);
  const confederation = nation?.confederation ?? 'UEFA';
  return { ...YOUTH_TOURNAMENTS[confederation], confederation };
}

function shuffleIds(ids: string[], rng: () => number): string[] {
  const copy = [...ids];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickYouthGroupOpponents(nationId: string, rng: () => number = Math.random): string[] {
  const nation = getNation(nationId);
  const confederation = nation?.confederation ?? 'UEFA';
  const pool = nationsInConfederation(confederation).filter((n) => n.id !== nationId).map((n) => n.id);
  const mixed = shuffleIds(pool, rng);
  const high = mixed.filter((id) => fifaRank(id) <= 40);
  const rest = mixed.filter((id) => fifaRank(id) > 40);
  const picks: string[] = [];
  if (high.length) picks.push(high[0]);
  if (rest.length) picks.push(rest[0]);
  for (const id of mixed) {
    if (picks.length >= 3) break;
    if (!picks.includes(id)) picks.push(id);
  }
  return picks.slice(0, 3);
}

export function pickYouthKnockoutOpponent(
  nationId: string,
  usedIds: string[],
  rng: () => number = Math.random,
): string {
  const nation = getNation(nationId);
  const confederation = nation?.confederation ?? 'UEFA';
  const used = new Set([nationId, ...usedIds]);
  const pool = nationsInConfederation(confederation).filter((n) => !used.has(n.id)).map((n) => n.id);
  const fallback = nationsInConfederation(confederation).filter((n) => n.id !== nationId).map((n) => n.id);
  const source = pool.length > 0 ? pool : fallback;
  return shuffleIds(source, rng)[0] ?? 'italy';
}

function youthFixture(
  week: number,
  opponentId: string,
  round: NonNullable<CalendarFixture['internationalRound']>,
  nationId: string,
): CalendarFixture {
  const chances = Math.max(1, chancesForLeagueMatch({ strength: nationStrength(nationId) }).count);
  const nation = getNation(opponentId);
  return {
    week,
    kind: 'international',
    isDecisive: round === 'final' || round === 'third-place',
    internationalRound: round,
    opponentId,
    opponentLabel: nation?.name ?? opponentId,
    playerChances: chances,
  };
}

export function simulateOtherGroupMatches(
  opponentIds: string[],
  rng: () => number = Math.random,
): YouthGroupRow[] {
  const rows = opponentIds.map((id) => ({ id, points: 0, gd: 0 }));
  const bump = (id: string, points: number, gd: number) => {
    const row = rows.find((r) => r.id === id);
    if (row) {
      row.points += points;
      row.gd += gd;
    }
  };
  for (let i = 0; i < opponentIds.length; i++) {
    for (let j = i + 1; j < opponentIds.length; j++) {
      const home = opponentIds[i];
      const away = opponentIds[j];
      const result = simulateClubMatch(
        { clubStrength: nationStrength(home), opponentStrength: nationStrength(away), isHome: true },
        rng,
      );
      const gd = result.scoreFor - result.scoreAgainst;
      if (result.outcome === 'win') {
        bump(home, 3, gd);
        bump(away, 0, -gd);
      } else if (result.outcome === 'loss') {
        bump(home, 0, gd);
        bump(away, 3, -gd);
      } else {
        bump(home, 1, gd);
        bump(away, 1, -gd);
      }
    }
  }
  return rows;
}

export function youthGroupQualifies(player: YouthGroupRow, others: YouthGroupRow[]): boolean {
  const table = [player, ...others].sort((a, b) => b.points - a.points || b.gd - a.gd || a.id.localeCompare(b.id));
  return table.findIndex((row) => row.id === player.id) < 2;
}

export function buildYouthGroupCalendar(nationId: string, opponentIds: string[]): SeasonCalendar {
  return {
    seasonNumber: 0,
    totalWeeks: 3,
    fixtures: opponentIds.map((id, i) => youthFixture(i + 1, id, 'group', nationId)),
  };
}

export function youthKnockoutFixture(
  nationId: string,
  opponentId: string,
  round: YouthKnockoutRound,
  week: number,
): CalendarFixture {
  return youthFixture(week, opponentId, round, nationId);
}

export function nextYouthKnockoutRound(current: YouthKnockoutRound | 'group', won: boolean): YouthKnockoutRound | 'done' {
  if (current === 'group') return 'round-of-16';
  if (current === 'round-of-16') return won ? 'quarter-final' : 'done';
  if (current === 'quarter-final') return won ? 'semi-final' : 'done';
  if (current === 'semi-final') return won ? 'final' : 'third-place';
  return 'done';
}

export function youthMaxGames(): number {
  return 3 + KNOCKOUT_AFTER_GROUP.length + 1;
}
