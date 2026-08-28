import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyMatchResult, createAvailability, isAvailable, serveBannedGame } from './availabilityEngine';
import { buildSeasonCalendar, type SeasonCalendar } from './calendar';
import { getClub } from './data/clubs';
import { confederationForCountry } from './data/competitions';
import { createNationalTeamState } from './international';
import { offerClubsForTrial, TRIAL_SHOTS } from './trial';
import { resolveSeasonTransition } from './transfers';
import type { ShotResult } from '../shooting/types';
import type { CareerState, MatchRecord, PlayerRole, SeasonRecord } from './types';

/** Matches per season - an abstraction over real league calendars, which
 * vary from 34 to 38 games; kept uniform for now so every league/tier plays
 * out on the same footing. */
export const SEASON_LENGTH = 24;

const STARTING_AGE = 16;

function freshSeason(seasonNumber: number, clubId: string, role: CareerState['role']): SeasonRecord {
  return { seasonNumber, clubId, role, matches: [], goals: 0, gamesPlayed: 0, ratioMet: null };
}

/**
 * Starts a season's record plus (from season 2 onward) its fixture
 * calendar. Season 1 is reserve-team/no-opponents by design, so it never
 * gets a calendar. This is metadata only - it doesn't change how matches are
 * currently played (still one shot per "match", via MatchScreen); it's the
 * plug point the season 2-20 simulation will read from once it exists.
 */
function startSeason(seasonNumber: number, clubId: string, role: PlayerRole): { season: SeasonRecord; calendar: SeasonCalendar | null } {
  const season = freshSeason(seasonNumber, clubId, role);
  if (seasonNumber < 2) return { season, calendar: null };
  const club = getClub(clubId);
  if (!club) return { season, calendar: null };
  const calendar = buildSeasonCalendar({
    seasonNumber,
    leagueMatchWeeks: SEASON_LENGTH,
    clubTier: club.tier,
    confederation: confederationForCountry(club.country),
  });
  return { season, calendar };
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
  };
}

interface CareerActions {
  startTrial: () => void;
  recordTrialShot: (result: ShotResult) => void;
  finishTrial: () => void;
  chooseClub: (clubId: string) => void;
  /** Records the player's international nationality - independent of club. */
  chooseNationality: (nationId: string) => void;
  /** Fast-forwards through any matches the player is currently dropped for,
   * then either opens the next match or closes out the season. */
  advance: () => void;
  recordMatchShot: (result: ShotResult) => void;
  continueAfterSeason: () => void;
  /** Applies a loan/sale/transfer decision. Pass null to decline a voluntary offer. */
  resolveTransferChoice: (clubId: string | null) => void;
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
          seasonsAtCurrentClub: 0,
          availability: createAvailability(),
          currentSeason: freshSeason(1, clubId, 'reserve'),
          seasonCalendar: null,
          pendingTransfer: null,
          phase: 'nationality-choice',
        }),

      chooseNationality: (nationId) =>
        set({
          nationality: nationId,
          nationalTeam: createNationalTeamState(nationId),
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
          });

          const finishedSeason: SeasonRecord = { ...season, ratioMet: !transition.pendingTransfer };
          const seasonHistory = [...state.seasonHistory, finishedSeason];

          if (transition.immediate) {
            const { clubId, parentClubId, role, seasonsAtCurrentClub } = transition.immediate;
            const { season: nextSeason, calendar } = startSeason(nextSeasonNumber, clubId, role);
            return {
              seasonHistory,
              clubId,
              parentClubId,
              role,
              seasonsAtCurrentClub,
              seasonNumber: nextSeasonNumber,
              age: nextAge,
              availability: createAvailability(),
              currentSeason: nextSeason,
              seasonCalendar: calendar,
              pendingTransfer: null,
              phase: 'hub',
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
            // Only a voluntary promotion offer can be declined - stay put.
            const { season, calendar } = startSeason(state.seasonNumber, state.clubId, state.role);
            return {
              pendingTransfer: null,
              seasonsAtCurrentClub: state.seasonsAtCurrentClub + 1,
              availability: createAvailability(),
              currentSeason: season,
              seasonCalendar: calendar,
              phase: 'hub',
            };
          }

          let role: PlayerRole;
          let parentClubId: string;
          if (pending.kind === 'loan') {
            role = 'loan';
            parentClubId = state.parentClubId;
          } else {
            // Sold outright or accepted a bigger club's offer - this is the new home club now.
            role = 'first-team';
            parentClubId = clubId;
          }

          const { season, calendar } = startSeason(state.seasonNumber, clubId, role);
          return {
            pendingTransfer: null,
            clubId,
            parentClubId,
            role,
            seasonsAtCurrentClub: 0,
            availability: createAvailability(),
            currentSeason: season,
            seasonCalendar: calendar,
            phase: 'hub',
          };
        }),

      resetCareer: () => set(initialState()),

      returnToMenu: () => set({ phase: 'menu' }),
    }),
    {
      name: 'wpy-career-v1',
      version: 2,
    },
  ),
);

export const TRIAL_TOTAL_SHOTS = TRIAL_SHOTS;
