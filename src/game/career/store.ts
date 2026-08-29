import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyMatchResult, createAvailability, isAvailable, serveBannedGame } from './availabilityEngine';
import { FORM_WINDOW_GAMES, SEASON_LENGTH, STARTING_AGE } from './constants';
import { getClub } from './data/clubs';
import { isInternationalFinalsSeason } from './data/competitions';
import { createNationalTeamState } from './international';
import { buildSeasonStandings } from './matchEngine';
import {
  hydrateSeason,
  resolveFixture,
  shouldSkipFixture,
  type LiveMatch,
} from './seasonSim';
import { offerClubsForTrial, TRIAL_SHOTS } from './trial';
import { resolveSeasonTransition } from './transfers';
import { evaluateWpy } from './wpy';
import type { ShotResult } from '../shooting/types';
import type { CareerState, MatchRecord, PlayerRole, SeasonRecord } from './types';

export { SEASON_LENGTH } from './constants';

function freshSeason(seasonNumber: number, clubId: string, role: CareerState['role']): SeasonRecord {
  return { seasonNumber, clubId, role, matches: [], goals: 0, gamesPlayed: 0, ratioMet: null };
}

function pushForm(window: number[], goalsThisMatch: number): number[] {
  const next = [...window, goalsThisMatch > 0 ? 1 : 0];
  return next.length > FORM_WINDOW_GAMES ? next.slice(-FORM_WINDOW_GAMES) : next;
}

function previousRatio(history: SeasonRecord[]): number {
  const last = history[history.length - 1];
  if (!last || last.gamesPlayed === 0) return 0;
  return last.goals / last.gamesPlayed;
}

function startSimulatedSeason(
  seasonNumber: number,
  clubId: string,
  role: PlayerRole,
  history: SeasonRecord[],
  nationId: string | null,
): Pick<CareerState, 'currentSeason' | 'seasonCalendar' | 'seasonSim' | 'seasonStandings' | 'liveMatch' | 'wpyResult' | 'lastMatchSummary'> {
  const season = freshSeason(seasonNumber, clubId, role);
  if (seasonNumber < 2) {
    return {
      currentSeason: season,
      seasonCalendar: null,
      seasonSim: null,
      seasonStandings: null,
      liveMatch: null,
      wpyResult: null,
      lastMatchSummary: null,
    };
  }
  const club = getClub(clubId);
  if (!club) {
    return {
      currentSeason: season,
      seasonCalendar: null,
      seasonSim: null,
      seasonStandings: null,
      liveMatch: null,
      wpyResult: null,
      lastMatchSummary: null,
    };
  }
  const { calendar, sim } = hydrateSeason({
    seasonNumber,
    club,
    previousSeasonRatio: previousRatio(history),
    nationId,
  });
  return {
    currentSeason: season,
    seasonCalendar: calendar,
    seasonSim: sim,
    seasonStandings: buildSeasonStandings(sim.leagueTable, sim.europeanStanding),
    liveMatch: null,
    wpyResult: null,
    lastMatchSummary: null,
  };
}

function finalizeSimHonours(state: CareerState): CareerState['seasonSim'] {
  const sim = state.seasonSim;
  if (!sim || !state.clubId) return sim;
  const table = sim.leagueTable;
  const us = table.find((r) => r.clubId === state.clubId);
  const leagueChampion = us?.position === 1;
  return { ...sim, honours: { ...sim.honours, leagueChampion } };
}

function evaluateSeasonWpy(state: CareerState) {
  const club = state.clubId ? getClub(state.clubId) : undefined;
  const season = state.currentSeason;
  const sim = state.seasonSim;
  if (!club || !season || !sim || state.seasonNumber < 2) return null;
  const ratio = season.gamesPlayed > 0 ? season.goals / season.gamesPlayed : 0;
  const formGoals = state.formWindow.reduce((a, b) => a + b, 0);
  return evaluateWpy({
    seasonGoalRatio: ratio,
    eliteRatioBar: club.firstTeamGoalRatio,
    wonChampionsLeague: sim.honours.continentalChampion === 'ucl',
    isInternationalTournamentYear: isInternationalFinalsSeason(state.seasonNumber),
    wonInternationalTournament: sim.honours.internationalChampion !== null,
    recentFormGoals: formGoals,
    recentFormGames: state.formWindow.length,
  });
}

function initialState(): CareerState {
  return {
    phase: 'menu',
    age: STARTING_AGE,
    seasonNumber: 1,
    clubId: null,
    parentClubId: null,
    role: 'reserve',
    seasonsAtCurrentClub: 0,
    trial: null,
    availability: createAvailability(),
    currentSeason: null,
    seasonHistory: [],
    careerGoals: 0,
    careerGames: 0,
    pendingTransfer: null,
    nationality: null,
    nationalTeam: null,
    seasonCalendar: null,
    seasonStandings: null,
    seasonSim: null,
    liveMatch: null,
    formWindow: [],
    wpyResult: null,
    lastMatchSummary: null,
  };
}

interface CareerActions {
  /** Opens nationality selection before the trial. */
  startCareer: () => void;
  startTrial: () => void;
  recordTrialShot: (result: ShotResult) => void;
  finishTrial: () => void;
  chooseClub: (clubId: string) => void;
  chooseNationality: (nationId: string) => void;
  advance: () => void;
  recordMatchChance: (result: ShotResult) => void;
  finishLiveMatch: () => void;
  /** Season 1 one-shot matches still call this. */
  recordMatchShot: (result: ShotResult) => void;
  continueAfterSeason: () => void;
  resolveTransferChoice: (clubId: string | null) => void;
  resetCareer: () => void;
  returnToMenu: () => void;
}

export type CareerStore = CareerState & CareerActions;

function openNextSimFixture(state: CareerState): Partial<CareerState> {
  let sim = state.seasonSim;
  const calendar = state.seasonCalendar;
  let season = state.currentSeason;
  let availability = state.availability;
  let nationalTeam = state.nationalTeam;
  let careerGames = state.careerGames;
  let formWindow = state.formWindow;
  let lastMatchSummary = state.lastMatchSummary;
  if (!sim || !calendar || !season || !state.clubId) return {};
  const club = getClub(state.clubId);
  if (!club) return {};

  while (sim.fixtureIndex < calendar.fixtures.length) {
    const fixture = calendar.fixtures[sim.fixtureIndex];
    if (shouldSkipFixture(fixture, sim)) {
      sim = { ...sim, fixtureIndex: sim.fixtureIndex + 1 };
      continue;
    }

    const isInternational = fixture.kind === 'international';
    const squad = isInternational ? nationalTeam?.availability : availability;
    if (squad && !isAvailable(squad)) {
      const resolution = resolveFixture(sim, fixture, club, 0);
      sim = { ...resolution.sim, fixtureIndex: sim.fixtureIndex + 1 };
      const record: MatchRecord = { matchNumber: season.matches.length + 1, played: false, scored: null };
      season = { ...season, matches: [...season.matches, record] };
      lastMatchSummary = `${resolution.summary} · you were dropped`;
      if (isInternational && nationalTeam) {
        nationalTeam = { ...nationalTeam, availability: serveBannedGame(nationalTeam.availability) };
      } else {
        availability = serveBannedGame(availability);
      }
      continue;
    }

    const chances = fixture.playerChances ?? 1;
    if (chances <= 0) {
      const resolution = resolveFixture(sim, fixture, club, 0);
      sim = { ...resolution.sim, fixtureIndex: sim.fixtureIndex + 1 };
      const record: MatchRecord = { matchNumber: season.matches.length + 1, played: true, scored: false };
      season = { ...season, matches: [...season.matches, record], gamesPlayed: season.gamesPlayed + 1 };
      careerGames += 1;
      formWindow = pushForm(formWindow, 0);
      lastMatchSummary = `${resolution.summary} · no chance this match`;
      continue;
    }

    const liveMatch: LiveMatch = { fixtureIndex: sim.fixtureIndex, chancesTotal: chances, chancesTaken: 0, goals: 0 };
    return {
      seasonSim: sim,
      currentSeason: season,
      availability,
      nationalTeam,
      careerGames,
      formWindow,
      lastMatchSummary,
      seasonStandings: buildSeasonStandings(sim.leagueTable, sim.europeanStanding),
      liveMatch,
      phase: 'match',
    };
  }

  const withHonours = {
    ...sim,
    honours: {
      ...sim.honours,
      leagueChampion: (sim.leagueTable.find((r) => r.clubId === state.clubId)?.position ?? 0) === 1,
    },
  };
  const nextState = { ...state, seasonSim: withHonours, currentSeason: season, availability, nationalTeam, formWindow, careerGames };
  return {
    seasonSim: withHonours,
    currentSeason: season,
    availability,
    nationalTeam,
    careerGames,
    formWindow,
    lastMatchSummary,
    liveMatch: null,
    seasonStandings: buildSeasonStandings(withHonours.leagueTable, withHonours.europeanStanding),
    phase: 'season-summary',
    wpyResult: evaluateSeasonWpy(nextState),
  };
}

export const useCareerStore = create<CareerStore>()(
  persist(
    (set) => ({
      ...initialState(),

      startCareer: () => set({ phase: 'nationality-choice' }),

      startTrial: () => set({ phase: 'trial', trial: { shots: [], goals: 0, offeredClubIds: [] } }),

      recordTrialShot: (result) =>
        set((state) => {
          if (!state.trial) return state;
          const goals = state.trial.goals + (result.outcome === 'goal' ? 1 : 0);
          return { trial: { ...state.trial, shots: [...state.trial.shots, result], goals } };
        }),

      finishTrial: () =>
        set((state) => {
          if (!state.trial) return state;
          const offered = offerClubsForTrial(state.trial.goals, 3, state.nationality);
          return {
            trial: { ...state.trial, offeredClubIds: offered.map((c) => c.id) },
            phase: 'club-offer',
          };
        }),

      chooseClub: (clubId) =>
        set({
          clubId,
          parentClubId: clubId,
          role: 'reserve',
          seasonNumber: 1,
          age: STARTING_AGE,
          seasonsAtCurrentClub: 0,
          availability: createAvailability(),
          ...startSimulatedSeason(1, clubId, 'reserve', [], null),
          pendingTransfer: null,
          phase: 'hub',
        }),

      chooseNationality: (nationId) =>
        set((state) => {
          const nationalTeam = createNationalTeamState(nationId);
          if (state.clubId) {
            return { nationality: nationId, nationalTeam, phase: 'hub' };
          }
          return {
            nationality: nationId,
            nationalTeam,
            phase: 'trial',
            trial: { shots: [], goals: 0, offeredClubIds: [] },
          };
        }),

      advance: () =>
        set((state) => {
          if (state.seasonCalendar && state.seasonSim) {
            const updates = openNextSimFixture(state);
            if (updates.phase === 'season-summary' && updates.seasonSim) {
              return { ...updates, seasonSim: finalizeSimHonours({ ...state, ...updates } as CareerState) };
            }
            return updates;
          }

          let season = state.currentSeason;
          let availability = state.availability;
          if (!season) return state;

          while (season.matches.length < SEASON_LENGTH && !isAvailable(availability)) {
            const record: MatchRecord = { matchNumber: season.matches.length + 1, played: false, scored: null };
            season = { ...season, matches: [...season.matches, record] };
            availability = serveBannedGame(availability);
          }

          if (season.matches.length >= SEASON_LENGTH) {
            return { currentSeason: season, availability, phase: 'season-summary' };
          }
          return { currentSeason: season, availability, phase: 'match' };
        }),

      recordMatchChance: (result) =>
        set((state) => {
          const live = state.liveMatch;
          if (!live) return state;
          const scored = result.outcome === 'goal';
          return {
            liveMatch: {
              ...live,
              chancesTaken: live.chancesTaken + 1,
              goals: live.goals + (scored ? 1 : 0),
            },
          };
        }),

      finishLiveMatch: () =>
        set((state) => {
          const live = state.liveMatch;
          const sim = state.seasonSim;
          const calendar = state.seasonCalendar;
          const season = state.currentSeason;
          if (!live || !sim || !calendar || !season || !state.clubId) return state;
          const club = getClub(state.clubId);
          const fixture = calendar.fixtures[live.fixtureIndex];
          if (!club || !fixture) return state;

          const resolution = resolveFixture(sim, fixture, club, live.goals);
          const nextSim = { ...resolution.sim, fixtureIndex: live.fixtureIndex + 1 };
          const scored = live.goals > 0;
          const record: MatchRecord = { matchNumber: season.matches.length + 1, played: true, scored };
          const updatedSeason: SeasonRecord = {
            ...season,
            matches: [...season.matches, record],
            goals: season.goals + live.goals,
            gamesPlayed: season.gamesPlayed + 1,
          };

          const isInternational = fixture.kind === 'international';
          let availability = state.availability;
          let nationalTeam = state.nationalTeam;
          if (isInternational && nationalTeam) {
            nationalTeam = {
              ...nationalTeam,
              availability: applyMatchResult(nationalTeam.availability, scored),
              caps: nationalTeam.caps + 1,
              goals: nationalTeam.goals + live.goals,
            };
          } else {
            availability = applyMatchResult(availability, scored);
          }

          const complete = nextSim.fixtureIndex >= calendar.fixtures.length;
          const withHonours = complete
            ? { ...nextSim, honours: { ...nextSim.honours, leagueChampion: (nextSim.leagueTable.find((r) => r.clubId === state.clubId)?.position ?? 0) === 1 } }
            : nextSim;
          const merged = { ...state, seasonSim: withHonours, currentSeason: updatedSeason, formWindow: pushForm(state.formWindow, live.goals) };

          return {
            seasonSim: withHonours,
            currentSeason: updatedSeason,
            availability,
            nationalTeam,
            liveMatch: null,
            seasonStandings: buildSeasonStandings(withHonours.leagueTable, withHonours.europeanStanding),
            lastMatchSummary: `${resolution.summary} · ${live.goals} goal${live.goals === 1 ? '' : 's'} from ${live.chancesTotal} chance${live.chancesTotal === 1 ? '' : 's'}`,
            formWindow: merged.formWindow,
            careerGoals: state.careerGoals + live.goals,
            careerGames: state.careerGames + 1,
            phase: complete ? 'season-summary' : 'hub',
            wpyResult: complete ? evaluateSeasonWpy(merged) : state.wpyResult,
          };
        }),

      recordMatchShot: (result) =>
        set((state) => {
          if (state.seasonCalendar && state.liveMatch) {
            return state;
          }
          const season = state.currentSeason;
          if (!season) return state;
          const scored = result.outcome === 'goal';
          const record: MatchRecord = { matchNumber: season.matches.length + 1, played: true, scored };
          const matches = [...season.matches, record];
          const goals = season.goals + (scored ? 1 : 0);
          const gamesPlayed = season.gamesPlayed + 1;
          const availability = applyMatchResult(state.availability, scored);
          const updatedSeason: SeasonRecord = { ...season, matches, goals, gamesPlayed };
          const seasonComplete = matches.length >= SEASON_LENGTH;
          return {
            currentSeason: updatedSeason,
            availability,
            careerGoals: state.careerGoals + (scored ? 1 : 0),
            careerGames: state.careerGames + 1,
            formWindow: pushForm(state.formWindow, scored ? 1 : 0),
            phase: seasonComplete ? 'season-summary' : 'hub',
          };
        }),

      continueAfterSeason: () =>
        set((state) => {
          const season = state.currentSeason;
          if (!season || !state.clubId || !state.parentClubId) return state;

          const nextSeasonNumber = state.seasonNumber + 1;
          const nextAge = state.age + 1;

          const transition = resolveSeasonTransition({
            season,
            role: state.role,
            clubId: state.clubId,
            parentClubId: state.parentClubId,
            seasonsAtCurrentClub: state.seasonsAtCurrentClub,
            age: state.age,
            careerGoals: state.careerGoals,
            careerGames: state.careerGames,
            nationality: state.nationality,
          });

          const finishedSeason: SeasonRecord = { ...season, ratioMet: !transition.pendingTransfer };
          const seasonHistory = [...state.seasonHistory, finishedSeason];

          if (transition.immediate) {
            const { clubId, parentClubId, role, seasonsAtCurrentClub } = transition.immediate;
            return {
              seasonHistory,
              clubId,
              parentClubId,
              role,
              seasonsAtCurrentClub,
              seasonNumber: nextSeasonNumber,
              age: nextAge,
              availability: createAvailability(),
              pendingTransfer: null,
              phase: 'hub',
              ...startSimulatedSeason(nextSeasonNumber, clubId, role, seasonHistory, state.nationality),
            };
          }

          return {
            seasonHistory,
            seasonNumber: nextSeasonNumber,
            age: nextAge,
            pendingTransfer: transition.pendingTransfer ?? null,
            phase: 'transfer-choice',
          };
        }),

      resolveTransferChoice: (clubId) =>
        set((state) => {
          const pending = state.pendingTransfer;
          if (!pending || !state.clubId || !state.parentClubId) return state;

          if (clubId === null) {
            return {
              pendingTransfer: null,
              seasonsAtCurrentClub: state.seasonsAtCurrentClub + 1,
              availability: createAvailability(),
              phase: 'hub',
              ...startSimulatedSeason(state.seasonNumber, state.clubId, state.role, state.seasonHistory, state.nationality),
            };
          }

          let role: PlayerRole;
          let parentClubId: string;
          if (pending.kind === 'loan') {
            role = 'loan';
            parentClubId = state.parentClubId;
          } else {
            role = 'first-team';
            parentClubId = clubId;
          }

          return {
            pendingTransfer: null,
            clubId,
            parentClubId,
            role,
            seasonsAtCurrentClub: 0,
            availability: createAvailability(),
            phase: 'hub',
            ...startSimulatedSeason(state.seasonNumber, clubId, role, state.seasonHistory, state.nationality),
          };
        }),

      resetCareer: () => set(initialState()),

      returnToMenu: () => set({ phase: 'menu' }),
    }),
    {
      name: 'wpy-career-v1',
      version: 5,
      migrate: (persisted) => {
        const state = persisted as Partial<CareerState>;
        const sim = state.seasonSim;
        return {
          ...state,
          nationality: state.nationality ?? null,
          nationalTeam: state.nationalTeam ?? null,
          seasonCalendar: state.seasonCalendar ?? null,
          seasonStandings: state.seasonStandings ?? null,
          seasonSim: sim
            ? {
                ...sim,
                domesticCup: sim.domesticCup ?? null,
                domesticCupStage: sim.domesticCupStage ?? 'not-entered',
                internationalPhase: sim.internationalPhase ?? 'none',
                nationId: sim.nationId ?? state.nationality ?? null,
                qualifierPoints: sim.qualifierPoints ?? 0,
                qualifierPlayed: sim.qualifierPlayed ?? 0,
                qualifierTarget: sim.qualifierTarget ?? 0,
                nationQualified: sim.nationQualified ?? false,
                honours: {
                  leagueChampion: sim.honours?.leagueChampion ?? false,
                  continentalChampion: sim.honours?.continentalChampion ?? null,
                  superCup: sim.honours?.superCup ?? false,
                  internationalChampion: sim.honours?.internationalChampion ?? null,
                  domesticCup: sim.honours?.domesticCup ?? null,
                },
              }
            : null,
          liveMatch: state.liveMatch ?? null,
          formWindow: state.formWindow ?? [],
          wpyResult: state.wpyResult ?? null,
          lastMatchSummary: state.lastMatchSummary ?? null,
        };
      },
    },
  ),
);

export const TRIAL_TOTAL_SHOTS = TRIAL_SHOTS;
