import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getClub } from './data/clubs';
import { applyMatchResult, createAvailability, isAvailable, serveBannedGame } from './availabilityEngine';
import { offerClubsForTrial, TRIAL_SHOTS } from './trial';
import type { ShotResult } from '../shooting/types';
import type { CareerState, MatchRecord, SeasonRecord } from './types';

/** Matches per season - an abstraction over real league calendars, which
 * vary from 34 to 38 games; kept uniform for now so every league/tier plays
 * out on the same footing. */
export const SEASON_LENGTH = 24;

const STARTING_AGE = 16;

function freshSeason(seasonNumber: number, clubId: string, role: CareerState['role']): SeasonRecord {
  return { seasonNumber, clubId, role, matches: [], goals: 0, gamesPlayed: 0, ratioMet: null };
}

function initialState(): CareerState {
  return {
    phase: 'menu',
    age: STARTING_AGE,
    seasonNumber: 1,
    clubId: null,
    parentClubId: null,
    role: 'reserve',
    trial: null,
    availability: createAvailability(),
    currentSeason: null,
    seasonHistory: [],
    careerGoals: 0,
    careerGames: 0,
  };
}

interface CareerActions {
  startTrial: () => void;
  recordTrialShot: (result: ShotResult) => void;
  finishTrial: () => void;
  chooseClub: (clubId: string) => void;
  /** Fast-forwards through any matches the player is currently dropped for,
   * then either opens the next match or closes out the season. */
  advance: () => void;
  recordMatchShot: (result: ShotResult) => void;
  continueAfterSeason: () => void;
  resetCareer: () => void;
  returnToMenu: () => void;
}

export type CareerStore = CareerState & CareerActions;

export const useCareerStore = create<CareerStore>()(
  persist(
    (set) => ({
      ...initialState(),

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
          const offered = offerClubsForTrial(state.trial.goals, 3);
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
          availability: createAvailability(),
          currentSeason: freshSeason(1, clubId, 'reserve'),
          phase: 'hub',
        }),

      advance: () =>
        set((state) => {
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

      recordMatchShot: (result) =>
        set((state) => {
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
            phase: seasonComplete ? 'season-summary' : 'hub',
          };
        }),

      continueAfterSeason: () =>
        set((state) => {
          const season = state.currentSeason;
          const club = state.clubId ? getClub(state.clubId) : undefined;
          if (!season || !club) return state;

          const ratio = season.gamesPlayed > 0 ? season.goals / season.gamesPlayed : 0;
          const threshold = season.role === 'first-team' ? club.firstTeamGoalRatio : club.reserveGoalRatio;
          const ratioMet = ratio >= threshold;
          const finishedSeason: SeasonRecord = { ...season, ratioMet };

          const nextRole = season.role === 'reserve' && ratioMet ? 'first-team' : state.role;

          return {
            seasonHistory: [...state.seasonHistory, finishedSeason],
            role: nextRole,
            seasonNumber: state.seasonNumber + 1,
            age: state.age + 1,
            availability: createAvailability(),
            currentSeason: freshSeason(state.seasonNumber + 1, state.clubId as string, nextRole),
            phase: 'hub',
          };
        }),

      resetCareer: () => set(initialState()),

      returnToMenu: () => set({ phase: 'menu' }),
    }),
    {
      name: 'wpy-career-v1',
      version: 1,
    },
  ),
);

export const TRIAL_TOTAL_SHOTS = TRIAL_SHOTS;
