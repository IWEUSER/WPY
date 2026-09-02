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
  if (fixture.kind === 'league' || fixture.kind === 'playoff') {
    return {
      ...season,
      leagueGames: (season.leagueGames ?? 0) + 1,
      leagueGoals: season.leagueGoals + (fixture.kind === 'playoff' ? goals : 0),
      domesticGames: (season.domesticGames ?? 0) + 1,
      domesticGoals: (season.domesticGoals ?? 0) + goals,
    };
  }
  if (fixture.kind === 'domestic-cup') {
    return {
      ...season,
      cupGames: (season.cupGames ?? 0) + 1,
      cupGoals: (season.cupGoals ?? 0) + goals,
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

export interface GamesGoals {
  games: number;
  goals: number;
}

export interface DomesticSplit {
  league: GamesGoals;
  cup: GamesGoals;
  total: GamesGoals;
}

export function seasonDomesticSplit(season: SeasonRecord): DomesticSplit {
  const leagueGoals = season.leagueGoals ?? 0;
  const cupGoals = season.cupGoals ?? Math.max(0, (season.domesticGoals ?? 0) - leagueGoals);
  const cupGames = season.cupGames ?? 0;
  const leagueGames = season.leagueGames ?? Math.max(0, (season.domesticGames ?? 0) - cupGames);
  const games = leagueGames + cupGames;
  const goals = leagueGoals + cupGoals;
  return {
    league: { games: leagueGames, goals: leagueGoals },
    cup: { games: cupGames, goals: cupGoals },
    total: {
      games: season.domesticGames ?? games,
      goals: season.domesticGoals ?? goals,
    },
  };
}

export function aggregateDomestic(seasons: SeasonRecord[]): GamesGoals {
  return aggregateDomesticSplit(seasons).total;
}

export function aggregateDomesticSplit(seasons: SeasonRecord[]): DomesticSplit {
  const next: DomesticSplit = {
    league: { games: 0, goals: 0 },
    cup: { games: 0, goals: 0 },
    total: { games: 0, goals: 0 },
  };
  for (const season of seasons) {
    const row = seasonDomesticSplit(season);
    next.league.games += row.league.games;
    next.league.goals += row.league.goals;
    next.cup.games += row.cup.games;
    next.cup.goals += row.cup.goals;
    next.total.games += row.total.games;
    next.total.goals += row.total.goals;
  }
  return next;
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
