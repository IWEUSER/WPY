import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyMatchResult, createAvailability, isAvailable, serveBannedGame } from './availabilityEngine';
import { FORM_WINDOW_GAMES, SEASON_LENGTH, STARTING_AGE } from './constants';
import { planSuperCup } from './continentalDraw';
import { getClub, leagueMatchWeeks } from './data/clubs';
import { playerMarketValue, weeklyWageForClub } from './playerValue';
import { isInternationalFinalsSeason } from './data/competitions';
import { evaluatePlayerOfTheYear, evaluateTopGoalscorer } from './domesticAwards';
import { countsTowardCareerRecord } from './seasonDisplay';
import { trophyLabels } from './honoursDisplay';
import { careerRatioForSelection, createNationalTeamState, recordInternationalAppearance } from './international';
import { buildSeasonStandings } from './matchEngine';
import { isFinalFixture } from './calendar';
import {
  hydrateSeason,
  resolveFixture,
  shouldSkipFixture,
  trophyNameForFixture,
  type LiveMatch,
} from './seasonSim';
import { offerClubsForTrial, TRIAL_SHOTS } from './trial';
import { countLoanSpells, resolveSeasonTransition } from './transfers';
import { evaluateWpy } from './wpy';
import type { ShotResult } from '../shooting/types';
import type { CareerState, MatchRecord, PlayerRole, SeasonRecord } from './types';

export { SEASON_LENGTH } from './constants';

function freshSeason(seasonNumber: number, clubId: string, role: CareerState['role'], age: number): SeasonRecord {
  return {
    seasonNumber,
    clubId,
    role,
    matches: [],
    goals: 0,
    gamesPlayed: 0,
    ratioMet: null,
    age,
    leagueGoals: 0,
    trophies: [],
    topGoalscorer: false,
    playerOfTheYear: false,
    wonWpy: false,
    earnings: 0,
  };
}

function withWeeklyPay(
  season: SeasonRecord,
  careerEarnings: number,
  weeklyWage: number,
): { season: SeasonRecord; careerEarnings: number } {
  const pay = weeklyWage || 0;
  return {
    season: { ...season, earnings: (season.earnings ?? 0) + pay },
    careerEarnings: careerEarnings + pay,
  };
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

function reserveSeasonLength(clubId: string | null): number {
  const club = clubId ? getClub(clubId) : undefined;
  return club ? leagueMatchWeeks(club.league) : SEASON_LENGTH;
}

function startSimulatedSeason(
  seasonNumber: number,
  clubId: string,
  role: PlayerRole,
  history: SeasonRecord[],
  nationId: string | null,
  age: number,
  careerGoals: number,
  careerGames: number,
  qualifierCarry: CareerState['intlQualifying'],
  superCup?: { include: boolean; opponentId?: string },
): Pick<CareerState, 'currentSeason' | 'seasonCalendar' | 'seasonSim' | 'seasonStandings' | 'liveMatch' | 'wpyResult' | 'lastMatchSummary'> {
  const season = freshSeason(seasonNumber, clubId, role, age);
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
    careerGoalRatio: careerRatioForSelection(careerGoals, careerGames, previousRatio(history)),
    nationId,
    qualifierCarry,
    includeSuperCup: superCup?.include,
    superCupOpponentId: superCup?.opponentId,
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

function attachSeasonAwards(state: CareerState): { season: SeasonRecord; wpyResult: CareerState['wpyResult'] } {
  const season = state.currentSeason;
  if (!season || !state.clubId) {
    return { season: season as SeasonRecord, wpyResult: state.wpyResult };
  }
  const club = getClub(state.clubId);
  const sim = state.seasonSim;
  const wpyResult = evaluateSeasonWpy(state);
  const league = club?.league ?? '';
  const boot = evaluateTopGoalscorer(season.leagueGoals, league);
  const poty = evaluatePlayerOfTheYear({
    leagueChampion: sim?.honours.leagueChampion ?? false,
    leagueGoals: season.leagueGoals,
    league,
  });
  return {
    wpyResult,
    season: {
      ...season,
      age: state.age,
      trophies: trophyLabels(sim?.honours, club),
      topGoalscorer: boot.won,
      playerOfTheYear: poty.won,
      wonWpy: wpyResult?.won ?? false,
      topGoalscorerReason: boot.reason,
      playerOfTheYearReason: poty.reason,
      wpyReason: wpyResult?.reason ?? null,
    },
  };
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
    lastMatchResult: null,
    weeklyWage: 0,
    careerEarnings: 0,
    previousContinentalChampion: null,
    previousChampionClubId: null,
    intlQualifying: null,
  };
}

function nextQualifyingCarry(sim: CareerState['seasonSim']): CareerState['intlQualifying'] {
  if (!sim?.internationalSelected || !sim.internationalTournament) return null;
  if (sim.internationalPhase !== 'qualifiers') return null;
  return {
    tournament: sim.internationalTournament,
    points: sim.qualifierPoints + sim.qualifierCarryPoints,
    played: sim.qualifierPlayed + sim.qualifierCarryPlayed,
  };
}

function recountCareerTotals(history: SeasonRecord[], current: SeasonRecord | null | undefined) {
  let goals = 0;
  let games = 0;
  for (const season of [...history, ...(current ? [current] : [])]) {
    if (!countsTowardCareerRecord(season.seasonNumber)) continue;
    goals += season.goals;
    games += season.gamesPlayed;
  }
  return { careerGoals: goals, careerGames: games };
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
  acknowledgeMatchResult: () => void;
  /** Season 1 one-shot matches still call this. */
  recordMatchShot: (result: ShotResult) => void;
  continueAfterSeason: () => void;
  resolveTransferChoice: (clubId: string | null) => void;
  openCareerRecord: () => void;
  returnToHub: () => void;
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
  let careerEarnings = state.careerEarnings;
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
      const droppedPay = withWeeklyPay(season, careerEarnings, state.weeklyWage);
      season = { ...droppedPay.season, matches: [...droppedPay.season.matches, record] };
      careerEarnings = droppedPay.careerEarnings;
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
      const noChancePay = withWeeklyPay(season, careerEarnings, state.weeklyWage);
      season = { ...noChancePay.season, matches: [...noChancePay.season.matches, record], gamesPlayed: noChancePay.season.gamesPlayed + 1 };
      careerEarnings = noChancePay.careerEarnings;
      if (countsTowardCareerRecord(state.seasonNumber)) {
        careerGames += 1;
        formWindow = pushForm(formWindow, 0);
      }
      lastMatchSummary = `${resolution.summary} · no chance this match`;
      if (isInternational && nationalTeam) {
        nationalTeam = recordInternationalAppearance(
          nationalTeam,
          sim.internationalTournament,
          fixture.internationalRound === 'qualifier',
          0,
        );
      }
      continue;
    }

    const liveMatch: LiveMatch = { fixtureIndex: sim.fixtureIndex, chancesTotal: chances, chancesTaken: 0, goals: 0 };
    return {
      seasonSim: sim,
      currentSeason: season,
      availability,
      nationalTeam,
      careerGames,
      careerEarnings,
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
  const nextState = { ...state, seasonSim: withHonours, currentSeason: season, availability, nationalTeam, formWindow, careerGames, careerEarnings };
  const awarded = attachSeasonAwards(nextState);
  return {
    seasonSim: withHonours,
    currentSeason: awarded.season,
    availability,
    nationalTeam,
    careerGames,
    careerEarnings,
    formWindow,
    lastMatchSummary,
    liveMatch: null,
    seasonStandings: buildSeasonStandings(withHonours.leagueTable, withHonours.europeanStanding),
    phase: 'season-summary',
    wpyResult: awarded.wpyResult,
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
        set(() => {
          const club = getClub(clubId);
          const weeklyWage = club
            ? weeklyWageForClub(club, playerMarketValue({ age: STARTING_AGE, ratio: 0.3, careerGoals: 0, club }))
            : 3000;
          return {
            clubId,
            parentClubId: clubId,
            role: 'reserve' as const,
            seasonNumber: 1,
            age: STARTING_AGE,
            seasonsAtCurrentClub: 0,
            availability: createAvailability(),
            weeklyWage,
            ...startSimulatedSeason(1, clubId, 'reserve', [], null, STARTING_AGE, 0, 0, null),
            pendingTransfer: null,
            phase: 'hub' as const,
          };
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

          const reserveLength = reserveSeasonLength(state.clubId);
          while (season.matches.length < reserveLength && !isAvailable(availability)) {
            const record: MatchRecord = { matchNumber: season.matches.length + 1, played: false, scored: null };
            season = { ...season, matches: [...season.matches, record] };
            availability = serveBannedGame(availability);
          }

          if (season.matches.length >= reserveLength) {
            const awarded = attachSeasonAwards({ ...state, currentSeason: season, availability });
            return {
              currentSeason: awarded.season,
              availability,
              phase: 'season-summary',
              wpyResult: awarded.wpyResult,
            };
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
          const paid = withWeeklyPay(season, state.careerEarnings, state.weeklyWage);
          const updatedSeason: SeasonRecord = {
            ...paid.season,
            matches: [...paid.season.matches, record],
            goals: paid.season.goals + live.goals,
            gamesPlayed: paid.season.gamesPlayed + 1,
            leagueGoals: paid.season.leagueGoals + (fixture.kind === 'league' ? live.goals : 0),
          };

          const isInternational = fixture.kind === 'international';
          let availability = state.availability;
          let nationalTeam = state.nationalTeam;
          if (isInternational && nationalTeam) {
            nationalTeam = {
              ...recordInternationalAppearance(
                nationalTeam,
                sim.internationalTournament,
                fixture.internationalRound === 'qualifier',
                live.goals,
              ),
              availability: applyMatchResult(nationalTeam.availability, scored),
            };
          } else {
            availability = applyMatchResult(availability, scored);
          }

          const complete = nextSim.fixtureIndex >= calendar.fixtures.length;
          const withHonours = complete
            ? { ...nextSim, honours: { ...nextSim.honours, leagueChampion: (nextSim.leagueTable.find((r) => r.clubId === state.clubId)?.position ?? 0) === 1 } }
            : nextSim;
          const counts = countsTowardCareerRecord(state.seasonNumber);
          const merged = {
            ...state,
            seasonSim: withHonours,
            currentSeason: updatedSeason,
            formWindow: counts ? pushForm(state.formWindow, live.goals) : state.formWindow,
          };
          const awarded = complete ? attachSeasonAwards(merged) : { season: updatedSeason, wpyResult: state.wpyResult };
          const summary = `${resolution.summary} · ${live.goals} goal${live.goals === 1 ? '' : 's'} from ${live.chancesTotal} chance${live.chancesTotal === 1 ? '' : 's'}`;
          const afterPhase = complete ? 'season-summary' : 'hub';
          const lastMatchResult = {
            summary,
            isFinal: isFinalFixture(fixture),
            won: resolution.result.outcome === 'win',
            trophyName: trophyNameForFixture(fixture, sim.internationalTournament),
            afterPhase: afterPhase as 'hub' | 'season-summary',
          };

          return {
            seasonSim: withHonours,
            currentSeason: awarded.season,
            availability,
            nationalTeam,
            liveMatch: null,
            seasonStandings: buildSeasonStandings(withHonours.leagueTable, withHonours.europeanStanding),
            lastMatchSummary: summary,
            lastMatchResult,
            formWindow: merged.formWindow,
            careerGoals: counts ? state.careerGoals + live.goals : state.careerGoals,
            careerGames: counts ? state.careerGames + 1 : state.careerGames,
            careerEarnings: paid.careerEarnings,
            phase: lastMatchResult.isFinal ? 'match-result' : afterPhase,
            wpyResult: awarded.wpyResult,
          };
        }),

      acknowledgeMatchResult: () =>
        set((state) => ({
          phase: state.lastMatchResult?.afterPhase ?? (state.clubId ? 'hub' : 'menu'),
        })),

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
          const paid = withWeeklyPay(season, state.careerEarnings, state.weeklyWage);
          const updatedSeason: SeasonRecord = {
            ...paid.season,
            matches,
            goals,
            gamesPlayed,
            leagueGoals: paid.season.leagueGoals + (scored ? 1 : 0),
          };
          const counts = countsTowardCareerRecord(state.seasonNumber);
          const seasonComplete = matches.length >= reserveSeasonLength(state.clubId);
          const awarded = seasonComplete
            ? attachSeasonAwards({ ...state, currentSeason: updatedSeason, availability })
            : { season: updatedSeason, wpyResult: state.wpyResult };
          return {
            currentSeason: awarded.season,
            availability,
            careerGoals: counts ? state.careerGoals + (scored ? 1 : 0) : state.careerGoals,
            careerGames: counts ? state.careerGames + 1 : state.careerGames,
            careerEarnings: paid.careerEarnings,
            formWindow: counts ? pushForm(state.formWindow, scored ? 1 : 0) : state.formWindow,
            phase: seasonComplete ? 'season-summary' : 'hub',
            wpyResult: awarded.wpyResult,
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
            loansUsed: countLoanSpells(state.seasonHistory, season),
            seasonHistory: state.seasonHistory,
          });

          const club = getClub(state.clubId);
          const threshold = club
            ? (state.role === 'first-team' ? club.firstTeamGoalRatio : club.reserveGoalRatio)
            : 0;
          const ratio = season.gamesPlayed > 0 ? season.goals / season.gamesPlayed : 0;
          const finishedSeason: SeasonRecord = {
            ...season,
            ratioMet: ratio >= threshold,
            earnings: season.earnings ?? 0,
          };
          const seasonHistory = [...state.seasonHistory, finishedSeason];
          const intlQualifying = nextQualifyingCarry(state.seasonSim);
          const europeanTitle = state.seasonSim?.honours.continentalChampion ?? null;
          const previousContinentalChampion =
            europeanTitle === 'ucl' || europeanTitle === 'uel' ? europeanTitle : null;

          if (transition.immediate && !transition.pendingTransfer) {
            const { clubId, parentClubId, role, seasonsAtCurrentClub } = transition.immediate;
            const nextClub = getClub(clubId);
            const superCup = nextClub
              ? planSuperCup({
                  nextClub,
                  previousClubId: previousContinentalChampion ? state.clubId : null,
                  previousCup: previousContinentalChampion,
                })
              : { include: false };
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
              intlQualifying,
              previousContinentalChampion,
              previousChampionClubId: previousContinentalChampion ? state.clubId : null,
              phase: 'hub',
              ...startSimulatedSeason(
                nextSeasonNumber,
                clubId,
                role,
                seasonHistory,
                state.nationality,
                nextAge,
                state.careerGoals,
                state.careerGames,
                intlQualifying,
                superCup,
              ),
            };
          }

          return {
            seasonHistory,
            seasonNumber: nextSeasonNumber,
            age: nextAge,
            pendingTransfer: transition.pendingTransfer ?? null,
            intlQualifying,
            previousContinentalChampion,
            previousChampionClubId: previousContinentalChampion ? state.clubId : null,
            phase: 'transfer-choice',
          };
        }),

      resolveTransferChoice: (clubId) =>
        set((state) => {
          const pending = state.pendingTransfer;
          if (!pending || !state.clubId || !state.parentClubId) return state;

          if (clubId === null) {
            const stay = pending.stay ?? {
              clubId: state.clubId,
              parentClubId: state.parentClubId,
              role: state.role,
              seasonsAtCurrentClub: state.seasonsAtCurrentClub + 1,
            };
            const nextClub = getClub(stay.clubId);
            const superCup = nextClub
              ? planSuperCup({
                  nextClub,
                  previousClubId: state.previousChampionClubId,
                  previousCup: state.previousContinentalChampion,
                })
              : { include: false };
            return {
              pendingTransfer: null,
              clubId: stay.clubId,
              parentClubId: stay.parentClubId,
              role: stay.role,
              seasonsAtCurrentClub: stay.seasonsAtCurrentClub,
              availability: createAvailability(),
              phase: 'hub',
              ...startSimulatedSeason(
                state.seasonNumber,
                stay.clubId,
                stay.role,
                state.seasonHistory,
                state.nationality,
                state.age,
                state.careerGoals,
                state.careerGames,
                state.intlQualifying,
                superCup,
              ),
            };
          }

          const offer = pending.offers?.find((o) => o.clubId === clubId);
          const takeLoan = offer ? offer.move === 'loan' : pending.kind === 'loan';
          let role: PlayerRole;
          let parentClubId: string;
          if (takeLoan) {
            role = 'loan';
            parentClubId = state.parentClubId;
          } else {
            role = 'first-team';
            parentClubId = clubId;
          }
          const nextClub = getClub(clubId);
          const superCup = nextClub
            ? planSuperCup({
                nextClub,
                previousClubId: state.previousChampionClubId,
                previousCup: state.previousContinentalChampion,
              })
            : { include: false };

          return {
            pendingTransfer: null,
            clubId,
            parentClubId,
            role,
            seasonsAtCurrentClub: 0,
            weeklyWage: offer?.weeklyWage ?? state.weeklyWage,
            availability: createAvailability(),
            phase: 'hub',
            ...startSimulatedSeason(
              state.seasonNumber,
              clubId,
              role,
              state.seasonHistory,
              state.nationality,
              state.age,
              state.careerGoals,
              state.careerGames,
              state.intlQualifying,
              superCup,
            ),
          };
        }),

      resetCareer: () => set(initialState()),

      openCareerRecord: () => set({ phase: 'career' }),

      returnToHub: () =>
        set((state) => ({
          phase: state.clubId ? 'hub' : 'menu',
        })),

      returnToMenu: () => set({ phase: 'menu' }),
    }),
    {
      name: 'wpy-career-v1',
      version: 9,
      migrate: (persisted) => {
        const state = persisted as Partial<CareerState>;
        const sim = state.seasonSim;
        const padSeason = (season: SeasonRecord, index: number): SeasonRecord => ({
          ...season,
          age: season.age ?? (state.age ?? 16) - Math.max(0, (state.seasonHistory?.length ?? 0) - index),
          leagueGoals: season.leagueGoals ?? season.goals,
          trophies: season.trophies ?? [],
          topGoalscorer: season.topGoalscorer ?? false,
          playerOfTheYear: season.playerOfTheYear ?? false,
          wonWpy: season.wonWpy ?? false,
        });
        const seasonHistory = (state.seasonHistory ?? []).map(padSeason);
        const currentSeason = state.currentSeason
          ? padSeason(state.currentSeason, state.seasonHistory?.length ?? 0)
          : null;
        const totals = recountCareerTotals(seasonHistory, currentSeason);
        return {
          ...state,
          nationality: state.nationality ?? null,
          nationalTeam: state.nationalTeam
            ? { ...state.nationalTeam, byCompetition: state.nationalTeam.byCompetition ?? [] }
            : null,
          seasonCalendar: state.seasonCalendar ?? null,
          seasonStandings: state.seasonStandings ?? null,
          seasonHistory,
          currentSeason,
          careerGoals: totals.careerGoals,
          careerGames: totals.careerGames,
          intlQualifying: state.intlQualifying ?? null,
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
                qualifierCarryPoints: sim.qualifierCarryPoints ?? 0,
                qualifierCarryPlayed: sim.qualifierCarryPlayed ?? 0,
                groupPoints: sim.groupPoints ?? 0,
                groupPlayed: sim.groupPlayed ?? 0,
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
          formWindow: (state.seasonNumber ?? 1) < 2 ? [] : (state.formWindow ?? []),
          wpyResult: state.wpyResult ?? null,
          lastMatchSummary: state.lastMatchSummary ?? null,
          lastMatchResult: state.lastMatchResult ?? null,
          weeklyWage: state.weeklyWage ?? 0,
          careerEarnings: state.careerEarnings ?? 0,
          previousContinentalChampion: state.previousContinentalChampion ?? null,
          previousChampionClubId: state.previousChampionClubId ?? null,
          pendingTransfer: state.pendingTransfer
            ? {
                ...state.pendingTransfer,
                offers: state.pendingTransfer.offers ??
                  (state.pendingTransfer.clubIds ?? []).map((clubId) => ({
                    clubId,
                    move: state.pendingTransfer?.kind === 'loan' ? 'loan' : 'permanent',
                    fee: 0,
                    weeklyWage: 0,
                  })),
              }
            : null,
        };
      },
    },
  ),
);

export const TRIAL_TOTAL_SHOTS = TRIAL_SHOTS;
