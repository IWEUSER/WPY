import type { CalendarFixture, SeasonCalendar } from './calendar';
import { buildSeasonCalendar } from './calendar';
import {
  chancesForDecisiveMatch,
  chancesForKnockoutTie,
  chancesForLeagueMatch,
} from './chanceEngine';
import { clubsInLeague, getClub, type Club } from './data/clubs';
import {
  confederationForCountry,
  continentalCupForClub,
  internationalTournamentForSeason,
  type ContinentalCupId,
  type InternationalTournamentId,
} from './data/competitions';
import { isSelectedForNationalTeam, NATIONS } from './international';
import {
  applyMatchToTable,
  clubsForContinentalCup,
  decisiveScoreline,
  emptyStanding,
  simulateClubMatch,
  simulateRestOfLeagueRound,
  type ClubMatchResult,
  type EuropeanStanding,
  type LeagueStanding,
} from './matchEngine';
import { shuffle } from './util';
import { SEASON_LENGTH } from './constants';

export type InternationalStage =
  | 'not-selected'
  | 'group'
  | 'semi-final'
  | 'final'
  | 'eliminated'
  | 'champion';

export interface SeasonHonours {
  leagueChampion: boolean;
  continentalChampion: ContinentalCupId | null;
  superCup: boolean;
  internationalChampion: InternationalTournamentId | null;
}

export interface SeasonSimState {
  fixtureIndex: number;
  leagueTable: LeagueStanding[];
  europeanStanding: EuropeanStanding | null;
  europeanGroupPoints: number;
  europeanGroupPlayed: number;
  knockoutAggFor: number;
  knockoutAggAgainst: number;
  internationalStage: InternationalStage;
  internationalSelected: boolean;
  internationalTournament: InternationalTournamentId | null;
  honours: SeasonHonours;
}

export interface LiveMatch {
  fixtureIndex: number;
  chancesTotal: number;
  chancesTaken: number;
  goals: number;
}

export interface HydrateSeasonParams {
  seasonNumber: number;
  club: Club;
  previousSeasonRatio: number;
  nationId: string | null;
}

const GROUP_GAMES = 8;
const GROUP_ADVANCE_POINTS = 10;

export function emptyHonours(): SeasonHonours {
  return {
    leagueChampion: false,
    continentalChampion: null,
    superCup: false,
    internationalChampion: null,
  };
}

export function hydrateSeason(params: HydrateSeasonParams): { calendar: SeasonCalendar; sim: SeasonSimState } {
  const { seasonNumber, club, previousSeasonRatio, nationId } = params;
  const confederation = confederationForCountry(club.country);
  const cup = continentalCupForClub(club.tier, confederation);
  const tournament = internationalTournamentForSeason(seasonNumber);
  const internationalSelected = Boolean(
    nationId && tournament && isSelectedForNationalTeam(club.tier, previousSeasonRatio),
  );

  let calendar = buildSeasonCalendar({
    seasonNumber,
    leagueMatchWeeks: SEASON_LENGTH,
    clubTier: club.tier,
    confederation,
    includeInternational: internationalSelected,
  });
  calendar = assignOpponentsAndChances(calendar, club, cup, nationId);

  const leagueClubs = clubsInLeague(club.league);
  const leagueTable = leagueClubs.map((c) => emptyStanding(c.id));
  const europeanStanding: EuropeanStanding | null = cup ? { cup, stage: 'group' } : null;

  return {
    calendar,
    sim: {
      fixtureIndex: 0,
      leagueTable,
      europeanStanding,
      europeanGroupPoints: 0,
      europeanGroupPlayed: 0,
      knockoutAggFor: 0,
      knockoutAggAgainst: 0,
      internationalStage: internationalSelected ? 'group' : 'not-selected',
      internationalSelected,
      internationalTournament: internationalSelected ? tournament : null,
      honours: emptyHonours(),
    },
  };
}

function assignOpponentsAndChances(
  calendar: SeasonCalendar,
  club: Club,
  cup: ContinentalCupId | null,
  nationId: string | null,
): SeasonCalendar {
  const leagueRivals = shuffle(clubsInLeague(club.league).filter((c) => c.id !== club.id));
  const euroRivals = cup ? shuffle(clubsForContinentalCup(cup).filter((id) => id !== club.id)) : [];
  const nationRivals = shuffle(NATIONS.filter((n) => n.id !== nationId));

  let leagueI = 0;
  let euroI = 0;
  let nationI = 0;

  const fixtures = calendar.fixtures.map((f) => ({ ...f }));

  for (let i = 0; i < fixtures.length; i++) {
    const f = fixtures[i];
    if (f.kind === 'league') {
      const opp = leagueRivals[leagueI % Math.max(1, leagueRivals.length)];
      leagueI += 1;
      if (opp) {
        f.opponentId = opp.id;
        f.opponentLabel = opp.name;
      }
      f.playerChances = chancesForLeagueMatch().count;
    } else if (f.kind === 'continental-group' || f.kind === 'super-cup') {
      const oppId = euroRivals[euroI % Math.max(1, euroRivals.length)];
      euroI += 1;
      const opp = oppId ? getClub(oppId) : undefined;
      if (opp) {
        f.opponentId = opp.id;
        f.opponentLabel = opp.name;
      }
      f.playerChances = chancesForLeagueMatch().count;
    } else if (f.kind === 'continental-knockout' && f.leg === 1) {
      const oppId = euroRivals[euroI % Math.max(1, euroRivals.length)];
      euroI += 1;
      const opp = oppId ? getClub(oppId) : undefined;
      const [leg1, leg2] = chancesForKnockoutTie();
      f.playerChances = leg1.count;
      if (opp) {
        f.opponentId = opp.id;
        f.opponentLabel = opp.name;
      }
      const next = fixtures[i + 1];
      if (next && next.kind === 'continental-knockout' && next.leg === 2) {
        next.playerChances = leg2.count;
        if (opp) {
          next.opponentId = opp.id;
          next.opponentLabel = opp.name;
        }
      }
    } else if (f.kind === 'continental-knockout' && f.leg === 2 && f.playerChances === undefined) {
      f.playerChances = chancesForLeagueMatch().count;
    } else if (f.kind === 'continental-semi-final' || f.kind === 'continental-final') {
      const oppId = euroRivals[euroI % Math.max(1, euroRivals.length)];
      euroI += 1;
      const opp = oppId ? getClub(oppId) : undefined;
      if (opp) {
        f.opponentId = opp.id;
        f.opponentLabel = opp.name;
      }
      f.playerChances = chancesForDecisiveMatch().count;
    } else if (f.kind === 'international') {
      const opp = nationRivals[nationI % Math.max(1, nationRivals.length)];
      nationI += 1;
      if (opp) {
        f.opponentId = opp.id;
        f.opponentLabel = opp.name;
      }
      f.playerChances = f.isDecisive ? chancesForDecisiveMatch().count : chancesForLeagueMatch().count;
    }
  }

  return { ...calendar, fixtures };
}

export function shouldSkipFixture(fixture: CalendarFixture, sim: SeasonSimState): boolean {
  if (fixture.kind === 'super-cup') return false;

  if (fixture.kind.startsWith('continental')) {
    const stage = sim.europeanStanding?.stage;
    if (!stage || stage === 'eliminated') return true;
    if (fixture.kind === 'continental-group') return stage !== 'group';
    if (fixture.kind === 'continental-knockout') {
      return stage !== 'round-of-16' && stage !== 'quarter-final';
    }
    if (fixture.kind === 'continental-semi-final') return stage !== 'semi-final';
    if (fixture.kind === 'continental-final') return stage !== 'final';
  }

  if (fixture.kind === 'international') {
    if (!sim.internationalSelected) return true;
    const stage = sim.internationalStage;
    if (stage === 'eliminated' || stage === 'not-selected' || stage === 'champion') return true;
    if (fixture.internationalRound === 'group') return stage !== 'group';
    if (fixture.internationalRound === 'semi-final') return stage !== 'semi-final';
    if (fixture.internationalRound === 'final') return stage !== 'final';
  }
  return false;
}

/** After a continental match, advance/eliminate the European stage. */
export function applyEuropeanResult(
  sim: SeasonSimState,
  fixture: CalendarFixture,
  result: { outcome: 'win' | 'draw' | 'loss'; scoreFor: number; scoreAgainst: number },
): SeasonSimState {
  if (!sim.europeanStanding || !fixture.continentalCup) return sim;
  const next = { ...sim, europeanStanding: { ...sim.europeanStanding } };

  if (fixture.kind === 'super-cup') {
    if (result.outcome === 'win') next.honours = { ...next.honours, superCup: true };
    return next;
  }

  if (fixture.kind === 'continental-group') {
    next.europeanGroupPlayed += 1;
    if (result.outcome === 'win') next.europeanGroupPoints += 3;
    else if (result.outcome === 'draw') next.europeanGroupPoints += 1;
    if (next.europeanGroupPlayed >= GROUP_GAMES) {
      if (next.europeanGroupPoints >= GROUP_ADVANCE_POINTS) {
        next.europeanStanding.stage = 'round-of-16';
      } else {
        next.europeanStanding.stage = 'eliminated';
      }
    }
    return next;
  }

  if (fixture.kind === 'continental-knockout') {
    next.knockoutAggFor += result.scoreFor;
    next.knockoutAggAgainst += result.scoreAgainst;
    if (fixture.leg === 2) {
      const progressed =
        next.knockoutAggFor > next.knockoutAggAgainst
        || (next.knockoutAggFor === next.knockoutAggAgainst && Math.random() < 0.5);
      next.knockoutAggFor = 0;
      next.knockoutAggAgainst = 0;
      if (!progressed) {
        next.europeanStanding.stage = 'eliminated';
      } else if (next.europeanStanding.stage === 'round-of-16') {
        next.europeanStanding.stage = 'quarter-final';
      } else {
        next.europeanStanding.stage = 'semi-final';
      }
    }
    return next;
  }

  if (fixture.kind === 'continental-semi-final') {
    next.europeanStanding.stage = result.outcome === 'win' ? 'final' : 'eliminated';
    return next;
  }

  if (fixture.kind === 'continental-final') {
    if (result.outcome === 'win') {
      next.europeanStanding.stage = 'champion';
      next.honours = { ...next.honours, continentalChampion: fixture.continentalCup };
    } else {
      next.europeanStanding.stage = 'eliminated';
    }
    return next;
  }

  return next;
}

export function applyInternationalResult(
  sim: SeasonSimState,
  fixture: CalendarFixture,
  scored: boolean,
  outcome: 'win' | 'draw' | 'loss',
): SeasonSimState {
  if (!sim.internationalSelected) return sim;
  const next = { ...sim };
  if (fixture.internationalRound === 'group') {
    next.internationalStage = outcome === 'win' || outcome === 'draw' || scored ? 'semi-final' : 'eliminated';
    return next;
  }
  if (fixture.internationalRound === 'semi-final') {
    next.internationalStage = scored ? 'final' : 'eliminated';
    return next;
  }
  if (fixture.internationalRound === 'final') {
    if (scored) {
      next.internationalStage = 'champion';
      next.honours = { ...next.honours, internationalChampion: sim.internationalTournament };
    } else {
      next.internationalStage = 'eliminated';
    }
    return next;
  }
  return next;
}

export const GROUP_STAGE_MATCHDAYS = GROUP_GAMES;
export const GROUP_POINTS_TO_ADVANCE = GROUP_ADVANCE_POINTS;

export function fixtureTitle(fixture: CalendarFixture): string {
  const vs = fixture.opponentLabel ? ` vs ${fixture.opponentLabel}` : '';
  if (fixture.kind === 'league') return `League${vs}`;
  if (fixture.kind === 'super-cup') return `Super Cup${vs}`;
  if (fixture.kind === 'continental-group') return `Group stage${vs}`;
  if (fixture.kind === 'continental-knockout') {
    const leg = fixture.leg === 2 ? ' 2nd leg' : ' 1st leg';
    return `Knockout${leg}${vs}`;
  }
  if (fixture.kind === 'continental-semi-final') return `Semi-final${vs}`;
  if (fixture.kind === 'continental-final') return `Final${vs}`;
  if (fixture.kind === 'international') {
    const round = fixture.internationalRound === 'group'
      ? 'Group'
      : fixture.internationalRound === 'semi-final'
        ? 'Semi-final'
        : 'Final';
    return `${round}${vs}`;
  }
  return vs.trim();
}

export function resolveFixture(
  sim: SeasonSimState,
  fixture: CalendarFixture,
  playerClub: Club,
  playerGoals: number,
  rng: () => number = Math.random,
): { sim: SeasonSimState; result: ClubMatchResult; summary: string } {
  const isHome = fixture.week % 2 === 1;
  const opp = fixture.opponentId ? getClub(fixture.opponentId) : undefined;
  const oppTier = opp?.tier ?? 3;
  const scored = playerGoals > 0;

  let result: ClubMatchResult;
  if (fixture.isDecisive) {
    result = decisiveScoreline(scored);
  } else {
    result = simulateClubMatch(
      { clubTier: playerClub.tier, opponentTier: oppTier, isHome },
      rng,
      playerGoals,
    );
  }

  let next = { ...sim };
  if (fixture.kind === 'league' && fixture.opponentId) {
    let table = applyMatchToTable(next.leagueTable, playerClub.id, fixture.opponentId, result);
    table = simulateRestOfLeagueRound(table, playerClub.id, fixture.opponentId, rng);
    next.leagueTable = table;
  } else if (fixture.kind.startsWith('continental') || fixture.kind === 'super-cup') {
    next = applyEuropeanResult(next, fixture, result);
  } else if (fixture.kind === 'international') {
    next = applyInternationalResult(next, fixture, scored, result.outcome);
  }

  const summary = `${result.outcome === 'win' ? 'Won' : result.outcome === 'draw' ? 'Drew' : 'Lost'} ${result.scoreFor}\u2013${result.scoreAgainst}${fixture.opponentLabel ? ` vs ${fixture.opponentLabel}` : ''}`;
  return { sim: next, result, summary };
}
