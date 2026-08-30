import type { CalendarFixture } from './calendar';
import type { ContinentalCupId } from './data/competitions';
import { CONTINENTAL_CUPS, SUPER_CUP } from './data/competitions';
import type { ContinentalSeasonStat, SeasonRecord } from './types';

export type ContinentalStatKey = ContinentalCupId | 'super-cup';

export function emptyContinentalStats(): ContinentalSeasonStat[] {
  return [];
}

export function bumpContinentalStats(
  stats: ContinentalSeasonStat[] | undefined,
  cup: ContinentalStatKey,
  goals: number,
): ContinentalSeasonStat[] {
  const next = [...(stats ?? [])];
  const i = next.findIndex((row) => row.cup === cup);
  if (i < 0) {
    next.push({ cup, games: 1, goals });
    return next;
  }
  next[i] = { ...next[i], games: next[i].games + 1, goals: next[i].goals + goals };
  return next;
}

export function recordClubAppearanceStats(
  season: SeasonRecord,
  fixture: CalendarFixture,
  goals: number,
  played: boolean,
): SeasonRecord {
  if (!played) return season;
  if (fixture.kind === 'league' || fixture.kind === 'domestic-cup' || fixture.kind === 'playoff') {
    return {
      ...season,
      domesticGames: (season.domesticGames ?? 0) + 1,
      domesticGoals: (season.domesticGoals ?? 0) + goals,
    };
  }
  if (fixture.kind === 'super-cup' || fixture.kind === 'leagues-cup') {
    const cup = fixture.kind === 'leagues-cup' ? 'leagues-cup' : 'super-cup';
    return { ...season, continentalStats: bumpContinentalStats(season.continentalStats, cup, goals) };
  }
  if (fixture.kind.startsWith('continental') && fixture.continentalCup) {
    return {
      ...season,
      continentalStats: bumpContinentalStats(season.continentalStats, fixture.continentalCup, goals),
    };
  }
  return season;
}

export function continentalLabel(cup: ContinentalStatKey): string {
  if (cup === 'super-cup') return SUPER_CUP.name;
  return CONTINENTAL_CUPS[cup].name;
}

export function aggregateDomestic(seasons: SeasonRecord[]): { games: number; goals: number } {
  let games = 0;
  let goals = 0;
  for (const season of seasons) {
    games += season.domesticGames ?? 0;
    goals += season.domesticGoals ?? 0;
  }
  return { games, goals };
}

export function aggregateContinental(seasons: SeasonRecord[]): ContinentalSeasonStat[] {
  const byCup = new Map<ContinentalStatKey, ContinentalSeasonStat>();
  for (const season of seasons) {
    for (const row of season.continentalStats ?? []) {
      const prev = byCup.get(row.cup) ?? { cup: row.cup, games: 0, goals: 0 };
      byCup.set(row.cup, { cup: row.cup, games: prev.games + row.games, goals: prev.goals + row.goals });
    }
  }
  return [...byCup.values()];
}
