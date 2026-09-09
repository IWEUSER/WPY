import type { CalendarFixture, SeasonCalendar } from './calendar';
import type { Confederation } from './data/competitions';
import { getNation } from './data/nations';
import { fifaRank, knockoutRankCap, nationStrength, nationsInConfederation, pickMixedRankOpponents } from './data/fifaRankings';
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

function youthNationPool(nationId: string, cap?: number) {
  const nation = getNation(nationId);
  const confederation = nation?.confederation ?? 'UEFA';
  const all = nationsInConfederation(confederation).filter((n) => n.id !== nationId);
  const capped = cap != null ? all.filter((n) => fifaRank(n.id) <= cap) : all;
  return capped.length >= 4 ? capped : all;
}

export function pickYouthGroupOpponents(nationId: string, rng: () => number = Math.random): string[] {
  const pool = youthNationPool(nationId, 32);
  return pickMixedRankOpponents(nationId, 3, pool, { rng }).map((n) => n.id);
}

export function pickYouthKnockoutOpponent(
  nationId: string,
  usedIds: string[],
  rng: () => number = Math.random,
  round: YouthKnockoutRound = 'round-of-16',
): string {
  const cap = knockoutRankCap(round === 'third-place' ? 'semi-final' : round);
  const pool = youthNationPool(nationId, cap);
  const unused = pool.filter((n) => !usedIds.includes(n.id));
  const source = unused.length > 0 ? unused : pool;
  return pickMixedRankOpponents(nationId, 1, source, { rng })[0]?.id ?? 'italy';
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
