import { getClub, type Club } from './data/clubs';
import { CONTINENTAL_CUPS, DOMESTIC_CUPS, INTERNATIONAL_TOURNAMENTS } from './data/competitions';
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
  if (honours.leagueChampion) labels.push(league ?? club.league);
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

export function seasonClubName(season: SeasonRecord): string {
  return getClub(season.clubId)?.name ?? season.clubId;
}

export function seasonRatio(season: Pick<SeasonRecord, 'goals' | 'gamesPlayed'>): number {
  return season.gamesPlayed > 0 ? season.goals / season.gamesPlayed : 0;
}
