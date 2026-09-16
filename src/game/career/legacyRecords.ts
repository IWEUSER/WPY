import { getClub } from './data/clubs';
import {
  CONTINENTAL_CUPS,
  DOMESTIC_CUPS,
  INTERNATIONAL_TOURNAMENTS,
  SUPER_CUP,
  domesticCupForCountry,
  type ContinentalCupId,
  type DomesticCupId,
  type InternationalTournamentId,
} from './data/competitions';
import {
  CLUB_OVERALL,
  CONTINENTAL_CAREER,
  CONTINENTAL_SEASON,
  CUP_CAREER,
  CUP_SEASON,
  LEAGUE_CAREER,
  LEAGUE_SEASON,
  LEGACY_TOP_N,
  OVERALL_CLUB_CAREER,
  nationOverallTotals,
  nationTournamentLadders,
} from './data/legacyRecordTotals';
import { leagueDisplayName } from './data/leagueFormat';
import { getNation } from './international';
import { countsTowardCareerRecord } from './seasonDisplay';
import { aggregateContinental } from './seasonStats';
import type { NationalTeamState } from './international';
import type { SeasonRecord } from './types';

export { LEGACY_TOP_N };

export type LegacySpan = 'career' | 'season';
export type LegacyDomain = 'club' | 'nation';
export type LegacyReveal = 'outside' | 'top10';

export interface LegacyBoardDef {
  id: string;
  domain: LegacyDomain;
  span: LegacySpan;
  title: string;
  subtitle: string;
  group: 'club-overall' | 'league' | 'cup' | 'continental' | 'nation';
}

export interface LegacyTableRow {
  rank: number;
  goals: number;
  you: boolean;
}

export interface LegacyBoardView {
  def: LegacyBoardDef;
  historical: number[];
  playerGoals: number;
  rank: number;
  reveal: LegacyReveal;
  rankLabel: string;
  goalsToTop10: number;
  tenthGoals: number;
  table: LegacyTableRow[] | null;
}

export interface LegacyCareerInput {
  seasons: SeasonRecord[];
  nationalTeam: NationalTeamState | null;
  nationality?: string | null;
  playerName?: string | null;
}

export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function seasonLeagueName(season: SeasonRecord): string | null {
  return season.league ?? getClub(season.clubId)?.league ?? null;
}

export function countedSeasons(seasons: SeasonRecord[]): SeasonRecord[] {
  return seasons.filter((season) => countsTowardCareerRecord(season.seasonNumber, season.role));
}

function slugLeague(league: string): string {
  return league.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function appearance(games: number | undefined, goals: number): boolean {
  return (games ?? 0) > 0 || goals > 0;
}

export function rankForGoals(playerGoals: number, historical: number[]): number {
  if (historical.length === 0) return Number.POSITIVE_INFINITY;
  return 1 + historical.filter((goals) => goals > playerGoals).length;
}

export function revealForRank(rank: number, historical: number[]): LegacyReveal {
  if (historical.length === 0) return 'outside';
  const cutoff = Math.min(LEGACY_TOP_N, historical.length);
  if (rank <= cutoff) return 'top10';
  return 'outside';
}

function tenthTotal(historical: number[]): number {
  if (historical.length === 0) return 0;
  return historical[Math.min(LEGACY_TOP_N, historical.length) - 1] ?? historical[historical.length - 1] ?? 0;
}

function combinedTopTable(playerGoals: number, historical: number[]): LegacyTableRow[] {
  const ahead = historical.filter((goals) => goals > playerGoals);
  const tied = historical.filter((goals) => goals === playerGoals);
  const behind = historical.filter((goals) => goals < playerGoals);
  const beforeCount = Math.min(ahead.length + tied.length, Math.max(0, LEGACY_TOP_N - 1));
  const before = [...ahead, ...tied].slice(0, beforeCount);
  const remaining = Math.max(0, LEGACY_TOP_N - (before.length + 1));
  const combined = [...before.map((goals) => ({ goals, you: false })), { goals: playerGoals, you: true }, ...behind.slice(0, remaining).map((goals) => ({ goals, you: false }))];
  return combined.map((row) => ({
    rank: 1 + combined.filter((other) => other.goals > row.goals).length,
    goals: row.goals,
    you: row.you,
  }));
}

function continentalGames(season: SeasonRecord, cup: string): number {
  return season.continentalStats?.find((row) => row.cup === cup)?.games ?? 0;
}

function continentalGoals(season: SeasonRecord, cup: string): number {
  return season.continentalStats?.find((row) => row.cup === cup)?.goals ?? 0;
}

function playedLeague(seasons: SeasonRecord[], league: string): boolean {
  return seasons.some((season) => seasonLeagueName(season) === league && appearance(season.leagueGames, season.leagueGoals ?? 0));
}

function playedCup(seasons: SeasonRecord[], cupId: DomesticCupId): boolean {
  return seasons.some((season) => {
    const club = getClub(season.clubId);
    if (!club || domesticCupForCountry(club.country) !== cupId) return false;
    return appearance(season.cupGames, season.cupGoals ?? 0);
  });
}

function playedContinental(seasons: SeasonRecord[], cup: string): boolean {
  return seasons.some((season) => appearance(continentalGames(season, cup), continentalGoals(season, cup)));
}

function playedClub(seasons: SeasonRecord[], clubId: string): boolean {
  return seasons.some((season) => season.clubId === clubId && (season.gamesPlayed > 0 || season.goals > 0));
}

function playedNation(team: NationalTeamState | null): boolean {
  return Boolean(team && team.caps > 0);
}

function playedNationTournament(team: NationalTeamState | null, tournament: InternationalTournamentId): boolean {
  const row = team?.byCompetition.find((item) => item.tournament === tournament);
  return Boolean(row && (row.finalsGames > 0 || row.finalsGoals > 0));
}

export function playerGoalsForBoard(def: LegacyBoardDef, input: LegacyCareerInput): number {
  const seasons = countedSeasons(input.seasons);
  if (def.id === 'club:overall') {
    return seasons.reduce((sum, season) => sum + season.goals, 0);
  }
  if (def.id.startsWith('club-overall:')) {
    const clubId = def.id.slice('club-overall:'.length);
    const clubSeasons = seasons.filter((season) => season.clubId === clubId);
    if (def.span === 'season') {
      return clubSeasons.reduce((best, season) => Math.max(best, season.goals), 0);
    }
    return clubSeasons.reduce((sum, season) => sum + season.goals, 0);
  }
  if (def.id.startsWith('league:')) {
    const rest = def.id.slice('league:'.length);
    const [span, ...leagueParts] = rest.split(':');
    const league = Object.keys(LEAGUE_CAREER).find((name) => slugLeague(name) === leagueParts.join(':'));
    if (!league) return 0;
    const values = seasons.map((season) => (seasonLeagueName(season) === league ? season.leagueGoals ?? 0 : 0));
    return span === 'season' ? values.reduce((best, goals) => Math.max(best, goals), 0) : values.reduce((sum, goals) => sum + goals, 0);
  }
  if (def.id.startsWith('cup:')) {
    const [, span, cupId] = def.id.split(':') as [string, LegacySpan, DomesticCupId];
    const values = seasons.map((season) => {
      const club = getClub(season.clubId);
      if (!club || domesticCupForCountry(club.country) !== cupId) return 0;
      return season.cupGoals ?? 0;
    });
    return span === 'season' ? values.reduce((best, goals) => Math.max(best, goals), 0) : values.reduce((sum, goals) => sum + goals, 0);
  }
  if (def.id.startsWith('continental:')) {
    const [, span, cup] = def.id.split(':');
    if (span === 'season') {
      return seasons.reduce((best, season) => Math.max(best, continentalGoals(season, cup)), 0);
    }
    if (cup === 'super-cup') {
      return seasons.reduce((sum, season) => sum + continentalGoals(season, 'super-cup'), 0);
    }
    return aggregateContinental(seasons).find((row) => row.cup === cup)?.goals ?? 0;
  }
  if (def.id.startsWith('nation-overall:')) {
    return input.nationalTeam?.goals ?? 0;
  }
  if (def.id.startsWith('nation-tournament:')) {
    const parts = def.id.split(':');
    const span = parts[1] as LegacySpan;
    const tournament = parts[3] as InternationalTournamentId;
    if (span === 'season') {
      return countedSeasons(input.seasons).reduce((best, season) => {
        if (season.international?.tournament !== tournament) return best;
        return Math.max(best, season.international.finalsGoals ?? 0);
      }, 0);
    }
    return input.nationalTeam?.byCompetition.find((row) => row.tournament === tournament)?.finalsGoals ?? 0;
  }
  return 0;
}

function thisSeasonGoalsForBoard(def: LegacyBoardDef, season: SeasonRecord): number {
  if (!countsTowardCareerRecord(season.seasonNumber, season.role)) return 0;
  if (def.id === 'club:overall') return season.goals;
  if (def.id.startsWith('club-overall:')) {
    const clubId = def.id.slice('club-overall:'.length);
    return season.clubId === clubId ? season.goals : 0;
  }
  if (def.id.startsWith('league:')) {
    const rest = def.id.slice('league:'.length);
    const [, ...leagueParts] = rest.split(':');
    const league = Object.keys(LEAGUE_CAREER).find((name) => slugLeague(name) === leagueParts.join(':'));
    return seasonLeagueName(season) === league ? season.leagueGoals ?? 0 : 0;
  }
  if (def.id.startsWith('cup:')) {
    const cupId = def.id.split(':')[2] as DomesticCupId;
    const club = getClub(season.clubId);
    if (!club || domesticCupForCountry(club.country) !== cupId) return 0;
    return season.cupGoals ?? 0;
  }
  if (def.id.startsWith('continental:')) {
    const cup = def.id.split(':')[2];
    return continentalGoals(season, cup);
  }
  if (def.id.startsWith('nation-overall:')) return 0;
  if (def.id.startsWith('nation-tournament:')) {
    const tournament = def.id.split(':')[3] as InternationalTournamentId;
    if (season.international?.tournament !== tournament) return 0;
    return season.international.finalsGoals ?? 0;
  }
  return 0;
}

function historicalFor(def: LegacyBoardDef): number[] {
  if (def.id === 'club:overall') return OVERALL_CLUB_CAREER;
  if (def.id.startsWith('club-overall:')) {
    return CLUB_OVERALL[def.id.slice('club-overall:'.length)] ?? [];
  }
  if (def.id.startsWith('league:')) {
    const rest = def.id.slice('league:'.length);
    const [span, ...leagueParts] = rest.split(':');
    const league = Object.keys(LEAGUE_CAREER).find((name) => slugLeague(name) === leagueParts.join(':'));
    if (!league) return [];
    return (span === 'season' ? LEAGUE_SEASON : LEAGUE_CAREER)[league] ?? [];
  }
  if (def.id.startsWith('cup:')) {
    const [, span, cupId] = def.id.split(':');
    return (span === 'season' ? CUP_SEASON : CUP_CAREER)[cupId] ?? [];
  }
  if (def.id.startsWith('continental:')) {
    const [, span, cup] = def.id.split(':');
    return (span === 'season' ? CONTINENTAL_SEASON : CONTINENTAL_CAREER)[cup] ?? [];
  }
  if (def.id.startsWith('nation-overall:')) {
    return nationOverallTotals(def.id.slice('nation-overall:'.length));
  }
  if (def.id.startsWith('nation-tournament:')) {
    const parts = def.id.split(':');
    const span = parts[1] as LegacySpan;
    const nationId = parts[2];
    const tournament = parts[3];
    const ladders = nationTournamentLadders(nationId, tournament);
    return (span === 'season' ? ladders?.season : ladders?.career) ?? [];
  }
  return [];
}

export function viewForBoard(def: LegacyBoardDef, input: LegacyCareerInput): LegacyBoardView {
  const historical = historicalFor(def);
  const playerGoals = playerGoalsForBoard(def, input);
  const rank = rankForGoals(playerGoals, historical);
  const reveal = revealForRank(rank, historical);
  const tenth = tenthTotal(historical);
  return {
    def,
    historical,
    playerGoals,
    rank,
    reveal,
    rankLabel: reveal === 'outside' ? `Outside top ${Math.min(LEGACY_TOP_N, Math.max(1, historical.length))}` : ordinal(rank),
    goalsToTop10: Math.max(0, tenth - playerGoals),
    tenthGoals: tenth,
    table: reveal === 'top10' ? combinedTopTable(playerGoals, historical) : null,
  };
}

function clubIdsPlayed(seasons: SeasonRecord[]): string[] {
  const ids: string[] = [];
  for (const season of countedSeasons(seasons)) {
    if (!playedClub([season], season.clubId)) continue;
    if (!ids.includes(season.clubId)) ids.push(season.clubId);
  }
  return ids;
}

export function participatedLegacyBoards(input: LegacyCareerInput): LegacyBoardDef[] {
  const seasons = countedSeasons(input.seasons);
  const defs: LegacyBoardDef[] = [];
  const nationId = input.nationalTeam?.nationId ?? input.nationality ?? null;
  const nation = nationId ? getNation(nationId) : undefined;

  if (seasons.some((season) => season.gamesPlayed > 0 || season.goals > 0)) {
    defs.push({
      id: 'club:overall',
      domain: 'club',
      span: 'career',
      title: 'Club goals',
      subtitle: 'All-time career total',
      group: 'club-overall',
    });
  }

  for (const clubId of clubIdsPlayed(seasons)) {
    if (!CLUB_OVERALL[clubId]) continue;
    const club = getClub(clubId);
    defs.push({
      id: `club-overall:${clubId}`,
      domain: 'club',
      span: 'career',
      title: club?.name ?? clubId,
      subtitle: 'All-time club goals',
      group: 'club-overall',
    });
  }

  for (const league of Object.keys(LEAGUE_CAREER)) {
    if (!playedLeague(seasons, league)) continue;
    const title = leagueDisplayName(league);
    defs.push({
      id: `league:career:${slugLeague(league)}`,
      domain: 'club',
      span: 'career',
      title,
      subtitle: 'All-time league goals',
      group: 'league',
    });
    defs.push({
      id: `league:season:${slugLeague(league)}`,
      domain: 'club',
      span: 'season',
      title,
      subtitle: 'Single-season league goals',
      group: 'league',
    });
  }

  for (const cupId of Object.keys(CUP_CAREER) as DomesticCupId[]) {
    if (!playedCup(seasons, cupId)) continue;
    const title = DOMESTIC_CUPS[cupId].name;
    defs.push({
      id: `cup:career:${cupId}`,
      domain: 'club',
      span: 'career',
      title,
      subtitle: 'All-time cup goals',
      group: 'cup',
    });
    defs.push({
      id: `cup:season:${cupId}`,
      domain: 'club',
      span: 'season',
      title,
      subtitle: 'Single-season cup goals',
      group: 'cup',
    });
  }

  const continentalKeys = [...Object.keys(CONTINENTAL_CUPS), SUPER_CUP.id];
  for (const cup of continentalKeys) {
    if (!playedContinental(seasons, cup)) continue;
    const title = cup === 'super-cup' ? SUPER_CUP.name : CONTINENTAL_CUPS[cup as ContinentalCupId].name;
    defs.push({
      id: `continental:career:${cup}`,
      domain: 'club',
      span: 'career',
      title,
      subtitle: 'All-time tournament goals',
      group: 'continental',
    });
    defs.push({
      id: `continental:season:${cup}`,
      domain: 'club',
      span: 'season',
      title,
      subtitle: 'Single-season tournament goals',
      group: 'continental',
    });
  }

  if (nationId && playedNation(input.nationalTeam)) {
    const nationName = nation?.name ?? nationId;
    if (nationOverallTotals(nationId).length > 0) {
      defs.push({
        id: `nation-overall:${nationId}`,
        domain: 'nation',
        span: 'career',
        title: nationName,
        subtitle: 'All-time international goals',
        group: 'nation',
      });
    }
    const tournaments = new Set<InternationalTournamentId>();
    for (const row of input.nationalTeam?.byCompetition ?? []) {
      if (playedNationTournament(input.nationalTeam, row.tournament)) tournaments.add(row.tournament);
    }
    for (const tournament of tournaments) {
      const ladders = nationTournamentLadders(nationId, tournament);
      const title = `${nationName} · ${INTERNATIONAL_TOURNAMENTS[tournament]?.name ?? tournament}`;
      if (ladders?.career?.length) {
        defs.push({
          id: `nation-tournament:career:${nationId}:${tournament}`,
          domain: 'nation',
          span: 'career',
          title,
          subtitle: 'All-time tournament goals',
          group: 'nation',
        });
      }
      if (ladders?.season?.length) {
        defs.push({
          id: `nation-tournament:season:${nationId}:${tournament}`,
          domain: 'nation',
          span: 'season',
          title,
          subtitle: 'Single-tournament goals',
          group: 'nation',
        });
      }
    }
  }

  return defs.filter((def) => historicalFor(def).length > 0);
}

export function careerLegacyBoards(input: LegacyCareerInput): LegacyBoardView[] {
  return participatedLegacyBoards(input).map((def) => viewForBoard(def, input));
}

export function identityLegacyBoards(input: LegacyCareerInput): LegacyBoardView[] {
  return careerLegacyBoards(input).filter((board) => board.reveal === 'top10');
}

export interface SeasonLegacyHighlight {
  title: string;
  subtitle: string;
  rankLabel: string;
  playerGoals: number;
  kind: 'season' | 'all-time';
}

export function inputWithoutSeason(input: LegacyCareerInput, season: SeasonRecord): LegacyCareerInput {
  const seasons = countedSeasons(input.seasons).filter(
    (row) => !(row.seasonNumber === season.seasonNumber && row.clubId === season.clubId && row.role === season.role),
  );
  const intl = season.international;
  const team = input.nationalTeam;
  if (!team || !intl) return { ...input, seasons };
  return {
    ...input,
    seasons,
    nationalTeam: {
      ...team,
      caps: Math.max(0, team.caps - (intl.qualifyingGames ?? 0) - (intl.finalsGames ?? 0)),
      goals: Math.max(0, team.goals - (intl.qualifyingGoals ?? 0) - (intl.finalsGoals ?? 0)),
      byCompetition: team.byCompetition.map((row) => {
        if (row.tournament !== intl.tournament) return row;
        return {
          ...row,
          qualifyingGames: Math.max(0, row.qualifyingGames - (intl.qualifyingGames ?? 0)),
          qualifyingGoals: Math.max(0, row.qualifyingGoals - (intl.qualifyingGoals ?? 0)),
          finalsGames: Math.max(0, row.finalsGames - (intl.finalsGames ?? 0)),
          finalsGoals: Math.max(0, row.finalsGoals - (intl.finalsGoals ?? 0)),
        };
      }),
    },
  };
}

export function seasonLegacyHighlights(
  previous: LegacyCareerInput,
  current: LegacyCareerInput,
  thisSeason: SeasonRecord,
): SeasonLegacyHighlight[] {
  const after = careerLegacyBoards(current);
  const beforeById = new Map(careerLegacyBoards(previous).map((board) => [board.def.id, board]));
  const highlights: SeasonLegacyHighlight[] = [];
  for (const board of after) {
    if (board.reveal !== 'top10') continue;
    if (board.def.span === 'season') {
      const seasonGoals = thisSeasonGoalsForBoard(board.def, thisSeason);
      if (seasonGoals <= 0) continue;
      const seasonRank = rankForGoals(seasonGoals, board.historical);
      if (revealForRank(seasonRank, board.historical) !== 'top10') continue;
      if (seasonGoals !== board.playerGoals) continue;
      highlights.push({
        title: board.def.title,
        subtitle: board.def.subtitle,
        rankLabel: ordinal(seasonRank),
        playerGoals: seasonGoals,
        kind: 'season',
      });
      continue;
    }
    const before = beforeById.get(board.def.id);
    if (before?.reveal === 'top10') continue;
    highlights.push({
      title: board.def.title,
      subtitle: board.def.subtitle,
      rankLabel: board.rankLabel,
      playerGoals: board.playerGoals,
      kind: 'all-time',
    });
  }
  return highlights;
}

export function defaultPlayerName(): string {
  return 'Player';
}
