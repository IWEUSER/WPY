import { getClub, type Club } from './data/clubs';
import { CONTINENTAL_CUPS, DOMESTIC_CUPS, INTERNATIONAL_TOURNAMENTS } from './data/competitions';
import { leagueDisplayName } from './data/leagueFormat';
import type { SeasonHonours } from './seasonSim';
import type { SeasonRecord } from './types';

/** Competition titles won this season, in display order. */
export function trophyLabels(
  honours: SeasonHonours | null | undefined,
  club: Club | undefined,
  league?: string | null,
): string[] {
  if (!honours || !club) return [];
  const labels: string[] = [];
  if (honours.leagueChampion) {
    labels.push(league === 'MLS' || club.league === 'MLS' ? 'MLS Cup' : (league ?? club.league));
  }
  if (honours.domesticCup) labels.push(DOMESTIC_CUPS[honours.domesticCup].name);
  if (honours.superCup) labels.push('Super Cup');
  if (honours.continentalChampion) labels.push(CONTINENTAL_CUPS[honours.continentalChampion].name);
  if (honours.internationalChampion) labels.push(INTERNATIONAL_TOURNAMENTS[honours.internationalChampion].name);
  return labels;
}

export function awardLabels(season: SeasonRecord): string[] {
  const labels: string[] = [];
  if (season.topGoalscorer) labels.push('Top goalscorer');
  if (season.playerOfTheYear) labels.push('Player of the Year');
  return labels;
}

export interface CountedHonour {
  name: string;
  count: number;
}

function countNames(names: string[]): CountedHonour[] {
  const map = new Map<string, number>();
  for (const name of names) map.set(name, (map.get(name) ?? 0) + 1);
  return [...map.entries()].map(([name, count]) => ({ name, count }));
}

export function careerTrophyCounts(seasons: SeasonRecord[]): CountedHonour[] {
  return countNames(seasons.flatMap((season) => season.trophies ?? []));
}

export function careerAwardCounts(seasons: SeasonRecord[]): CountedHonour[] {
  const names: string[] = [];
  for (const season of seasons) {
    if (season.topGoalscorer) names.push('Top goalscorer');
    if (season.playerOfTheYear) names.push('Player of the Year');
    if (season.wonWpy) names.push('World Player of the Year');
  }
  return countNames(names);
}

export function formatCountedHonour(item: CountedHonour): string {
  return `${item.name} ×${item.count}`;
}

export function formatGamesGoals(games: number, goals: number): string {
  return `${games} game${games === 1 ? '' : 's'} · ${goals} goal${goals === 1 ? '' : 's'}`;
}

export function seasonClubName(season: SeasonRecord): string {
  return getClub(season.clubId)?.name ?? season.clubId;
}

export function seasonLeagueLabel(season: SeasonRecord): string {
  return leagueDisplayName(season.league ?? getClub(season.clubId)?.league);
}

export function seasonRatio(season: Pick<SeasonRecord, 'goals' | 'gamesPlayed'>): number {
  return season.gamesPlayed > 0 ? season.goals / season.gamesPlayed : 0;
}
