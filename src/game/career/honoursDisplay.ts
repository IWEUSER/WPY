import { getClub, type Club } from './data/clubs';
import { CONTINENTAL_CUPS, DOMESTIC_CUPS, INTERNATIONAL_TOURNAMENTS } from './data/competitions';
import { leagueDisplayName } from './data/leagueFormat';
import type { SeasonHonours } from './seasonSim';
import type { InternationalSeasonRecord, SeasonRecord, TournamentSeasonOutcome } from './types';

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
  const intl = season.international;
  if (intl?.playerOfTheTournament && intl.tournament) {
    const name = INTERNATIONAL_TOURNAMENTS[intl.tournament]?.name ?? intl.tournament;
    labels.push(`${name} Player of the Tournament`);
  }
  if (intl?.topGoalscorer && intl.tournament) {
    const name = INTERNATIONAL_TOURNAMENTS[intl.tournament]?.name ?? intl.tournament;
    labels.push(`${name} top goalscorer`);
  }
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
    names.push(...awardLabels(season));
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

export function tournamentOutcomeLabel(outcome: TournamentSeasonOutcome): string | null {
  switch (outcome) {
    case 'champion':
      return 'Champions';
    case 'final':
      return 'Runners-up';
    case 'semi-final':
      return 'Reached the semi-finals';
    case 'quarter-final':
      return 'Reached the quarter-finals';
    case 'round-of-16':
      return 'Reached the round of 16';
    case 'round-of-32':
      return 'Reached the round of 32';
    case 'group':
      return 'Group stage';
    case 'ongoing':
      return 'Tournament in progress';
    case 'did-not-qualify':
      return 'Did not qualify';
    default:
      return null;
  }
}

export function qualifyingOutcomeLabel(
  outcome: InternationalSeasonRecord['qualifyingOutcome'],
): string | null {
  if (outcome === 'qualified') return 'qualified';
  if (outcome === 'failed') return 'did not qualify';
  return null;
}

export function formatInternationalSeason(rec: InternationalSeasonRecord | undefined | null): {
  name: string;
  qualifying: string | null;
  tournament: string | null;
  awards: string[];
} | null {
  if (!rec || !rec.tournament) return null;
  if (
    rec.qualifyingGames <= 0 &&
    rec.finalsGames <= 0 &&
    rec.qualifyingOutcome === 'none' &&
    rec.tournamentOutcome === 'none'
  ) {
    return null;
  }
  const name = INTERNATIONAL_TOURNAMENTS[rec.tournament]?.name ?? rec.tournament;
  const qLabel = qualifyingOutcomeLabel(rec.qualifyingOutcome);
  const qualifying =
    rec.qualifyingGames > 0 || rec.qualifyingOutcome !== 'none'
      ? `Qualifying ${formatGamesGoals(rec.qualifyingGames, rec.qualifyingGoals)}${qLabel ? ` · ${qLabel}` : ''}`
      : null;
  const tLabel = tournamentOutcomeLabel(rec.tournamentOutcome);
  const tournament =
    rec.finalsGames > 0 || (rec.tournamentOutcome !== 'none' && rec.tournamentOutcome !== 'did-not-qualify')
      ? `${tLabel ?? 'Tournament'}${rec.finalsGames > 0 ? ` · ${formatGamesGoals(rec.finalsGames, rec.finalsGoals)}` : ''}`
      : rec.tournamentOutcome === 'did-not-qualify' && rec.qualifyingOutcome !== 'failed'
        ? 'Did not qualify'
        : null;
  const awards: string[] = [];
  if (rec.playerOfTheTournament) awards.push('Player of the Tournament');
  if (rec.topGoalscorer) awards.push('Top goalscorer');
  return { name, qualifying, tournament, awards };
}
