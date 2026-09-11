import { currentCalendarWeek } from './calendar';
import { getClub } from './data/clubs';
import { clubContinentalCup } from './data/competitions';
import { callUpRatio, qualifierExcludeIds } from './international';
import { buildSeasonStandings } from './matchEngine';
import { hydrateSeason, type SeasonSimState } from './seasonSim';
import type { CareerState } from './types';

/** Bump when calendar generation, playable leagues, or cup rules change. */
export const CURRENT_RULES_STAMP = 'pt-nl-tr-v1';

const SETUP_PHASES = new Set<string>(['menu', 'club-choice', 'nationality-choice']);

export function seasonIsInProgress(
  state: Pick<CareerState, 'phase' | 'seasonCalendar' | 'seasonSim'>,
): boolean {
  if (!state.seasonCalendar || !state.seasonSim) return false;
  return !SETUP_PHASES.has(state.phase);
}

export function saveNeedsRebuild(
  state: Pick<CareerState, 'phase' | 'seasonCalendar' | 'seasonSim' | 'rulesStamp'>,
): boolean {
  return seasonIsInProgress(state) && (state.rulesStamp ?? '') !== CURRENT_RULES_STAMP;
}

/** In-progress seasons keep a missing stamp so the hub can offer a rebuild. */
export function migratedRulesStamp(state: Partial<CareerState>): string | null {
  const phase = state.phase;
  const inProgress = Boolean(state.seasonCalendar && state.seasonSim)
    && Boolean(phase)
    && phase !== undefined
    && !SETUP_PHASES.has(phase);
  if (inProgress) return state.rulesStamp ?? null;
  return CURRENT_RULES_STAMP;
}

function advanceToWeek(sim: SeasonSimState, week: number, fixtureCount: number, weeks: number[]): SeasonSimState {
  let fixtureIndex = 0;
  while (fixtureIndex < fixtureCount && (weeks[fixtureIndex] ?? week) < week) {
    fixtureIndex += 1;
  }
  return { ...sim, fixtureIndex };
}

/**
 * Regenerates this season's calendar from the current rules, keeps stats
 * already earned, and skips ahead to the same calendar week.
 */
export function rebuildCurrentSeason(state: CareerState): Partial<CareerState> {
  if (!state.clubId || !state.seasonCalendar || !state.seasonSim) {
    return { rulesStamp: CURRENT_RULES_STAMP };
  }
  const club = getClub(state.clubId);
  if (!club) return { rulesStamp: CURRENT_RULES_STAMP };

  const week = currentCalendarWeek(state.seasonCalendar, state.seasonSim.fixtureIndex);
  const leagueOnly = state.role === 'reserve';
  const hadSuperCup = state.seasonCalendar.fixtures.some((f) => f.kind === 'super-cup' && !f.domesticSuperCup);
  const domesticSuper = state.seasonCalendar.fixtures.find((f) => f.domesticSuperCup);
  const superCupOpponentId = state.seasonCalendar.fixtures.find(
    (f) => f.kind === 'super-cup' && !f.domesticSuperCup && f.opponentId,
  )?.opponentId;
  const { calendar, sim } = hydrateSeason({
    seasonNumber: state.seasonNumber,
    club,
    careerGoalRatio: callUpRatio({
      season: state.currentSeason,
      careerGoals: state.careerGoals,
      careerGames: state.careerGames,
    }),
    nationId: state.nationality,
    qualifierCarry: state.intlQualifying,
    includeSuperCup: hadSuperCup,
    superCupOpponentId,
    includeDomesticSuperCup: Boolean(domesticSuper),
    domesticSuperCupOpponentId: domesticSuper?.opponentId,
    domesticSuperCupName: domesticSuper?.domesticSuperCupName,
    league: state.clubLeague ?? club.league,
    continentalCup: leagueOnly
      ? null
      : state.qualifiedContinentalCup !== undefined
        ? state.qualifiedContinentalCup
        : clubContinentalCup(club),
    excludeQualifierIds: qualifierExcludeIds(state.nationalTeam, state.intlQualifying?.opponentIds),
    leagueOnly,
    careerStart: state.careerStart,
  });

  const old = state.seasonSim;
  const sameTable = old.leagueTable.length === sim.leagueTable.length
    && old.leagueTable.every((row) => sim.leagueTable.some((next) => next.clubId === row.clubId));
  const merged = advanceToWeek(
    {
      ...sim,
      leagueTable: sameTable ? old.leagueTable : sim.leagueTable,
      europeanStanding: old.europeanStanding ?? sim.europeanStanding,
      europeanGroupPoints: old.europeanGroupPoints,
      europeanGroupPlayed: old.europeanGroupPlayed,
      knockoutAggFor: old.knockoutAggFor,
      knockoutAggAgainst: old.knockoutAggAgainst,
      internationalStage: old.internationalStage,
      internationalSelected: old.internationalSelected,
      qualifierPoints: old.qualifierPoints,
      qualifierPlayed: old.qualifierPlayed,
      qualifierCarryPoints: old.qualifierCarryPoints,
      qualifierCarryPlayed: old.qualifierCarryPlayed,
      groupPoints: old.groupPoints,
      groupPlayed: old.groupPlayed,
      nationQualified: old.nationQualified,
      domesticCup: sim.domesticCup,
      domesticCupStage: old.domesticCup && old.domesticCup === sim.domesticCup
        ? old.domesticCupStage
        : sim.domesticCupStage,
      honours: old.honours,
      titleRivalId: old.titleRivalId ?? sim.titleRivalId,
      rivalHomeOutcome: old.rivalHomeOutcome,
      rivalAwayOutcome: old.rivalAwayOutcome,
      playoffStage: old.playoffStage,
      leaguesCupStage: old.leaguesCupStage,
      leaguesCupGroupPlayed: old.leaguesCupGroupPlayed,
      leaguesCupGroupPoints: old.leaguesCupGroupPoints,
      superCupStage: old.superCupStage,
      domesticSuperCupStage: old.domesticSuperCupStage,
      internationalReached: old.internationalReached,
      internationalGroup: old.internationalGroup ?? sim.internationalGroup,
      friendlyPlayed: old.friendlyPlayed,
      knockoutGamesScored: old.knockoutGamesScored,
    },
    week,
    calendar.fixtures.length,
    calendar.fixtures.map((f) => f.week),
  );

  return {
    seasonCalendar: calendar,
    seasonSim: merged,
    seasonStandings: buildSeasonStandings(merged.leagueTable, merged.europeanStanding),
    liveMatch: null,
    rulesStamp: CURRENT_RULES_STAMP,
  };
}
